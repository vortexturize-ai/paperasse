import { getRandomBytes } from "expo-crypto";
import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { defaultDatabaseDirectory, deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { migrate, setSetting } from "./db";

export type VaultKind = "reel" | "leurre";

export interface VaultConfig {
  kind: VaultKind;
  databaseName: string;
  /** Clé brute (64 hexadécimaux), ou null si le chiffrement n'est pas disponible (web, Expo Go). */
  key: string | null;
}

const PLAIN_DB = "paperasse.db";
const NAMES: Record<VaultKind, string> = { reel: "paperasse-coffre.db", leurre: "paperasse-leurre.db" };
const KEY_IDS: Record<VaultKind, string> = { reel: "paperasse.cle.coffre", leurre: "paperasse.cle.leurre" };
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** « x'…' » : clé brute SQLCipher (pas de dérivation à chaque ouverture : rapide). */
export function rawKey(hex: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("Clé du coffre invalide");
  return `x'${hex}'`;
}

/** Clé du coffre ; créée seulement si elle n'existe pas (une erreur de lecture n'en crée jamais une nouvelle). */
async function keyFor(kind: VaultKind): Promise<{ key: string; created: boolean }> {
  const existing = await SecureStore.getItemAsync(KEY_IDS[kind], STORE_OPTIONS);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return { key: existing, created: false };
  const key = toHex(getRandomBytes(32));
  await SecureStore.setItemAsync(KEY_IDS[kind], key, STORE_OPTIONS);
  return { key, created: true };
}

async function hasCipher(): Promise<boolean> {
  const probe = await openDatabaseAsync(":memory:");
  try {
    const row = await probe.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version");
    return Boolean(row?.cipher_version);
  } catch {
    return false;
  } finally {
    await probe.closeAsync();
  }
}

/** Chemin brut du dossier des bases (expo-sqlite le donne sans « file:// » sur Android, parfois avec ailleurs). */
function dbDir(): string {
  const dir = String(defaultDatabaseDirectory ?? "").replace(/\/$/, "");
  return dir.startsWith("file://") ? decodeURI(dir.slice("file://".length)) : dir;
}

function dbPath(name: string): string {
  return `${dbDir()}/${name}`;
}

/** Adresse « file:// » pour expo-file-system. */
function dbUri(name: string): string {
  return `file://${encodeURI(dbPath(name))}`;
}

function dbExists(name: string): boolean {
  try {
    return new File(dbUri(name)).exists;
  } catch {
    return false;
  }
}

/** Ouvre la base chiffrée et vérifie que la clé est la bonne. */
export async function applyKey(db: SQLiteDatabase, key: string | null): Promise<void> {
  if (!key) return;
  await db.execAsync(`PRAGMA key = "${rawKey(key)}";`);
  await db.getFirstAsync("SELECT count(*) AS n FROM sqlite_master"); // échoue si la clé est fausse
}

async function opensWith(name: string, key: string): Promise<boolean> {
  let db: SQLiteDatabase | null = null;
  try {
    db = await openDatabaseAsync(name);
    await applyKey(db, key);
    return true;
  } catch {
    return false;
  } finally {
    await db?.closeAsync().catch(() => undefined);
  }
}

/** Un coffre qu'aucune clé n'ouvre (téléphone restauré sans sa clé…) est mis de côté, jamais effacé. */
function quarantine(name: string): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, "");
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      const f = new File(dbUri(name + suffix));
      if (f.exists) f.rename(`${name}.illisible-${stamp}${suffix}`);
    } catch {
      // On continue : au pire l'ouverture échouera et l'écran d'erreur proposera de réessayer.
    }
  }
}

/**
 * Prépare le coffre demandé. La première fois, l'ancienne base en clair (versions avant le chiffrement)
 * est copiée dans le coffre chiffré, vérifiée, puis effacée.
 */
export async function prepareVault(kind: VaultKind): Promise<VaultConfig> {
  if (Platform.OS === "web") return { kind, databaseName: kind === "reel" ? PLAIN_DB : "paperasse-leurre-web.db", key: null };
  if (!(await hasCipher())) return { kind, databaseName: kind === "reel" ? PLAIN_DB : "paperasse-leurre-nc.db", key: null };

  const { key, created } = await keyFor(kind);
  const name = NAMES[kind];
  if (dbExists(name) && (created || !(await opensWith(name, key)))) quarantine(name);
  if (kind === "reel" && (await migratePlainDatabase(key)) === "echec") {
    // Migration ratée : on garde l'ancienne base (rien n'est perdu), on réessaiera au prochain lancement.
    return { kind, databaseName: PLAIN_DB, key: null };
  }
  return { kind, databaseName: name, key };
}

