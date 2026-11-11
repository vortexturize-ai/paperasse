import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { CATEGORIES, categoryOf, docTypeLabel } from "./categories";
import { normalize, todayIso } from "./text";
import { isRelation, type Person, type Relation } from "../engine/people";
import type { Analysis, AnalysisStatus, DocFile, DocumentRecord } from "./types";

export const DATABASE_NAME = "paperasse.db";
const SCHEMA_VERSION = 2;

/** Appelé une fois au démarrage par <SQLiteProvider onInit>. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        doc_type TEXT NOT NULL DEFAULT 'autre',
        category TEXT NOT NULL DEFAULT 'autre',
        issuer TEXT,
        doc_date TEXT,
        summary TEXT,
        to_do INTEGER NOT NULL DEFAULT 0,
        actions TEXT NOT NULL DEFAULT '[]',
        urgency TEXT NOT NULL DEFAULT 'aucune',
        deadline TEXT,
        deadline_label TEXT,
        deadline_quote TEXT,
        expiry_date TEXT,
        amount REAL,
        amount_direction TEXT,
        key_facts TEXT NOT NULL DEFAULT '[]',
        keywords TEXT NOT NULL DEFAULT '[]',
        full_text TEXT,
        warning TEXT,
        is_done INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        analysis_status TEXT NOT NULL DEFAULT 'none',
        analysis_lang TEXT,
        notification_ids TEXT NOT NULL DEFAULT '[]',
        search_text TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_documents_category ON documents(category);
      CREATE INDEX idx_documents_deadline ON documents(deadline);
      CREATE INDEX idx_documents_expiry ON documents(expiry_date);
      CREATE TABLE files (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        path TEXT NOT NULL,
        mime TEXT NOT NULL
      );
      CREATE INDEX idx_files_document ON files(document_id);
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }
  if (version < 2) {
    // Famille et aidants : les papiers d'un proche (person_id), NULL = moi.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT 'proche',
        created_at TEXT NOT NULL
      );
      ALTER TABLE documents ADD COLUMN person_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_documents_person ON documents(person_id);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export type SettingKey =
  | "lock_enabled"
  | "capture_block"
  | "easy_read"
  | "backup_last"
  | "reminders_mode"
  | "language"
  | "sender"
  | "onboarding_done"
  | `learn:${string}`
  | `life:${string}`;

export async function getSetting(db: SQLiteDatabase, key: SettingKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

interface DocumentRow {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  doc_type: string;
  category: string;
  issuer: string | null;
  doc_date: string | null;
  summary: string | null;
  to_do: number;
  actions: string;
  urgency: string;
  deadline: string | null;
  deadline_label: string | null;
  deadline_quote: string | null;
  expiry_date: string | null;
  amount: number | null;
  amount_direction: string | null;
  key_facts: string;
  keywords: string;
  full_text: string | null;
  warning: string | null;
  is_done: number;
  is_favorite: number;
  analysis_status: string;
  analysis_lang: string | null;
  notification_ids: string;
  person_id: string | null;
}

function parseList<T>(json: string): T[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function toRecord(r: DocumentRow): DocumentRecord {
  return {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    title: r.title,
    docType: r.doc_type,
    category: categoryOf(r.category),
    issuer: r.issuer,
    docDate: r.doc_date,
    summary: r.summary,
    toDo: r.to_do === 1,
    actions: parseList<string>(r.actions),
    urgency: (["aucune", "faible", "moyenne", "haute"].includes(r.urgency) ? r.urgency : "aucune") as DocumentRecord["urgency"],
    deadline: r.deadline,
    deadlineLabel: r.deadline_label,
    deadlineQuote: r.deadline_quote,
    expiryDate: r.expiry_date,
    amount: r.amount,
    amountDirection: r.amount_direction as DocumentRecord["amountDirection"],
    keyFacts: parseList<{ label: string; valeur: string }>(r.key_facts),
    keywords: parseList<string>(r.keywords),
    fullText: r.full_text,
    warning: r.warning,
    isDone: r.is_done === 1,
    isFavorite: r.is_favorite === 1,
    analysisStatus: r.analysis_status as AnalysisStatus,
    analysisLang: r.analysis_lang,
    notificationIds: parseList<string>(r.notification_ids),
    personId: r.person_id ?? null,
  };
}

function buildSearchText(parts: (string | null | undefined)[]): string {
  return normalize(parts.filter(Boolean).join(" \n "));
}

const now = () => new Date().toISOString();

export interface NewDocument {
  title: string;
  category: string;
  docType?: string;
}

/** Crée le document et ses fichiers (déjà copiés dans le dossier de l'app). */
export async function insertDocument(
  db: SQLiteDatabase,
  id: string,
  doc: NewDocument,
  files: { path: string; mime: string }[],
): Promise<void> {
  const ts = now();
  const category = categoryOf(doc.category);
  const docType = doc.docType ?? "autre";
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO documents (id, created_at, updated_at, title, doc_type, category, search_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      ts,
      ts,
      doc.title,
      docType,
      category,
      buildSearchText([doc.title, CATEGORIES[category].label, docTypeLabel(docType)]),
    );
    for (const [position, f] of files.entries()) {
      await db.runAsync(
        "INSERT INTO files (id, document_id, position, path, mime) VALUES (?, ?, ?, ?, ?)",
        randomUUID(),
        id,
        position,
        f.path,
        f.mime,
      );
    }
  });
}

