import type { SQLiteDatabase } from "expo-sqlite";
import { findTextDuplicate, type DuplicateInput, type DuplicateKind } from "../engine/duplicates";
import { getDocument, getFiles, listAll } from "./db";
import { fileFor } from "./files";
import { formatDate, todayIso } from "./text";
import type { DocumentRecord } from "./types";

export interface Duplicate {
  /** Le papier déjà rangé. */
  doc: DocumentRecord;
  /** « fichier » : mêmes photos ou même PDF, octet pour octet. */
  kind: "fichier" | DuplicateKind;
}

function input(d: DocumentRecord): DuplicateInput {
  return {
    id: d.id,
    fullText: d.fullText,
    docDate: d.docDate,
    amount: d.amount,
    deadline: d.deadline,
    expiryDate: d.expiryDate,
    issuer: d.issuer,
    amountDirection: d.amountDirection,
  };
}

function sizeOf(path: string): number {
  try {
    return fileFor(path).size ?? -1;
  } catch {
    return -1;
  }
}

/**
 * Un autre papier qui a exactement les mêmes fichiers (même photo choisie deux fois, même PDF reçu deux fois).
 * Les tailles d'abord : un fichier n'est lu et haché que si un autre a exactement la même taille.
 */
async function sameFilesAs(db: SQLiteDatabase, id: string): Promise<string | null> {
  const mine = await getFiles(db, id);
  if (mine.length === 0) return null;
  const rows = await db.getAllAsync<{ document_id: string; path: string }>("SELECT document_id, path FROM files WHERE document_id != ?", id);
  const bySize = new Map<number, { document_id: string; path: string }[]>();
  for (const r of rows) {
    const size = sizeOf(r.path);
    if (size > 0) bySize.set(size, [...(bySize.get(size) ?? []), r]);
  }
  const hashes = new Map<string, string>();
  const hash = async (path: string): Promise<string> => {
    let h = hashes.get(path);
    if (h === undefined) {
      h = await fileFor(path).digest("SHA-256");
      hashes.set(path, h);
    }
    return h;
  };
  // Toutes les pages du nouveau papier doivent se retrouver dans un même papier déjà rangé.
  let candidates: Set<string> | null = null;
  for (const page of mine) {
    const same = bySize.get(sizeOf(page.path)) ?? [];
    if (same.length === 0) return null;
    const mineHash = await hash(page.path);
    const docs = new Set<string>();
    for (const other of same) if (!candidates || candidates.has(other.document_id)) if ((await hash(other.path)) === mineHash) docs.add(other.document_id);
    candidates = docs;
    if (candidates.size === 0) return null;
  }
  return candidates ? ([...candidates][0] ?? null) : null;
}

/** Le papier déjà rangé dont `id` (tout juste ajouté et lu) est sans doute un double, s'il y en a un. */
export async function findDuplicate(db: SQLiteDatabase, id: string): Promise<Duplicate | null> {
  try {
    const sameFile = await sameFilesAs(db, id);
    const doc = sameFile ? await getDocument(db, sameFile) : null;
    if (doc) return { doc, kind: "fichier" };
  } catch {
    // empreinte impossible (web, fichier illisible) : on passe au texte
  }
  const mine = await getDocument(db, id);
  if (!mine?.fullText?.trim()) return null;
  const others = (await listAll(db)).filter((d) => d.id !== id);
  const hit = findTextDuplicate(input(mine), others.map(input));
  const doc = hit ? others.find((d) => d.id === hit.id) : undefined;
  return hit && doc ? { doc, kind: hit.kind } : null;
}

/** Ce que dit la fenêtre « Tu l'as déjà ? ». */
export function duplicateText(dup: Duplicate): { title: string; message: string } {
  const what = `« ${dup.doc.title} », rangé le ${formatDate(todayIso(new Date(dup.doc.createdAt)))}`;
  if (dup.kind === "fichier") return { title: "Tu l’as déjà", message: `C’est le même fichier que ${what}.` };
  if (dup.kind === "identique") return { title: "Tu l’as déjà", message: `Il a exactement le même texte que ${what}.` };
  return { title: "Tu l’as peut-être déjà", message: `Il ressemble beaucoup à ${what}. C’est peut-être le même papier.` };
}