async function migratePlainDatabase(key: string): Promise<"rien" | "fait" | "echec"> {
  if (!dbExists(PLAIN_DB)) return "rien";
  let plain: SQLiteDatabase | null = null;
  try {
    plain = await openDatabaseAsync(PLAIN_DB);
    const tables = await plain.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'");
    if (!tables || tables.n === 0) {
      await plain.closeAsync();
      plain = null;
      await deleteDatabaseAsync(PLAIN_DB).catch(() => undefined);
      return "rien";
    }
    await plain.execAsync("PRAGMA wal_checkpoint(TRUNCATE);");
    await plain.execAsync(`ATTACH DATABASE '${dbPath(NAMES.reel).replace(/'/g, "''")}' AS coffre KEY "${rawKey(key)}";`);
    const already = await plain.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM coffre.sqlite_master WHERE type = 'table'");
    const version = Number((await plain.getFirstAsync<{ user_version: number }>("PRAGMA main.user_version"))?.user_version ?? 0);
    if (!already || already.n === 0) {
      await plain.execAsync("SELECT sqlcipher_export('coffre');");
      await plain.execAsync(`PRAGMA coffre.user_version = ${version};`);
    } else {
      // Un coffre existe déjà (ouvert une première fois) : on y ajoute ce qui manque, sans rien écraser.
      const target = Number((await plain.getFirstAsync<{ user_version: number }>("PRAGMA coffre.user_version"))?.user_version ?? 0);
      if (target !== version) throw new Error(`versions différentes (${version} / ${target})`);
      await plain.execAsync(
        "BEGIN; INSERT OR IGNORE INTO coffre.documents SELECT * FROM main.documents; INSERT OR IGNORE INTO coffre.files SELECT * FROM main.files; INSERT OR IGNORE INTO coffre.settings SELECT * FROM main.settings; COMMIT;",
      );
    }
    // Chaque papier et chaque page de l'ancienne base doit être dans le coffre, sinon on n'efface rien.
    const missing = await plain.getFirstAsync<{ n: number }>(
      "SELECT (SELECT count(*) FROM main.documents WHERE id NOT IN (SELECT id FROM coffre.documents)) + (SELECT count(*) FROM main.files WHERE id NOT IN (SELECT id FROM coffre.files)) AS n",
    );
    if (!missing || missing.n !== 0) throw new Error("copie incomplète");
    const before = await plain.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM main.documents");
    await plain.execAsync("DETACH DATABASE coffre;");
    await plain.closeAsync();
    plain = null;
    // Dernière vérification avec une ouverture normale : la clé ouvre le coffre et les papiers y sont.
    const check = await openDatabaseAsync(NAMES.reel);
    try {
      await applyKey(check, key);
      const after = await check.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM documents");
      if ((after?.n ?? -1) < (before?.n ?? 0)) throw new Error("copie incomplète");
    } finally {
      await check.closeAsync();
    }
    await deleteDatabaseAsync(PLAIN_DB);
    return "fait";
  } catch (e) {
    // En cas d'échec, l'ancienne base n'est PAS effacée.
    if (__DEV__) console.warn("Migration vers le coffre chiffré impossible :", e);
    await plain?.closeAsync().catch(() => undefined);
    return "echec";
  }
}

/** Prépare le coffre leurre (vide, mais déjà « réglé » pour avoir l'air normal). */
export async function seedDecoy(language: string | null): Promise<void> {
  const cfg = await prepareVault("leurre");
  const db = await openDatabaseAsync(cfg.databaseName);
  try {
    await applyKey(db, cfg.key);
    await migrate(db);
    if (language) await setSetting(db, "language", language);
  } finally {
    await db.closeAsync();
  }
}

/** Efface le coffre leurre et sa clé (quand on retire le code panique). */
export async function forgetDecoy(): Promise<void> {
  const cfg = await prepareVault("leurre");
  await deleteDatabaseAsync(cfg.databaseName).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_IDS.leurre, STORE_OPTIONS).catch(() => undefined);
}