export async function applyAnalysis(db: SQLiteDatabase, id: string, a: Analysis, lang: string): Promise<void> {
  const category = categoryOf(a.categorie);
  const search = buildSearchText([
    a.titre,
    docTypeLabel(a.type_document),
    CATEGORIES[category].label,
    a.emetteur,
    a.resume,
    a.mots_cles.join(" "),
    a.infos_cles.map((k) => `${k.label} ${k.valeur}`).join(" "),
    a.texte,
  ]);
  await db.runAsync(
    `UPDATE documents SET
       updated_at = ?, title = ?, doc_type = ?, category = ?, issuer = ?, doc_date = ?,
       summary = ?, to_do = ?, actions = ?, urgency = ?, deadline = ?, deadline_label = ?,
       deadline_quote = ?, expiry_date = ?, amount = ?, amount_direction = ?, key_facts = ?,
       keywords = ?, full_text = ?, warning = ?, analysis_status = 'done', analysis_lang = ?,
       search_text = ?
     WHERE id = ?`,
    now(),
    a.titre,
    a.type_document,
    category,
    a.emetteur,
    a.date_document,
    a.resume,
    a.a_traiter ? 1 : 0,
    JSON.stringify(a.actions),
    a.urgence,
    a.date_limite,
    a.date_limite_objet,
    a.date_limite_extrait,
    a.date_expiration,
    a.montant,
    a.montant_sens,
    JSON.stringify(a.infos_cles),
    JSON.stringify(a.mots_cles),
    a.texte,
    a.avertissement,
    lang,
    search,
    id,
  );
}

export async function setAnalysisStatus(db: SQLiteDatabase, id: string, status: AnalysisStatus): Promise<void> {
  await db.runAsync("UPDATE documents SET analysis_status = ?, updated_at = ? WHERE id = ?", status, now(), id);
}

