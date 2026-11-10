export interface DateMention {
  iso: string; // AAAA-MM-JJ
  index: number; // position dans le texte
  length: number;
}

/** Date écrite sans année (« avant le 27 novembre ») : l'année se déduit de la date du courrier. */
export interface PartialDateMention {
  month: number;
  day: number;
  index: number;
  length: number;
}

export interface DurationMention {
  amount: number;
  unit: "jour" | "semaine" | "mois" | "an";
  index: number;
  length: number;
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const UNITS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40,
  cinquante: 50, soixante: 60,
};
const TENS = ["vingt", "trente", "quarante", "cinquante", "soixante"];
const DIGITS = ["un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
// « quarante-cinq », « vingt et un », « trente-deux » ou un nombre simple.
const NUMBER_WORD = `(?:(?:${TENS.join("|")})(?:-et-|\\s+et\\s+|-|\\s+)(?:${DIGITS.join("|")})|${Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|")})`;

export function numberFromWords(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(/-et-|\s+et\s+|-|\s+/).filter(Boolean);
  let n = 0;
  for (const p of parts) {
    const v = UNITS[p];
    if (v === undefined) return null;
    n += v;
  }
  return n || null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function toIso(y: number, m: number, d: number): string | null {
  return isValidDate(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function fullYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

// Le point final d'une phrase est permis après la date (« avant le 20/11/2026. »).
const NUMERIC = /(?<![\d/.\-])(\d{1,2})\s?[/.\-]\s?(\d{1,2})\s?[/.\-]\s?(\d{4}|\d{2})(?![\d/\-]|\.\d)/g;
const ISO_DATE = /(?<![\d/.\-])(\d{4})-(\d{2})-(\d{2})(?![\d\-])/g;
const TEXTUAL = new RegExp(`(?<![\\d])(\\d{1,2})\\s*(?:er|e)?\\s+(${MONTH_PATTERN})(?![a-z])\\.?\\s+(\\d{4})(?!\\d)`, "g");
const TEXTUAL_NO_YEAR = new RegExp(`(?<![\\d/.,])(\\d{1,2})\\s*(?:er|e)?\\s+(${MONTH_PATTERN})(?![a-z])\\.?(?!\\s*\\d)`, "g");

/** Toutes les dates du texte (déjà replié avec `fold`), dans l'ordre. */
export function findDates(folded: string): DateMention[] {
  const found: DateMention[] = [];
  for (const m of folded.matchAll(NUMERIC)) {
    const iso = toIso(fullYear(Number(m[3])), Number(m[2]), Number(m[1]));
    if (iso) found.push({ iso, index: m.index ?? 0, length: m[0].length });
  }
  for (const m of folded.matchAll(ISO_DATE)) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) found.push({ iso, index: m.index ?? 0, length: m[0].length });
  }
  for (const m of folded.matchAll(TEXTUAL)) {
    const iso = toIso(Number(m[3]), MONTHS[m[2]], Number(m[1]));
    if (iso) found.push({ iso, index: m.index ?? 0, length: m[0].length });
  }
  return found.sort((a, b) => a.index - b.index);
}

/** Dates sans année (« le 27 novembre »). */
export function findPartialDates(folded: string): PartialDateMention[] {
  const out: PartialDateMention[] = [];
  for (const m of folded.matchAll(TEXTUAL_NO_YEAR)) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (day >= 1 && day <= 31) out.push({ day, month, index: m.index ?? 0, length: m[0].length });
  }
  return out;
}

/** Donne une année à une date sans année : la première occurrence qui n'est pas avant `refIso` (moins `toleranceDays`). */
export function resolvePartial(p: PartialDateMention, refIso: string, toleranceDays = 0): string | null {
  const year = Number(refIso.slice(0, 4));
  for (const y of [year, year + 1]) {
    const iso = toIso(y, p.month, p.day);
    if (iso && daysBetween(refIso, iso) >= -toleranceDays) return iso;
  }
  return null;
}

const DURATION = new RegExp(
  `(?<![a-z])(?:dans un delai (?:maximum |maximal |total )?(?:de |d')|dans le delai (?:de |d')|delai (?:de |d')|sous |dans les |d'ici |dans )\\s*(\\d{1,3}|${NUMBER_WORD})\\s*(jours?|semaines?|mois|ans?|heures?|h)(?![a-z])`,
  "g",
);
const HUITAINE = /(?<![a-z])(?:sous|dans la|dans une) (huitaine|quinzaine)(?![a-z])/g;

/** Délais écrits en toutes lettres : « dans un délai de 15 jours », « sous 2 mois », « sous huitaine »… */
export function findDurations(folded: string): DurationMention[] {
  const out: DurationMention[] = [];
  for (const m of folded.matchAll(DURATION)) {
    let amount = numberFromWords(m[1]);
    if (!amount || amount > 400) continue;
    const u = m[2];
    let unit: DurationMention["unit"] = u.startsWith("jour") ? "jour" : u.startsWith("semaine") ? "semaine" : u === "mois" ? "mois" : u.startsWith("an") ? "an" : "jour";
    if (u === "h" || u.startsWith("heure")) {
      amount = Math.ceil(amount / 24);
      unit = "jour";
    }
    out.push({ amount, unit, index: m.index ?? 0, length: m[0].length });
  }
  for (const m of folded.matchAll(HUITAINE)) {
    out.push({ amount: m[1] === "huitaine" ? 8 : 15, unit: "jour", index: m.index ?? 0, length: m[0].length });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function addDuration(iso: string, amount: number, unit: DurationMention["unit"]): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (unit === "jour") date.setUTCDate(date.getUTCDate() + amount);
  else if (unit === "semaine") date.setUTCDate(date.getUTCDate() + amount * 7);
  else if (unit === "mois") date.setUTCMonth(date.getUTCMonth() + amount);
  else date.setUTCFullYear(date.getUTCFullYear() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
