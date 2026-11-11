import { daysUntil, parseIso } from "./text.ts";
import type { DocumentRecord } from "./types.ts";

/**
 * Contenu du widget « Prochaine échéance » (écran d'accueil du téléphone).
 *
 * Le widget est visible par quiconque voit le téléphone, coffre fermé : il ne garde que des dates et, si aucun
 * code secret n'est en place, le nom du papier. Avec un code secret, aucun nom (comme les rappels). Coffre leurre
 * ouvert : widget vide, pour ne jamais trahir le vrai coffre.
 */

/** Une expiration n'apparaît qu'à partir de 60 jours avant (comme le premier rappel). */
export const WIDGET_EXPIRY_HORIZON = 60;
/** Échéances gardées d'avance : le widget passe à la suivante sans rouvrir l'app. */
export const WIDGET_KEEP = 6;
/** « + 2 autres » compte les échéances des 7 jours qui suivent la première. */
const SOON_DAYS = 7;

export interface WidgetItem {
  kind: "deadline" | "expiry";
  /** AAAA-MM-JJ */
  date: string;
  /** Nom du papier, absent en mode discret. */
  title?: string;
}

export interface WidgetSnapshot {
  v: 1;
  discreet: boolean;
  items: WidgetItem[];
}

export const EMPTY_SNAPSHOT: WidgetSnapshot = { v: 1, discreet: true, items: [] };

/** Retire le préfixe de date des noms rangés (« 2026-11 Courrier – CAF » → « Courrier – CAF »). */
export function shortTitle(title: string): string {
  return title.replace(/^\d{4}-\d{2}(?:-\d{2})?\s+/, "").trim() || title.trim();
}

/** Ce que l'app confie au widget : les prochaines échéances du coffre, triées. */
export function widgetSnapshot(
  docs: Pick<DocumentRecord, "title" | "deadline" | "isDone" | "expiryDate">[],
  discreet: boolean,
  now = new Date(),
): WidgetSnapshot {
  const items: WidgetItem[] = [];
  for (const d of docs) {
    if (d.deadline && !d.isDone && daysUntil(d.deadline, now) >= 0) items.push({ kind: "deadline", date: d.deadline, title: d.title });
    if (d.expiryDate && daysUntil(d.expiryDate, now) >= 0) items.push({ kind: "expiry", date: d.expiryDate, title: d.title });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "deadline" ? -1 : 1));
  return {
    v: 1,
    discreet,
    items: items.slice(0, WIDGET_KEEP).map((i) => (discreet ? { kind: i.kind, date: i.date } : { ...i, title: shortTitle(i.title ?? "") })),
  };
}

/** Relit un fichier de widget ; tout ce qui est abîmé ou inattendu donne un widget vide. */
export function parseSnapshot(raw: string | null | undefined): WidgetSnapshot {
  if (!raw) return EMPTY_SNAPSHOT;
  try {
    const s = JSON.parse(raw) as Partial<WidgetSnapshot>;
    if (s.v !== 1 || !Array.isArray(s.items)) return EMPTY_SNAPSHOT;
    const discreet = s.discreet !== false;
    const items = s.items
      .filter((i): i is WidgetItem => !!i && (i.kind === "deadline" || i.kind === "expiry") && typeof i.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date))
      .slice(0, WIDGET_KEEP)
      .map((i) => (discreet || typeof i.title !== "string" ? { kind: i.kind, date: i.date } : { kind: i.kind, date: i.date, title: i.title.slice(0, 120) }));
    return { v: 1, discreet, items };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export interface WidgetView {
  empty: boolean;
  /** « À faire » ou « Expire » */
  label: string;
  /** « Aujourd’hui », « Demain », « Dans 3 jours » */
  when: string;
  /** Nom du papier, ou une phrase neutre en mode discret. */
  what: string;
  /** « ven. 15 nov. » */
  date: string;
  /** « + 2 autres bientôt » (dans les 7 jours qui suivent) */
  more: string | null;
  /** Aujourd'hui ou demain : couleur d'alerte. */
  urgent: boolean;
}

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function shortDate(iso: string, now: Date): string {
  const d = parseIso(iso);
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

function whenText(days: number): string {
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

/** Ce que le widget affiche à l'instant `now` (recalculé à chaque mise à jour, même app fermée). */
export function widgetView(snap: WidgetSnapshot, now = new Date()): WidgetView {
  const upcoming = snap.items
    .map((i) => ({ ...i, days: daysUntil(i.date, now) }))
    .filter((i) => i.days >= 0 && (i.kind === "deadline" || i.days <= WIDGET_EXPIRY_HORIZON));
  const first = upcoming[0];
  if (!first) return { empty: true, label: "Prochaine échéance", when: "Rien à faire", what: "Tes papiers sont à jour.", date: "", more: null, urgent: false };
  const others = upcoming.slice(1).filter((i) => i.days - first.days <= SOON_DAYS).length;
  const neutral = first.kind === "deadline" ? "Un papier t’attend" : "Un papier à renouveler";
  return {
    empty: false,
    label: first.kind === "deadline" ? "À faire" : "Expire",
    when: whenText(first.days),
    what: snap.discreet || !first.title ? neutral : first.title,
    date: shortDate(first.date, now),
    more: others ? `+ ${others} autre${others > 1 ? "s" : ""} bientôt` : null,
    urgent: first.days <= 1,
  };
}
