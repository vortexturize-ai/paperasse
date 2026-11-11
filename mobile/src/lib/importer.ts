import type { SQLiteDatabase } from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { kindOfName, unpackArchive } from "../engine/archive";
import { createDocument } from "./documents";
import { MAX_PDF_BYTES, discardTemp, prepareImageAuto } from "./files";
import type { PendingPage } from "./types";

export { prepareImageAuto };

export interface IncomingItem {
  uri: string;
  mime: string;
  name: string;
  /** Texte partagé directement (SMS, mail copié). */
  text?: string;
}

export interface ImportReport {
  created: string[];
  failed: { name: string; reason: string }[];
  skipped: { name: string; reason: string }[];
}

function tmpDir(): Directory {
  const d = new Directory(Paths.cache, "import");
  d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Type d'un fichier reçu : d'abord son type annoncé, sinon son extension. */
export function kindOf(item: IncomingItem): "image" | "pdf" | "text" | "zip" | null {
  if (item.text !== undefined) return "text";
  const m = item.mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.includes("zip")) return "zip";
  if (m.startsWith("text/")) return "text";
  if (/\.zip$/i.test(item.name)) return "zip";
  return kindOfName(item.name)?.kind ?? null;
}

/** Ouvre une archive ZIP et range son contenu en fichiers temporaires. */
export async function itemsFromZip(item: IncomingItem): Promise<{ items: IncomingItem[]; skipped: { name: string; reason: string }[] }> {
  const bytes = await new File(item.uri).bytes();
  const { entries, skipped } = unpackArchive(bytes);
  const dir = tmpDir();
  const items: IncomingItem[] = [];
  for (const e of entries) {
    if (e.kind === "text") {
      items.push({ uri: "", mime: e.mime, name: e.name, text: new TextDecoder().decode(e.data) });
      continue;
    }
    // Nom de fichier tiré au hasard : le nom venu de l'archive n'est jamais utilisé comme chemin.
    const ext = e.kind === "pdf" ? "pdf" : (e.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z]/g, "");
    const f = new File(dir, `${randomUUID()}.${ext}`);
    await f.write(e.data);
    items.push({ uri: f.uri, mime: e.mime, name: e.name });
  }
  return { items, skipped };
}

/**
 * Range des fichiers reçus. `together` : toutes les photos forment un seul papier de plusieurs pages ;
 * sinon, un papier par fichier. Les PDF et les textes font toujours un papier chacun.
 */
export async function importItems(db: SQLiteDatabase, input: IncomingItem[], opts: { together: boolean; language: string }): Promise<ImportReport> {
  const report: ImportReport = { created: [], failed: [], skipped: [] };
  const items: IncomingItem[] = [];
  for (const it of input) {
    if (kindOf(it) === "zip") {
      try {
        const z = await itemsFromZip(it);
        items.push(...z.items);
        report.skipped.push(...z.skipped);
      } catch (e) {
        report.failed.push({ name: it.name, reason: e instanceof Error ? e.message : "archive illisible" });
      }
    } else if (kindOf(it)) items.push(it);
    else report.skipped.push({ name: it.name, reason: "type de fichier non pris en charge" });
  }

  const save = async (name: string, pages: PendingPage[], text?: string) => {
    try {
      const { id, analysisError } = await createDocument(db, pages, { read: true, language: opts.language, text, title: name.replace(/\.[a-z0-9]+$/i, "") });
      report.created.push(id);
      if (analysisError) report.failed.push({ name, reason: analysisError });
    } catch (e) {
      report.failed.push({ name, reason: e instanceof Error ? e.message : "enregistrement impossible" });
    }
  };

  const images = items.filter((i) => kindOf(i) === "image");
  if (opts.together && images.length > 1) {
    const pages: PendingPage[] = [];
    for (const img of images.slice(0, 10)) {
      try {
        pages.push(await prepareImageAuto(img.uri));
      } catch {
        report.failed.push({ name: img.name, reason: "image illisible" });
      } finally {
        discardTemp(img.uri);
      }
    }
    for (const img of images.slice(10)) discardTemp(img.uri);
    if (pages.length) await save(images[0].name, pages);
  } else {
    for (const img of images) {
      try {
        await save(img.name, [await prepareImageAuto(img.uri)]);
      } catch {
        report.failed.push({ name: img.name, reason: "image illisible" });
      } finally {
        discardTemp(img.uri);
      }
    }
  }
  for (const it of items) {
    const k = kindOf(it);
    if (k === "pdf") {
      const size = it.uri ? new File(it.uri).size : 0;
      if (size > MAX_PDF_BYTES) {
        report.failed.push({ name: it.name, reason: "PDF trop lourd (15 Mo maximum)" });
        discardTemp(it.uri);
        continue;
      }
      await save(it.name, [{ uri: it.uri, mime: "application/pdf", name: it.name }]);
    } else if (k === "text") {
      const text = it.text ?? (it.uri ? await new File(it.uri).text() : "");
      if (text.trim()) await save(it.name || "Texte partagé", [], text);
      discardTemp(it.uri);
    }
  }
  return report;
}