export async function updateDocument(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<{ title: string; category: string; isDone: boolean; isFavorite: boolean; notificationIds: string[] }>,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title);
  }
  if (patch.category !== undefined) {
    sets.push("category = ?");
    values.push(categoryOf(patch.category));
  }
  if (patch.isDone !== undefined) {
    sets.push("is_done = ?");
    values.push(patch.isDone ? 1 : 0);
  }
  if (patch.isFavorite !== undefined) {
    sets.push("is_favorite = ?");
    values.push(patch.isFavorite ? 1 : 0);
  }
  if (patch.notificationIds !== undefined) {
    sets.push("notification_ids = ?");
    values.push(JSON.stringify(patch.notificationIds));
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(now());
  await db.runAsync(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`, ...values, id);
  if (patch.title !== undefined || patch.category !== undefined) await refreshSearchText(db, id);
}

/** Recalcule le texte de recherche après un renommage ou un changement de dossier. */
async function refreshSearchText(db: SQLiteDatabase, id: string): Promise<void> {
  const d = await getDocument(db, id);
  if (!d) return;
  const search = buildSearchText([
    d.title,
    docTypeLabel(d.docType),
    CATEGORIES[categoryOf(d.category)].label,
    d.issuer,
    d.summary,
    d.keywords.join(" "),
    d.keyFacts.map((k) => `${k.label} ${k.valeur}`).join(" "),
    d.fullText,
  ]);
  await db.runAsync("UPDATE documents SET search_text = ? WHERE id = ?", search, id);
}

export async function getDocument(db: SQLiteDatabase, id: string): Promise<DocumentRecord | null> {
  const r = await db.getFirstAsync<DocumentRow>("SELECT * FROM documents WHERE id = ?", id);
  return r ? toRecord(r) : null;
}

export async function getFiles(db: SQLiteDatabase, documentId: string): Promise<DocFile[]> {
  const rows = await db.getAllAsync<{ id: string; document_id: string; position: number; path: string; mime: string }>(
    "SELECT * FROM files WHERE document_id = ? ORDER BY position",
    documentId,
  );
  return rows.map((r) => ({ id: r.id, documentId: r.document_id, position: r.position, path: r.path, mime: r.mime }));
}

/** Tous les papiers (pour le calendrier, le chasseur d'argent, les dossiers prêts). */
export async function listAll(db: SQLiteDatabase): Promise<DocumentRecord[]> {
  const rows = await db.getAllAsync<DocumentRow>("SELECT * FROM documents ORDER BY COALESCE(doc_date, created_at) DESC");
  return rows.map(toRecord);
}

export async function listRecent(db: SQLiteDatabase, limit = 10): Promise<DocumentRecord[]> {
  const rows = await db.getAllAsync<DocumentRow>("SELECT * FROM documents ORDER BY created_at DESC LIMIT ?", limit);
  return rows.map(toRecord);
}

/** Courriers à traiter, le plus pressé d'abord (sans date limite en dernier). */
export async function listToDo(db: SQLiteDatabase): Promise<DocumentRecord[]> {
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT * FROM documents WHERE to_do = 1 AND is_done = 0
     ORDER BY deadline IS NULL, deadline, CASE urgency WHEN 'haute' THEN 0 WHEN 'moyenne' THEN 1 ELSE 2 END, created_at DESC`,
  );
  return rows.map(toRecord);
}

/** Expirations dans les N prochains jours (ou déjà dépassées depuis moins de 30 jours). */
export async function listExpiring(db: SQLiteDatabase, horizonDays = 90): Promise<DocumentRecord[]> {
  const today = todayIso();
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT * FROM documents
     WHERE expiry_date IS NOT NULL
       AND expiry_date >= date(?, '-30 days') AND expiry_date <= date(?, ?)
     ORDER BY expiry_date`,
    today,
    today,
    `+${horizonDays} days`,
  );
  return rows.map(toRecord);
}

export async function listByCategory(db: SQLiteDatabase, category: string): Promise<DocumentRecord[]> {
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents WHERE category = ? ORDER BY COALESCE(doc_date, substr(created_at, 1, 10)) DESC",
    category,
  );
  return rows.map(toRecord);
}

export async function countByCategory(db: SQLiteDatabase): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ category: string; n: number }>(
    "SELECT category, COUNT(*) AS n FROM documents GROUP BY category",
  );
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

/** Recherche sans accents : tous les mots doivent apparaître. */
export async function searchDocuments(db: SQLiteDatabase, query: string): Promise<DocumentRecord[]> {
  const terms = normalize(query)
    .split(/\s+/)
    .map((t) => t.replace(/[%_\\]/g, ""))
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (terms.length === 0) return [];
  const where = terms.map(() => "search_text LIKE ? ESCAPE '\\'").join(" AND ");
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT * FROM documents WHERE ${where} ORDER BY created_at DESC LIMIT 50`,
    ...terms.map((t) => `%${t}%`),
  );
  return rows.map(toRecord);
}

export async function deleteDocumentRow(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM documents WHERE id = ?", id);
}

export async function listPeople(db: SQLiteDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; relation: string }>("SELECT id, name, relation FROM people ORDER BY created_at");
  return rows.map((r) => ({ id: r.id, name: r.name, relation: isRelation(r.relation) ? r.relation : "proche" }));
}

export async function addPerson(db: SQLiteDatabase, name: string, relation: Relation): Promise<string> {
  const id = randomUUID();
  await db.runAsync("INSERT INTO people (id, name, relation, created_at) VALUES (?, ?, ?, ?)", id, name, relation, now());
  return id;
}

/** Retire une personne : ses papiers restent dans le coffre et reviennent à « moi ». */
export async function removePerson(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE documents SET person_id = NULL WHERE person_id = ?", id);
    await db.runAsync("DELETE FROM people WHERE id = ?", id);
  });
}

export async function setDocumentPerson(db: SQLiteDatabase, docId: string, personId: string | null): Promise<void> {
  await db.runAsync("UPDATE documents SET person_id = ?, updated_at = ? WHERE id = ?", personId, now(), docId);
}
