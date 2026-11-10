/** Minuscules sans accents, pour la recherche. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date locale du jour, AAAA-MM-JJ. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** AAAA-MM-JJ vers une Date à minuit, heure locale. */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Jours entre aujourd'hui et la date (négatif si passée). */
export function daysUntil(iso: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseIso(iso).getTime() - today.getTime()) / 86_400_000);
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = parseIso(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDays(iso: string, now = new Date()): string {
  const n = daysUntil(iso, now);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n < 0) return `dépassée depuis ${-n} jours`;
  return `dans ${n} jours`;
}

export function formatAmount(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
}

/** Pour la petite page de calendrier : « NOV. » et « 14 ». */
export function calendarParts(iso: string): { month: string; day: string } {
  const d = parseIso(iso);
  return { month: MONTHS[d.getMonth()].toLocaleUpperCase("fr-FR"), day: String(d.getDate()) };
}
