import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from "expo-crypto";
import { Directory, File, FileMode, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  BackupError,
  BackupReader,
  BackupWriter,
  DOC_COLUMNS,
  ENTRY_DATA,
  HEADER_PREFIX,
  backupKey,
  chunkLength,
  decodeHeader,
  extensionFor,
  fileEntry,
  headerLength,
  newHeader,
  newRecoveryCode,
  planRestore,
  validateBackupData,
  type Aead,
  type BackupData,
  type BackupHeader,
  type BackupType,
} from "../engine/backup";
import { recoverySheet, type SheetInput } from "../engine/sheet";
import { refreshReminders } from "./documents";
import { fileFor, removeEmptyPageDir } from "./files";
import * as SecureStore from "./secureStore";
import { withLockSuspended } from "./suspend";
import type { VaultKind } from "./vaultKey";

export const nativeAead: Aead = {
  async seal(key, iv, plain, aad) {
    const k = await AESEncryptionKey.import(key);
    const sealed = await aesEncryptAsync(plain, k, { nonce: { bytes: iv }, additionalData: aad });
    return sealed.ciphertext({ includeTag: true, encoding: "bytes" }) as Promise<Uint8Array>;
  },
  async open(key, iv, sealed, aad) {
    const k = await AESEncryptionKey.import(key);
    return aesDecryptAsync(AESSealedData.fromParts(iv, sealed, 16), k, { additionalData: aad });
  },
};

// Une clé par coffre : la clé vue dans le coffre leurre n'ouvre jamais une sauvegarde du vrai coffre.
const CODE_IDS: Record<VaultKind, string> = { reel: "paperasse.sauvegarde.cle", leurre: "paperasse.sauvegarde.cle.leurre" };
const STORE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Clé de secours des sauvegardes complètes : créée une fois, gardée dans le coffre du téléphone. */
export async function backupCode(kind: VaultKind, renew = false): Promise<string> {
  const saved = renew ? null : await SecureStore.getItemAsync(CODE_IDS[kind], STORE);
  if (saved) return saved;
  const code = newRecoveryCode(getRandomBytes(28));
  await SecureStore.setItemAsync(CODE_IDS[kind], code, STORE);
  return code;
}

/** Une clé neuve pour chaque kit d'urgence (jamais gardée : elle est pour le proche). */
export function kitCode(): string {
  return newRecoveryCode(getRandomBytes(28));
}

export type Progress = (done: number, total: number) => void;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FileRowDb {
  id: string;
  document_id: string;
  position: number;
  path: string;
  mime: string;
}

/**
 * Écrit une sauvegarde (tout le coffre, ou seulement `docIds` pour un kit) dans un fichier du cache,
 * prêt à être partagé (Drive, iCloud, clé USB, mail…). Renvoie le fichier.
 */
