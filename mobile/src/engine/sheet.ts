import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatRecoveryCode } from "./backup.ts";

export interface SheetInput {
  type: "sauvegarde" | "kit";
  code: string;
  /** Date du jour, AAAA-MM-JJ. */
  date: string;
  fileName: string;
  /** Kit : titres des papiers inclus. */
  papers?: string[];
  /** Kit : à qui il est destiné (facultatif). */
  forName?: string;
  /** Kit : un mot pour le proche (facultatif). */
  message?: string;
}

/** Les polices standard des PDF ne savent écrire que l'alphabet latin : le reste devient « ? ». */
export function winAnsi(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF’‘“”–—…€œŒ•]/gu, "?")
    .trim();
}

function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.17, 0.14, 0.25);
const MUTED = rgb(0.37, 0.34, 0.46);
const ORANGE = rgb(1, 0.54, 0.12);

class Writer {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, mono: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.mono = mono;
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  room(h: number): void {
    if (this.y - h < MARGIN) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - MARGIN;
    }
  }

  text(s: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}): void {
    const size = opts.size ?? 11;
    const font = opts.font ?? this.font;
    const width = A4[0] - 2 * MARGIN - (opts.indent ?? 0);
    const words = winAnsi(s).split(" ");
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.room(size * 1.4);
      this.page.drawText(l, { x: MARGIN + (opts.indent ?? 0), y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size * 1.4;
    }
    this.y -= opts.gap ?? 6;
  }
}

export async function recoverySheet(input: SheetInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const kit = input.type === "kit";
  doc.setTitle(kit ? "Kit d’urgence Paperasse" : "Fiche de secours Paperasse");
  doc.setCreator("Paperasse");
  doc.setProducer("Paperasse");
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
    await doc.embedFont(StandardFonts.CourierBold),
  );

  w.text(kit ? "Kit d’urgence Paperasse" : "Fiche de secours Paperasse", { size: 24, font: w.bold, gap: 4 });
  w.text(`Faite le ${frDate(input.date)}${kit && input.forName ? ` — pour ${input.forName}` : ""}`, { color: MUTED, gap: 16 });

  w.text(
    kit
      ? "Cette fiche va avec le fichier « " + input.fileName + " ». Ensemble, ils permettent d’ouvrir les papiers importants que j’ai choisis de te confier, si un jour j’en ai besoin ou si quelque chose m’arrive."
      : "Cette fiche va avec le fichier « " + input.fileName + " » : la sauvegarde chiffrée de tous tes papiers. Sans la clé ci-dessous, personne ne peut lire ce fichier — ni nous, ni ton fournisseur de cloud.",
    { gap: 12 },
  );
  if (kit && input.message) w.text(`« ${input.message} »`, { font: w.bold, gap: 12 });

  w.text("Clé de secours", { size: 14, font: w.bold, gap: 4 });
  const code = formatRecoveryCode(input.code);
  w.room(44);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 40, width: A4[0] - 2 * MARGIN, height: 40, borderColor: ORANGE, borderWidth: 2 });
  w.page.drawText(code, { x: MARGIN + 14, y: w.y - 27, size: 18, font: w.mono, color: INK });
  w.y -= 52;
  w.text("Les lettres O et I n’existent pas dans la clé : ce sont des zéros et des uns.", { size: 9, color: MUTED, gap: 16 });

  w.text("Pour ouvrir le fichier", { size: 14, font: w.bold, gap: 4 });
  const steps = [
    "Installe l’application Paperasse sur un téléphone.",
    "Ouvre Réglages, puis « Restaurer une sauvegarde ».",
    `Choisis le fichier « ${input.fileName} » (Drive, iCloud, clé USB, mail…).`,
    "Tape la clé de secours ci-dessus. Les papiers s’ajoutent, rien n’est effacé.",
  ];
  steps.forEach((s, i) => w.text(`${i + 1}. ${s}`, { indent: 8, gap: 2 }));
  w.y -= 12;

  w.text("À savoir", { size: 14, font: w.bold, gap: 4 });
  for (const s of [
    "Range cette fiche à part du fichier (pas dans le même mail, pas dans le même dossier).",
    "Quelqu’un qui a les deux peut lire les papiers : garde-la comme une clé de maison.",
    "Paperasse ne garde aucune copie de tes papiers et ne peut pas retrouver une clé perdue.",
  ])
    w.text(`• ${s}`, { indent: 8, gap: 2 });
  w.y -= 12;

  if (kit && input.papers?.length) {
    w.text(`Ce que contient le kit (${input.papers.length} papier${input.papers.length > 1 ? "s" : ""})`, { size: 14, font: w.bold, gap: 4 });
    for (const p of input.papers.slice(0, 120)) w.text(`• ${p}`, { indent: 8, gap: 1 });
    if (input.papers.length > 120) w.text(`… et ${input.papers.length - 120} autres.`, { indent: 8 });
  }

  return doc.save();
}
