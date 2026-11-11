import { Directory, File, FileMode } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { autoBackupDue, backupFileName, backupNudge, backupsToDelete, folderLabelFromUri, type BackupNudge, type BackupState } from "../engine/backupPlan";
import { backupCode, cleanBackupCache, writeBackup } from "./backup";
import { getSetting, setSetting } from "./db";
import { withLockSuspended } from "./suspend";
import { todayIso } from "./text";
import type { VaultKind } from "./vaultKey";

/**
 * Sauvegarde automatique : Android seulement. Sur iOS, l'accès à un dossier choisi ne survit pas au redémarrage
 * de l'app (il faudrait le redemander à chaque fois) ; la sauvegarde manuelle vers Fichiers / iCloud Drive reste.
 */
export const autoBackupSupported = Platform.OS === "android";

async function paperCount(db: SQLiteDatabase): Promise<number> {
  return (await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM documents"))?.n ?? 0;
}

export async function backupState(db: SQLiteDatabase): Promise<BackupState & { folder: string | null }> {
  const [papers, last, atLast, failed, snooze, folder] = await Promise.all([
    paperCount(db),
    getSetting(db, "backup_last"),
    getSetting(db, "backup_papers"),
    getSetting(db, "backup_error"),
    getSetting(db, "backup_snooze"),
    getSetting(db, "backup_folder"),
  ]);
  const atLastNumber = atLast ? Number(atLast) : NaN;
  return {
    papers,
    last: last || null,
    papersAtLast: Number.isFinite(atLastNumber) ? atLastNumber : null,
    autoFailed: autoBackupSupported && failed === "1",
    snoozeUntil: snooze || null,
    folder: autoBackupSupported && folder ? folder : null,
  };
}

export async function homeBackupNudge(db: SQLiteDatabase): Promise<BackupNudge | null> {
  return backupNudge(await backupState(db), todayIso());
}

/** Note une sauvegarde réussie (faite à la main ou automatiquement). */
export async function recordBackup(db: SQLiteDatabase): Promise<void> {
  await setSetting(db, "backup_last", new Date().toISOString());
  await setSetting(db, "backup_papers", String(await paperCount(db)));
}

export async function snoozeBackupNudge(db: SQLiteDatabase, days = 7): Promise<void> {
  const d = new Date();
  d.setDate(d.getDate() + days);
  await setSetting(db, "backup_snooze", todayIso(d));
}

/** Nom lisible du dossier choisi (« Paperasse », « Download »…). */
export function folderLabel(uri: string): string {
  const fromUri = folderLabelFromUri(uri);
  try {
    const name = new Directory(uri).name;
    // Android rend parfois l'identifiant du dossier (« primary:Documents ») : même nettoyage que l'adresse.
    if (name && !/%[0-9A-Fa-f]{2}/.test(name)) return folderLabelFromUri(name, fromUri);
  } catch {
    // on retombe sur le nom tiré de l'adresse
  }
  return fromUri;
}

/** Fait choisir un dossier (Google Drive, clé USB, carte SD…) : l'accès est gardé pour les prochaines fois. */
export async function chooseBackupFolder(db: SQLiteDatabase): Promise<string | null> {
  if (!autoBackupSupported) return null;
  let dir: Directory;
  try {
    dir = await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch {
    return null; // choix annulé
  }
  await setSetting(db, "backup_folder", dir.uri);
  await setSetting(db, "backup_error", "");
  return dir.uri;
}

export async function stopAutoBackup(db: SQLiteDatabase): Promise<void> {
  await setSetting(db, "backup_folder", "");
  await setSetting(db, "backup_error", "");
}

/** 1 Mo à la fois : une grosse sauvegarde ne passe jamais d'un bloc en mémoire. */
const COPY_CHUNK = 1 << 20;

/**
 * Recopie la sauvegarde dans le fichier créé dans le dossier choisi. Pas `File.copy` : vers un dossier choisi
 * (Android), elle efface d'abord le fichier qu'on vient d'y créer puis écrit dans le vide (« Missing file »).
 */
async function copyInto(src: File, dest: File): Promise<void> {
  const from = src.open(FileMode.ReadOnly);
  try {
    const to = dest.open(FileMode.WriteOnly);
    try {
      for (;;) {
        const chunk = await from.readBytes(COPY_CHUNK);
        if (chunk.length === 0) break;
        await to.writeBytes(chunk);
      }
    } finally {
      to.close();
    }
  } finally {
    from.close();
  }
  if (dest.size !== src.size) throw new Error("Copie incomplète");
}

export type AutoResult = "fait" | "pas_besoin" | "pas_de_dossier" | "erreur";

let running: Promise<AutoResult> | null = null;

/**
 * Sauvegarde chiffrée dans le dossier choisi, si elle est due (ou `force`).
 * Garde les 3 dernières qu'elle a écrites elle-même : elle n'efface jamais un autre fichier
 * (ni une sauvegarde faite à la main, ni celle de l'autre coffre). Jamais deux en même temps.
 */
export function runAutoBackup(db: SQLiteDatabase, kind: VaultKind, force = false): Promise<AutoResult> {
  if (running) return running;
  running = runAutoBackupNow(db, kind, force).finally(() => {
    running = null;
  });
  return running;
}

async function runAutoBackupNow(db: SQLiteDatabase, kind: VaultKind, force: boolean): Promise<AutoResult> {
  const state = await backupState(db);
  if (!state.folder) return "pas_de_dossier";
  const today = todayIso();
  if (!force && !autoBackupDue(state, today)) return "pas_besoin";
  try {
    // La clé de secours existe déjà : la sauvegarde automatique se règle depuis l'écran qui la montre.
    const code = await backupCode(kind);
    const { file } = await writeBackup(db, { type: "sauvegarde", code });
    const dir = new Directory(state.folder);
    const taken = new Set(dir.list().map((e) => e.name));
    let n = 1;
    while (taken.has(backupFileName(today, n))) n++;
    const name = backupFileName(today, n);
    const dest = dir.createFile(name, "application/octet-stream");
    try {
      await copyInto(file, dest);
    } catch (e) {
      try {
        dest.delete(); // pas de sauvegarde à moitié écrite qui passerait pour bonne
      } catch {
        // rien à effacer
      }
      throw e;
    }

    let written: string[] = [];
    try {
      const parsed: unknown = JSON.parse((await getSetting(db, "backup_files")) || "[]");
      if (Array.isArray(parsed)) written = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      written = [];
    }
    written.push(name);
    const toDelete = backupsToDelete(written);
    if (toDelete.length) {
      const entries = dir.list();
      for (const old of toDelete) {
        const f = entries.find((e) => e.name === old);
        if (f instanceof File) {
          try {
            f.delete();
          } catch {
            // déjà parti ou dossier en lecture seule : on garde une sauvegarde de plus, sans erreur
          }
        }
      }
    }
    await setSetting(db, "backup_files", JSON.stringify(written.slice(-3)));
    await recordBackup(db);
    await setSetting(db, "backup_error", "");
    return "fait";
  } catch (e) {
    if (__DEV__) console.warn("Sauvegarde automatique impossible :", e);
    await setSetting(db, "backup_error", "1");
    return "erreur";
  } finally {
    cleanBackupCache();
  }
}
