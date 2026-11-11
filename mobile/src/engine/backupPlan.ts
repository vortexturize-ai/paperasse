/** Une sauvegarde plus vieille que ça est rappelée sur l'accueil. */
export const STALE_DAYS = 30;
/** Autant de papiers ajoutés depuis la dernière sauvegarde : rappel aussi. */
export const NEW_PAPERS = 5;
/** Sauvegarde automatique : au plus une fois par jour, au moins une fois par semaine. */
export const AUTO_EVERY_DAYS = 7;
/** Sauvegardes automatiques gardées dans le dossier choisi. */
export const AUTO_KEEP = 3;

export interface BackupState {
  /** Papiers dans le coffre. */
  papers: number;
  /** Dernière sauvegarde (date ISO), ou null s'il n'y en a jamais eu. */
  last: string | null;
  /** Nombre de papiers au moment de la dernière sauvegarde. */
  papersAtLast: number | null;
  /** La dernière sauvegarde automatique a échoué (dossier débranché, accès retiré…). */
  autoFailed: boolean;
  /** « Plus tard » : pas de rappel avant cette date (AAAA-MM-JJ). */
  snoozeUntil: string | null;
}

export type BackupNudge =
  | { kind: "jamais" }
  | { kind: "vieille"; days: number }
  | { kind: "nouveaux"; added: number }
  | { kind: "auto_echec" };

function daysSince(iso: string, today: string): number {
  const a = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Faut-il rappeler de sauvegarder, et pourquoi ? `today` : AAAA-MM-JJ. */
export function backupNudge(s: BackupState, today: string): BackupNudge | null {
  if (s.papers === 0) return null;
  if (s.autoFailed) return { kind: "auto_echec" };
  if (s.snoozeUntil && s.snoozeUntil > today) return null;
  if (!s.last) return { kind: "jamais" };
  const added = s.papers - (s.papersAtLast ?? 0);
  if (added >= NEW_PAPERS) return { kind: "nouveaux", added };
  const days = daysSince(s.last, today);
  if (days >= STALE_DAYS) return { kind: "vieille", days };
  return null;
}

/** La sauvegarde automatique doit-elle tourner maintenant ? */
export function autoBackupDue(s: Pick<BackupState, "papers" | "last" | "papersAtLast">, today: string): boolean {
  if (s.papers === 0) return false;
  if (!s.last) return true;
  const days = daysSince(s.last, today);
  if (days >= AUTO_EVERY_DAYS) return true;
  return days >= 1 && s.papers !== (s.papersAtLast ?? 0);
}

export function backupFileName(today: string, n = 1): string {
  return `Paperasse-sauvegarde-${today}${n > 1 ? `-${n}` : ""}.paperasse`;
}

/** Parmi les fichiers écrits par la sauvegarde automatique (du plus ancien au plus récent), ceux à effacer. */
export function backupsToDelete(written: string[], keep = AUTO_KEEP): string[] {
  return written.length > keep ? written.slice(0, written.length - keep) : [];
}

/**
 * Nom lisible d'un dossier à partir de son adresse : « content://…/tree/primary%3ADocuments%2FPaperasse » → « Paperasse »,
 * « file:///…/Sauvegardes/ » → « Sauvegardes ». Jamais vide.
 */
export function folderLabelFromUri(uri: string, fallback = "ton dossier"): string {
  let s = uri;
  try {
    s = decodeURIComponent(uri);
  } catch {
    // adresse mal encodée : on garde telle quelle
  }
  const last = s
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .pop() ?? "";
  // Android (SAF) : « primary:Documents/Paperasse » ou « 1234-ABCD:Paperasse » → ce qui suit les deux-points.
  const name = (last.includes(":") ? last.slice(last.lastIndexOf(":") + 1) : last).trim();
  // Identifiants opaques (Google Drive « encoded=… », longues suites de chiffres et lettres) : rien de lisible.
  const opaque = !name || /^encoded=/i.test(name) || /^[0-9a-f-]{8,}$/i.test(name) || /^[A-Za-z0-9+/=_-]{24,}$/.test(name);
  return opaque ? fallback : name;
}
