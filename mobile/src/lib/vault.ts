import type { SQLiteDatabase } from "expo-sqlite";
import { langFromName, type Lang } from "../engine/i18n";
import { ISSUERS } from "../engine/issuers";
import type { Paper } from "../engine/vault";
import { DOC_TYPES, type DocType } from "./categories";
import { getSetting, listAll } from "./db";
import type { DocumentRecord } from "./types";

const ISSUER_IDS = new Set(ISSUERS.map((i) => i.id));

/** L'organisme reconnu (son identifiant figure dans les mots-clés de la fiche). */
export function organismeOf(doc: DocumentRecord): string | null {
  return doc.keywords.find((k) => ISSUER_IDS.has(k)) ?? null;
}

export function toPaper(doc: DocumentRecord): Paper {
  const type = (doc.docType in DOC_TYPES ? doc.docType : "autre") as DocType;
  return {
    id: doc.id,
    title: doc.title,
    type,
    category: doc.category,
    issuer: doc.issuer,
    organisme: organismeOf(doc),
    docDate: doc.docDate,
    deadline: doc.deadline,
    expiry: doc.expiryDate,
    amount: doc.amount,
    amountDirection: doc.amountDirection,
    text: doc.fullText ?? "",
    done: doc.isDone,
    added: doc.createdAt.slice(0, 10),
  };
}

export async function loadPapers(db: SQLiteDatabase): Promise<Paper[]> {
  return (await listAll(db)).map(toPaper);
}

export async function userLang(db: SQLiteDatabase): Promise<Lang> {
  return langFromName(await getSetting(db, "language"));
}
