import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { analyzeText } from "../engine/analyze";
import { langFromName } from "../engine/i18n";
import { fold } from "../engine/normalize";
import {
  applyAnalysis,
  deleteDocumentRow,
  getDocument,
  getFiles,
  getSetting,
  insertDocument,
  setAnalysisStatus,
  setSetting,
  updateDocument,
} from "./db";
import { deleteDocumentFiles, deletePages, storePages, uriFor } from "./files";
import { cancelReminders, scheduleReminders } from "./notifications";
import { readPdf } from "./pdfread";
import { readImages } from "./ocr";
import { formatDate, todayIso } from "./text";
import type { DocumentRecord, PendingPage } from "./types";

export interface CreateOptions {
  /** Lire le papier avec le moteur (photos lues sur le téléphone, ou texte collé). */
  read: boolean;
  language: string;
  /** Texte collé (courriel, SMS…) : pas de photo à lire. */
  text?: string;
  /** Nom et dossier choisis à la main (quand rien n'est lu). */
  title?: string;
  category?: string;
}

/**
 * Enregistre les pages, crée le papier, puis le lit avec le moteur Paperasse.
 * Le papier est gardé même si la lecture échoue : on pourra la relancer.
 */
export async function createDocument(
  db: SQLiteDatabase,
  pages: PendingPage[],
  opts: CreateOptions,
): Promise<{ id: string; analysisError: string | null }> {
  const id = randomUUID();
  let stored: { path: string; mime: string }[] = [];
  try {
    stored = await storePages(id, pages);
  } catch (e) {
    deleteDocumentFiles(id);
    throw e;
  }
  const title = opts.title?.trim() || `Papier du ${formatDate(todayIso())}`;
  await insertDocument(db, id, { title, category: opts.category ?? "autre" }, stored);

  if (!opts.read) return { id, analysisError: null };
  try {
    await runAnalysis(db, id, opts.language, opts.text);
    return { id, analysisError: null };
  } catch (e) {
    return { id, analysisError: e instanceof Error ? e.message : "Lecture impossible." };
  }
}

/** Le texte du papier : texte fourni, sinon photos et PDF lus sur le téléphone, sinon texte déjà enregistré. */
async function textOf(db: SQLiteDatabase, id: string, provided?: string): Promise<string> {
  if (provided?.trim()) return provided;
  const files = await getFiles(db, id);
  const parts: string[] = [];
  const images = files.filter((f) => f.mime.startsWith("image/"));
  if (images.length > 0) parts.push(await readImages(images.map((f) => uriFor(f.path))));
  for (const pdf of files.filter((f) => f.mime === "application/pdf")) parts.push(await readPdf(uriFor(pdf.path)));
  const text = parts.join("\n\n").trim();
  if (text) return text;
  const doc = await getDocument(db, id);
  if (doc?.fullText?.trim()) return doc.fullText;
  throw new Error("Je n'ai trouvé aucun texte à lire sur ce papier.");
}

/** Lit (ou relit) un papier avec le moteur, puis programme ses rappels. */
export async function runAnalysis(db: SQLiteDatabase, id: string, language: string, text?: string): Promise<void> {
  try {
    const raw = await textOf(db, id, text);
    const result = analyzeText(raw, { today: todayIso(), language: langFromName(language) });
    // Le moteur apprend des corrections : même organisme → même dossier que la dernière fois.
    if (result.emetteur) {
      const learned = await getSetting(db, `learn:${fold(result.emetteur)}`);
      if (learned) result.categorie = learned;
    }
    await applyAnalysis(db, id, result, language);
  } catch (e) {
    await setAnalysisStatus(db, id, "error");
    throw e;
  }
  await refreshReminders(db, id);
}

/** Retient le dossier choisi à la main pour les prochains papiers du même organisme. */
export async function rememberCategory(db: SQLiteDatabase, doc: DocumentRecord, category: string): Promise<void> {
  if (doc.issuer && category !== doc.category) await setSetting(db, `learn:${fold(doc.issuer)}`, category);
}

export async function refreshReminders(db: SQLiteDatabase, id: string): Promise<void> {
  const doc = await getDocument(db, id);
  if (!doc) return;
  const ids = await scheduleReminders(doc);
  await updateDocument(db, id, { notificationIds: ids });
}

export async function setDone(db: SQLiteDatabase, doc: DocumentRecord, done: boolean): Promise<void> {
  await updateDocument(db, doc.id, { isDone: done });
  await refreshReminders(db, doc.id);
}

export async function removeDocument(db: SQLiteDatabase, doc: DocumentRecord): Promise<void> {
  await cancelReminders(doc.notificationIds);
  const pages = (await getFiles(db, doc.id)).map((f) => f.path);
  await deleteDocumentRow(db, doc.id);
  deletePages(doc.id, pages);
}
