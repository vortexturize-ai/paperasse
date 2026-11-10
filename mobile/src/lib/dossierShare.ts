import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { buildDossierPdf, watermarkText, type DossierPage, type DossierPiece } from "../engine/dossierPdf";
import type { DossierResult } from "../engine/dossiers";
import { getFiles } from "./db";
import { fileFor } from "./files";
import { todayIso } from "./text";

function kindOf(mime: string): "jpeg" | "png" | "pdf" | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "application/pdf") return "pdf";
  return null;
}

export async function writeDossierPdf(
  db: SQLiteDatabase,
  result: DossierResult,
  recipient: string,
): Promise<{ file: File; pages: number; skipped: { title: string; reason: string }[] }> {
  const pieces: DossierPiece[] = [];
  for (const item of result.items) {
    for (const paper of item.papers) {
      const pages: DossierPage[] = [];
      for (const f of await getFiles(db, paper.id)) {
        const kind = kindOf(f.mime);
        const src = fileFor(f.path);
        if (!kind || !src.exists) continue;
        const bytes = await src.bytes();
        pages.push(kind === "pdf" ? { kind: "pdf", bytes } : { kind, bytes });
      }
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
