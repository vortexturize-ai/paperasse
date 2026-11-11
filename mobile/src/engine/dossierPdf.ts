import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { winAnsi } from "./sheet.ts";

export type DossierPage =
  | { kind: "jpeg" | "png"; bytes: Uint8Array }
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "text"; text: string };

export interface DossierPiece {
  /** Ligne du dossier (« Justificatif de domicile »). */
  label: string;
  /** Titre du papier dans le coffre. */
  title: string;
  pages: DossierPage[];
}

export interface DossierPdfInput {
  title: string;
  watermark: string;
  /** AAAA-MM-JJ */
  date: string;
  pieces: DossierPiece[];
  missing: string[];
}

export interface DossierPdfResult {
  bytes: Uint8Array;
  pages: number;
  skipped: { title: string; reason: string }[];
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const MAX_PDF_PAGES = 40;
const INK = rgb(0.17, 0.14, 0.25);
const MUTED = rgb(0.37, 0.34, 0.46);
const MARK = rgb(0.82, 0.16, 0.29);

function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** « Uniquement pour la location d'un logement — Agence Martin — 10/11/2026 » */
export function watermarkText(purpose: string, recipient: string | undefined, dateIso: string): string {
  const who = recipient?.trim().replace(/\s+/g, " ").slice(0, 60);
  return winAnsi([purpose, who, frDate(dateIso)].filter(Boolean).join(" — "));
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const w of winAnsi(para).split(" ")) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Filigrane en diagonale répété sur toute la page, plus un bandeau en bas : posé PAR-DESSUS le contenu. */
function stamp(page: PDFPage, text: string, font: PDFFont, n: number, total: number): void {
  const { width, height } = page.getSize();
  const size = Math.max(12, Math.min(18, width / 34));
  const w = font.widthOfTextAtSize(text, size);
  const stepX = w + 60;
  const stepY = 120;
  for (let y = -height; y < height * 2; y += stepY)
    for (let x = -width; x < width * 2; x += stepX)
      page.drawText(text, { x, y, size, font, color: MARK, opacity: 0.22, rotate: degrees(32) });
  const band = `${text} — page ${n}/${total}`;
  const bs = 8;
  page.drawRectangle({ x: 0, y: 0, width, height: 18, color: rgb(1, 1, 1), opacity: 0.85 });
  page.drawText(band, { x: 10, y: 6, size: bs, font, color: MARK });
}

interface Fonts {
  font: PDFFont;
  bold: PDFFont;
}

/** Ajoute les pages d'une pièce : image (une par page, à l'italienne si besoin), PDF copié (40 pages au plus), texte mis en page. */
async function appendPages(doc: PDFDocument, fonts: Fonts, title: string, pages: DossierPage[], skipped: DossierPdfResult["skipped"]): Promise<void> {
  const { font, bold } = fonts;
  for (const pg of pages) {
    try {
      if (pg.kind === "pdf") {
        const src = await PDFDocument.load(pg.bytes, { updateMetadata: false });
        const count = src.getPageCount();
        const idx = Array.from({ length: Math.min(count, MAX_PDF_PAGES) }, (_, i) => i);
        for (const p of await doc.copyPages(src, idx)) doc.addPage(p);
        if (count > MAX_PDF_PAGES) skipped.push({ title, reason: `seules les ${MAX_PDF_PAGES} premières pages sont incluses` });
      } else if (pg.kind === "text") {
        let page = doc.addPage(A4);
        let ty = A4[1] - MARGIN;
        page.drawText(winAnsi(title), { x: MARGIN, y: ty - 14, size: 14, font: bold, color: INK });
        ty -= 34;
        for (const l of wrap(pg.text.slice(0, 20_000), font, 10, A4[0] - 2 * MARGIN)) {
          if (ty < MARGIN + 24) {
            page = doc.addPage(A4);
            ty = A4[1] - MARGIN;
          }
          page.drawText(l, { x: MARGIN, y: ty - 10, size: 10, font, color: INK });
          ty -= 14;
        }
      } else {
        const img = pg.kind === "png" ? await doc.embedPng(pg.bytes) : await doc.embedJpg(pg.bytes);
        const landscape = img.width > img.height;
        const size: [number, number] = landscape ? [A4[1], A4[0]] : A4;
        const page = doc.addPage(size);
        const scale = Math.min((size[0] - 2 * 24) / img.width, (size[1] - 2 * 24 - 18) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (size[0] - w) / 2, y: 18 + (size[1] - 18 - h) / 2, width: w, height: h });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      skipped.push({
        title,
        reason: /encrypt/i.test(msg) ? "PDF protégé par un mot de passe : joins-le à part" : "page illisible, non incluse",
      });
    }
  }
}

/** Nom de fichier sûr tiré d'un titre (caractères interdits retirés, 60 caractères au plus). Jamais vide. */
export function safeFileName(title: string, fallback = "Papier"): string {
  const s = title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/[. ]+$/, "");
  return s || fallback;
}

export interface PagesPdfInput {
  title: string;
  pages: DossierPage[];
}

/** Toutes les pages d'un papier en un seul PDF, sans page de garde ni filigrane (partage d'un papier). */
export async function buildPagesPdf(input: PagesPdfInput): Promise<DossierPdfResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(input.title));
  doc.setCreator("Paperasse");
  doc.setProducer("Paperasse");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const skipped: DossierPdfResult["skipped"] = [];
  await appendPages(doc, { font, bold }, input.title, input.pages, skipped);
  const pages = doc.getPageCount();
  if (pages === 0) throw new Error("Aucune page lisible à mettre dans le PDF.");
  return { bytes: await doc.save(), pages, skipped };
}

export async function buildDossierPdf(input: DossierPdfInput): Promise<DossierPdfResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(winAnsi(input.title));
  doc.setCreator("Paperasse");
  doc.setProducer("Paperasse");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const skipped: DossierPdfResult["skipped"] = [];

  let cover = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const line = (s: string, size = 11, f = font, color = INK, indent = 0) => {
    for (const l of wrap(s, f, size, A4[0] - 2 * MARGIN - indent)) {
      if (y < MARGIN + 30) {
        cover = doc.addPage(A4);
        y = A4[1] - MARGIN;
      }
      cover.drawText(l, { x: MARGIN + indent, y: y - size, size, font: f, color });
      y -= size * 1.45;
    }
  };
  line(input.title, 22, bold);
  line(`Préparé le ${frDate(input.date)} avec Paperasse`, 11, font, MUTED);
  y -= 10;
  line(`Pièces jointes (${input.pieces.length})`, 14, bold);
  for (const p of input.pieces) line(`• ${p.label} : ${p.title}`, 11, font, INK, 8);
  if (input.missing.length) {
    y -= 8;
    line("Pièces fournies à part", 14, bold);
    for (const m of input.missing) line(`• ${m}`, 11, font, INK, 8);
  }
  y -= 8;
  line(`Ce dossier est réservé à cet usage : ${input.watermark}. Toute autre utilisation est interdite.`, 10, font, MUTED);

  for (const piece of input.pieces) await appendPages(doc, { font, bold }, piece.title, piece.pages, skipped);

  const pages = doc.getPages();
  pages.forEach((p, i) => stamp(p, input.watermark, bold, i + 1, pages.length));
  return { bytes: await doc.save(), pages: pages.length, skipped };
}
