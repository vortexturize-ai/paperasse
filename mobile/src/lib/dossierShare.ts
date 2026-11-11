import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { buildDossierPdf, buildPagesPdf, safeFileName, summaryLine, watermarkText, type DossierPage, type DossierPiece } from "../engine/dossierPdf";
import type { DossierResult } from "../engine/dossiers";
import { docTypeLabel } from "./categories";
import { getFiles } from "./db";
import { fileFor } from "./files";
import { todayIso } from "./text";
import type { DocumentRecord } from "./types";

function kindOf(mime: string): "jpeg" | "png" | "pdf" | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "application/pdf") return "pdf";
  return null;
}

/** Pages d'un papier telles qu'enregistrées (photos, PDF), dans l'ordre, prêtes pour le PDF. */
async function pagesOf(db: SQLiteDatabase, paperId: string): Promise<DossierPage[]> {
  const pages: DossierPage[] = [];
  for (const f of await getFiles(db, paperId)) {
    const kind = kindOf(f.mime);
    const src = fileFor(f.path);
    if (!kind || !src.exists) continue;
    const bytes = await src.bytes();
    pages.push(kind === "pdf" ? { kind: "pdf", bytes } : { kind, bytes });
  }
  return pages;
}

export async function writeDossierPdf(
  db: SQLiteDatabase,
  result: DossierResult,
  recipient: string,
): Promise<{ file: File; pages: number; skipped: { title: string; reason: string }[] }> {
  const pieces: DossierPiece[] = [];
  for (const item of result.items) {
    for (const paper of item.papers) {
      const pages = await pagesOf(db, paper.id);
      if (pages.length === 0 && paper.text.trim()) pages.push({ kind: "text", text: paper.text });
      pieces.push({ label: item.requirement.label, title: paper.title, pages });
    }
  }
  const missing = result.items.filter((i) => i.status !== "ok" && !i.requirement.optional).map((i) => i.requirement.label);
  const date = todayIso();
  const r = await buildDossierPdf({
    title: `Dossier — ${result.template.title}`,
    watermark: watermarkText(result.template.purpose, recipient, date),
    date,
    pieces,
    missing,
  });
  const dir = new Directory(Paths.cache, "dossiers");
  dir.create({ intermediates: true, idempotent: true });
  const out = new File(dir, `Dossier-${result.template.id}-${date}.pdf`);
  if (out.exists) out.delete();
  await out.write(r.bytes);
  return { file: out, pages: r.pages, skipped: r.skipped };
}

/**
 * Dossier remis à un accompagnant (assistante sociale, CCAS, France Services…) : les papiers choisis, une page de garde
 * avec le résumé de chacun, un filigrane « motif — destinataire — date » sur chaque page.
 */
export async function writeCompanionPdf(
  db: SQLiteDatabase,
  input: { title: string; purpose: string; recipient: string; papers: DocumentRecord[] },
): Promise<{ file: File; pages: number; skipped: { title: string; reason: string }[] }> {
  const pieces: DossierPiece[] = [];
  for (const paper of input.papers) {
    const pages = await pagesOf(db, paper.id);
    if (pages.length === 0 && paper.fullText?.trim()) pages.push({ kind: "text", text: paper.fullText });
    pieces.push({ label: docTypeLabel(paper.docType), title: paper.title, pages });
  }
  const date = todayIso();
  const r = await buildDossierPdf({
    title: input.title,
    watermark: watermarkText(input.purpose, input.recipient, date),
    date,
    pieces,
    missing: [],
    notes: input.papers.map((p) =>
      summaryLine({
        title: p.title,
        issuer: p.issuer,
        docDate: p.docDate,
        deadline: p.deadline,
        deadlineLabel: p.deadlineLabel,
        expiry: p.expiryDate,
        amount: p.amount,
        amountDirection: p.amountDirection,
        done: p.isDone,
      }),
    ),
  });
  const dir = new Directory(Paths.cache, "dossiers");
  dir.create({ intermediates: true, idempotent: true });
  const out = new File(dir, `${safeFileName(input.title, "Dossier")}-${date}.pdf`);
  if (out.exists) out.delete();
  await out.write(r.bytes);
  return { file: out, pages: r.pages, skipped: r.skipped };
}

/**
 * Toutes les pages d'un papier en un seul PDF (sans filigrane), dans le cache, pour le partager.
 * Le fichier de l'envoi précédent est effacé d'abord ; le dossier est balayé à chaque ouverture du coffre.
 */
export async function writePaperPdf(
  db: SQLiteDatabase,
  paper: { id: string; title: string },
): Promise<{ file: File; pages: number; skipped: { title: string; reason: string }[] }> {
  const r = await buildPagesPdf({ title: paper.title, pages: await pagesOf(db, paper.id) });
  const dir = new Directory(Paths.cache, "partage");
  try {
    if (dir.exists) dir.delete();
  } catch {
    // envoi précédent encore ouvert ailleurs : on écrit à côté
  }
  dir.create({ intermediates: true, idempotent: true });
  const out = new File(dir, `${safeFileName(paper.title)}.pdf`);
  if (out.exists) out.delete();
  await out.write(r.bytes);
  return { file: out, pages: r.pages, skipped: r.skipped };
}