export async function writeBackup(
  db: SQLiteDatabase,
  opts: { type: BackupType; code: string; docIds?: string[]; onProgress?: Progress },
): Promise<{ file: File; papers: number; missing: number }> {
  const all = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM documents ORDER BY created_at");
  const wanted = opts.docIds ? new Set(opts.docIds) : null;
  const docs = all.filter((d) => !wanted || wanted.has(String(d.id)));
  const ids = new Set(docs.map((d) => String(d.id)));
  const files = (await db.getAllAsync<FileRowDb>("SELECT * FROM files ORDER BY document_id, position")).filter((f) => ids.has(f.document_id));
  const settings =
    opts.type === "sauvegarde"
      ? (await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings")).map((s) => [s.key, s.value] as [string, string])
      : [];
  const usedPeople = new Set(docs.map((d) => d.person_id).filter((x): x is string => typeof x === "string"));
  const people = (await db.getAllAsync<{ id: string; name: string; relation: string }>("SELECT id, name, relation FROM people")).filter(
    (p) => opts.type === "sauvegarde" || usedPeople.has(p.id),
  );
  const data: BackupData = {
    v: 1,
    schema: 2,
    people,
    documents: docs.map((d) => Object.fromEntries(DOC_COLUMNS.map((c) => [c, (d[c] as string | number | null) ?? null]))) as BackupData["documents"],
    files: files.map((f) => ({ id: f.id, document_id: f.document_id, position: f.position, mime: f.mime })),
    settings,
  };

  const dir = new Directory(Paths.cache, "sauvegardes");
  dir.create({ intermediates: true, idempotent: true });
  const name = opts.type === "kit" ? `Paperasse-kit-urgence-${today()}.paperasse` : `Paperasse-sauvegarde-${today()}.paperasse`;
  const out = new File(dir, name);
  if (out.exists) out.delete();
  out.create();
  const handle = out.open(FileMode.WriteOnly);
  let missing = 0;
  try {
    const writer = new BackupWriter(backupKey(opts.code), newHeader(opts.type, new Date().toISOString(), getRandomBytes(8)), nativeAead);
    handle.writeBytesSync(writer.headerBytes);
    const write = async (chunks: Uint8Array[]) => {
      for (const c of chunks) await handle.writeBytes(c);
    };
    await write(await writer.add(ENTRY_DATA, new TextEncoder().encode(JSON.stringify(data))));
    for (const [i, f] of files.entries()) {
      opts.onProgress?.(i, files.length);
      const src = fileFor(f.path);
      if (!src.exists) {
        missing++;
        continue;
      }
      await write(await writer.add(fileEntry(f.id), await src.bytes()));
    }
    await write(await writer.finish());
    opts.onProgress?.(files.length, files.length);
  } catch (e) {
    handle.close();
    out.delete();
    throw e;
  }
  handle.close();
  return { file: out, papers: docs.length, missing };
}

export interface RestoreReport {
  type: BackupType;
  created: string;
  added: number;
  skipped: number;
  pages: number;
}

async function readExactly(h: ReturnType<File["open"]>, n: number): Promise<Uint8Array> {
  const b = await h.readBytes(n);
  if (b.length !== n) throw new BackupError("abime", "Ce fichier est abîmé ou incomplet.");
  return b;
}

/** Lit seulement l'en-tête (type et date), sans la clé. */
export async function peekBackup(uri: string): Promise<BackupHeader> {
  const h = new File(uri).open(FileMode.ReadOnly);
  try {
    const prefix = await h.readBytes(HEADER_PREFIX);
    const total = headerLength(prefix);
    const rest = await readExactly(h, total - HEADER_PREFIX);
    const all = new Uint8Array(total);
    all.set(prefix);
    all.set(rest, HEADER_PREFIX);
    return decodeHeader(all);
  } finally {
    h.close();
  }
}

/**
 * Restaure une sauvegarde ou un kit : ajoute les papiers absents de ce téléphone (rien n'est écrasé).
 * Les pages sont d'abord écrites à part ; la base n'est touchée qu'une fois tout lu et vérifié.
 */
const toHexId = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export async function restoreBackup(db: SQLiteDatabase, uri: string, code: string, onProgress?: Progress): Promise<RestoreReport> {
  const src = new File(uri);
  const size = src.size ?? 0;
  const h = src.open(FileMode.ReadOnly);
  const staging = new Directory(Paths.cache, `restauration-${Date.now()}`);
  staging.create({ intermediates: true, idempotent: true });
  try {
    const prefix = await h.readBytes(HEADER_PREFIX);
    const total = headerLength(prefix);
    const headerBytes = new Uint8Array(total);
    headerBytes.set(prefix);
    headerBytes.set(await readExactly(h, total - HEADER_PREFIX), HEADER_PREFIX);
    const header = decodeHeader(headerBytes);
    const reader = new BackupReader(backupKey(code), headerBytes, nativeAead);
    let data: BackupData | null = null;
    const got = new Set<string>();
    let read = total;
    for (;;) {
      const lenBytes = await h.readBytes(4);
      if (lenBytes.length === 0) break;
      if (lenBytes.length < 4) throw new BackupError("abime", "Ce fichier est abîmé ou incomplet.");
      const n = chunkLength(lenBytes);
      const sealed = await readExactly(h, n);
      read += 4 + n;
      onProgress?.(read, size);
      for (const entry of await reader.push(sealed)) {
        if (entry.name === ENTRY_DATA) {
          if (data) throw new BackupError("abime", "Ce fichier est abîmé ou incomplet.");
          try {
            data = validateBackupData(JSON.parse(new TextDecoder().decode(entry.data)));
          } catch (e) {
            if (e instanceof BackupError) throw e;
            throw new BackupError("abime", "Ce fichier est abîmé ou incomplet.");
          }
        } else {
          const id = entry.name.slice("fichier/".length);
          await new File(staging, id).write(entry.data);
          got.add(id);
        }
      }
    }
    reader.finish();
    if (!data) throw new BackupError("abime", "Ce fichier est abîmé ou incomplet.");

    const existing = new Set((await db.getAllAsync<{ id: string }>("SELECT id FROM documents")).map((r) => r.id));
    const plan = planRestore(data, existing, got);
    // Pages rangées à leur place définitive, puis la base en une seule transaction.
    const placed: { row: (typeof plan.files)[number]; path: string }[] = [];
    const cols = DOC_COLUMNS.join(", ");
    const marks = DOC_COLUMNS.map(() => "?").join(", ");
    const settings = header.type === "sauvegarde" ? data.settings : [];
    try {
      for (const f of plan.files) {
        const dir = new Directory(Paths.document, "docs", f.document_id);
        dir.create({ intermediates: true, idempotent: true });
        // Jamais par-dessus un fichier existant : l'autre coffre peut avoir restauré la même sauvegarde.
        let path = `docs/${f.document_id}/restaure-${f.id}.${extensionFor(f.mime)}`;
        if (fileFor(path).exists) path = `docs/${f.document_id}/restaure-${f.id}-${toHexId(getRandomBytes(4))}.${extensionFor(f.mime)}`;
        await new File(staging, f.id).move(fileFor(path));
        placed.push({ row: f, path });
      }
      // Pas de withExclusiveTransactionAsync : il ouvre une 2e connexion, sans la clé SQLCipher.
      await db.withTransactionAsync(async () => {
        for (const p of plan.people)
          await db.runAsync("INSERT OR IGNORE INTO people (id, name, relation, created_at) VALUES (?, ?, ?, ?)", p.id, p.name, p.relation, new Date().toISOString());
        for (const d of plan.documents) await db.runAsync(`INSERT OR IGNORE INTO documents (${cols}) VALUES (${marks})`, DOC_COLUMNS.map((c) => d[c]));
        for (const p of placed)
          await db.runAsync("INSERT OR IGNORE INTO files (id, document_id, position, path, mime) VALUES (?, ?, ?, ?, ?)", p.row.id, p.row.document_id, p.row.position, p.path, p.row.mime);
        for (const [k, v] of settings) await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", k, v);
      });
    } catch (e) {
      // Rien d'à moitié fait : on retire les pages déjà rangées (la transaction, elle, est annulée d'office).
      for (const p of placed) {
        try {
          const f = fileFor(p.path);
          if (f.exists) f.delete();
        } catch {
          // déjà parti
        }
        removeEmptyPageDir(p.row.document_id);
      }
      throw e;
    }
    for (const d of plan.documents) await refreshReminders(db, String(d.id)).catch(() => undefined);
    return { type: header.type, created: header.cree, added: plan.documents.length, skipped: plan.skipped, pages: placed.length };
  } finally {
    h.close();
    if (staging.exists) staging.delete();
  }
}

/** Fiche à imprimer (clé de secours + mode d'emploi, et contenu du kit). */
export async function writeSheet(input: SheetInput): Promise<File> {
  const dir = new Directory(Paths.cache, "sauvegardes");
  dir.create({ intermediates: true, idempotent: true });
  const out = new File(dir, input.type === "kit" ? `Kit-urgence-fiche-${today()}.pdf` : `Fiche-de-secours-${today()}.pdf`);
  if (out.exists) out.delete();
  await out.write(await recoverySheet(input));
  return out;
}

/** Partage un fichier (Drive, iCloud, clé USB, mail…) sans reverrouiller l'app pendant ce temps. */
export async function shareFile(file: File, mimeType: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage n’est pas disponible ici.");
  await withLockSuspended(() =>
    Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title, UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : "public.data" }),
  );
}

/** Efface les fichiers préparés dans le cache (ils ne doivent pas traîner sur le téléphone). */
export function cleanBackupCache(): void {
  try {
    const dir = new Directory(Paths.cache, "sauvegardes");
    if (dir.exists) dir.delete();
  } catch {
    // rien à faire
  }
}
