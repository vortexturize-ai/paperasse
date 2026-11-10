import { daysBetween } from "./dates.ts";
import type { Lang } from "./i18n.ts";
import { findPersonalData, redactText } from "./privacy.ts";

export interface EasyInput {
  /** Nature du papier, déjà en mots (« Facture », « Avis d'impôt »). */
  kind: string;
  issuer: string | null;
  summary: string | null;
  actions: string[];
  toDo: boolean;
  isDone: boolean;
  amount: number | null;
  amountDirection: string | null;
  deadline: string | null;
  expiry: string | null;
  scam: boolean;
}

export type EasyIcon = "warning" | "file" | "check" | "euro" | "calendar" | "idcard";

export interface EasyLine {
  icon: EasyIcon;
  /** Petit mot de tête (« À payer »). */
  label: string;
  text: string;
  tone: "red" | "orange" | "green" | "neutral";
}

interface EasyWords {
  months: string[];
  money: (n: number) => string;
  date: (d: number, m: string, y: number) => string;
  what: string;
  from: string;
  scam: [string, string];
  todo: string;
  nothing: [string, string];
  nothingAuto: string;
  dateOnly: string;
  done: [string, string];
  pay: string;
  receive: string;
  amount: string;
  before: string;
  late: (date: string, days: number) => string;
  inDays: (days: number) => string;
  today: string;
  valid: string;
  expired: (date: string) => string;
  masked: string;
  number: string;
  euros: (whole: string, cents: string | null) => string;
}

const W: Record<Lang, EasyWords> = {
  fr: {
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    money: (n) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    date: (d, m, y) => `${d === 1 ? "1er" : d} ${m} ${y}`,
    what: "C’est",
    from: "de",
    scam: ["Attention", "C’est sans doute une arnaque. Ne paie rien, ne clique sur aucun lien."],
    todo: "À faire",
    nothing: ["À faire", "Rien. Garde ce papier."],
    nothingAuto: "Rien à faire de ton côté. Garde ce papier.",
    dateOnly: "Date prévue",
    done: ["C’est fait", "Tu as déjà fait le nécessaire."],
    pay: "À payer",
    receive: "Tu vas recevoir",
    amount: "Montant",
    before: "Avant le",
    late: (d, n) => `${d} : c’est dépassé depuis ${n} jour${n > 1 ? "s" : ""}.`,
    inDays: (n) => (n === 1 ? "demain" : `dans ${n} jours`),
    today: "aujourd’hui",
    valid: "Valable jusqu’au",
    expired: (d) => `Périmé depuis le ${d}.`,
    masked: "numéro masqué",
    number: "numéro",
    euros: (w, c) => (c && c !== "00" ? `${w} euros ${c}` : `${w} euros`),
  },
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    money: (n) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    date: (d, m, y) => `${d} ${m} ${y}`,
    what: "This is",
    from: "from",
    scam: ["Warning", "This is probably a scam. Do not pay, do not click any link."],
    todo: "To do",
    nothing: ["To do", "Nothing. Keep this paper."],
    nothingAuto: "Nothing to do on your side. Keep this paper.",
    dateOnly: "Scheduled date",
    done: ["Done", "You have already done what was needed."],
    pay: "To pay",
    receive: "You will receive",
    amount: "Amount",
    before: "Before",
    late: (d, n) => `${d}: overdue by ${n} day${n > 1 ? "s" : ""}.`,
    inDays: (n) => (n === 1 ? "tomorrow" : `in ${n} days`),
    today: "today",
    valid: "Valid until",
    expired: (d) => `Expired since ${d}.`,
    masked: "hidden number",
    number: "number",
    euros: (w, c) => (c && c !== "00" ? `${w} euros ${c}` : `${w} euros`),
  },
  es: {
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    money: (n) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    date: (d, m, y) => `${d} de ${m} de ${y}`,
    what: "Es",
    from: "de",
    scam: ["Cuidado", "Seguramente es una estafa. No pagues nada, no pulses ningún enlace."],
    todo: "Qué hacer",
    nothing: ["Qué hacer", "Nada. Guarda este papel."],
    nothingAuto: "Nada que hacer por tu parte. Guarda este papel.",
    dateOnly: "Fecha prevista",
    done: ["Hecho", "Ya hiciste lo necesario."],
    pay: "A pagar",
    receive: "Vas a recibir",
    amount: "Importe",
    before: "Antes del",
    late: (d, n) => `${d}: plazo pasado hace ${n} día${n > 1 ? "s" : ""}.`,
    inDays: (n) => (n === 1 ? "mañana" : `dentro de ${n} días`),
    today: "hoy",
    valid: "Válido hasta el",
    expired: (d) => `Caducado desde el ${d}.`,
    masked: "número oculto",
    number: "número",
    euros: (w, c) => (c && c !== "00" ? `${w} euros con ${c}` : `${w} euros`),
  },
  ar: {
    months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    money: (n) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} يورو`,
    date: (d, m, y) => `${d} ${m} ${y}`,
    what: "هذه",
    from: "من",
    scam: ["انتبه", "هذه على الأرجح عملية احتيال. لا تدفع شيئًا ولا تضغط على أي رابط."],
    todo: "المطلوب",
    nothing: ["المطلوب", "لا شيء. احتفظ بهذه الورقة."],
    nothingAuto: "لا شيء مطلوب منك. احتفظ بهذه الورقة.",
    dateOnly: "التاريخ المحدد",
    done: ["تم", "لقد قمت بما يلزم."],
    pay: "المبلغ المطلوب دفعه",
    receive: "ستحصل على",
    amount: "المبلغ",
    before: "قبل",
    late: (d, n) => `${d}: انتهى الموعد منذ ${n} يوم.`,
    inDays: (n) => (n === 1 ? "غدًا" : `بعد ${n} أيام`),
    today: "اليوم",
    valid: "صالح حتى",
    expired: (d) => `منتهي الصلاحية منذ ${d}.`,
    masked: "رقم مخفي",
    number: "رقم",
    euros: (w, c) => (c && c !== "00" ? `${w} يورو و ${c} سنتًا` : `${w} يورو`),
  },
};

/** Langue de la voix du téléphone pour chaque langue de Paperasse. */
export const SPEECH_LANG: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", ar: "ar" };

export function longDate(lang: Lang, iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const w = W[lang];
  return w.date(Number(m[3]), w.months[Number(m[2]) - 1] ?? m[2], Number(m[1]));
}

/** L'essentiel, ligne par ligne, le plus important d'abord. */
export function essentials(p: EasyInput, lang: Lang, today: string): EasyLine[] {
  const w = W[lang];
  const out: EasyLine[] = [];
  if (p.scam) out.push({ icon: "warning", label: w.scam[0], text: w.scam[1], tone: "red" });
  out.push({ icon: "file", label: w.what, text: p.issuer ? `${p.kind} ${w.from} ${p.issuer}` : p.kind, tone: "neutral" });
  if (p.isDone) out.push({ icon: "check", label: w.done[0], text: w.done[1], tone: "green" });
  else if (!p.scam && p.actions.length) out.push({ icon: "check", label: w.todo, text: p.actions[0], tone: "orange" });
  else if (!p.scam && !p.toDo)
    out.push({ icon: "check", label: w.nothing[0], text: p.amount !== null && p.amountDirection === "a_payer" ? w.nothingAuto : w.nothing[1], tone: "green" });
  if (p.amount !== null && Number.isFinite(p.amount) && !p.scam) {
    // Rien à faire mais un montant « à payer » : prélèvement automatique, déjà réglé… on ne dit pas « À payer ».
    const label = p.amountDirection === "a_payer" ? (p.toDo ? w.pay : w.amount) : p.amountDirection === "a_recevoir" ? w.receive : w.amount;
    out.push({ icon: "euro", label, text: w.money(p.amount), tone: p.amountDirection === "a_recevoir" ? "green" : "neutral" });
  }
  if (p.deadline && !p.isDone && !p.scam) {
    const n = daysBetween(today, p.deadline);
    const d = longDate(lang, p.deadline);
    const when = `${d} (${n === 0 ? w.today : w.inDays(n)})`;
    if (!p.toDo && !p.actions.length) {
      // Une date sans démarche (prélèvement automatique…) : on la donne, sans alarme ni « payer ».
      if (n >= 0) out.push({ icon: "calendar", label: w.dateOnly, text: when, tone: "neutral" });
    } else
      out.push(
        n < 0
          ? { icon: "calendar", label: w.before, text: w.late(d, -n), tone: "red" }
          : { icon: "calendar", label: w.before, text: when, tone: n <= 7 ? "red" : n <= 30 ? "orange" : "neutral" },
      );
  }
  if (p.expiry) {
    const d = longDate(lang, p.expiry);
    out.push(
      p.expiry < today
        ? { icon: "idcard", label: w.valid, text: w.expired(d), tone: "red" }
        : { icon: "idcard", label: w.valid, text: d, tone: "neutral" },
    );
  }
  return out;
}

/** Prépare un texte pour la voix : numéros très personnels masqués, symboles et dates en mots. */
export function forSpeech(text: string, lang: Lang): string {
  const w = W[lang];
  let s = redactText(text, findPersonalData(text), "haute").replace(/\[[^\]]{1,40} masqué\]/g, w.masked);
  // Dates : 20/11/2026, 2026-11-20.
  s = s.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (all, d, m, y) =>
    Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? w.date(Number(d), w.months[Number(m) - 1], Number(y)) : all,
  );
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, m, d) =>
    Number(m) >= 1 && Number(m) <= 12 ? w.date(Number(d), w.months[Number(m) - 1], Number(y)) : all,
  );
  // Montants : « 1 234,56 € », « €84.60 », « 84,60 EUR ».
  const euros = (whole: string, cents: string | undefined) => w.euros(whole.replace(/[\s.  ]/g, ""), cents ?? null);
  s = s.replace(/(\d{1,3}(?:[\s.  ]\d{3})*|\d+)(?:,(\d{2}))?\s?(?:€|EUR\b|euros?\b)/g, (_, a, c) => euros(a, c));
  s = s.replace(/€\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?/g, (_, a: string, c) => euros(a.replace(/,/g, ""), c));
  // Abréviations et signes que les voix lisent mal.
  s = s
    .replace(/\bn[°º]\s?/gi, `${w.number} `)
    .replace(/[•·▪►]/g, "")
    .replace(/\s[–—]\s/g, ", ")
    .replace(/[«»"“”]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .trim();
  return s;
}

/** Tout ce qu'on lit à voix haute pour un papier : l'essentiel, puis l'explication et les étapes. */
export function speechText(p: EasyInput, lang: Lang, today: string): string {
  const lines = essentials(p, lang, today).map((l) => `${l.label} : ${l.text}`);
  const more = [p.summary ?? "", ...(p.scam ? [] : p.actions.slice(1))].filter((x) => x.trim());
  return forSpeech([...lines, ...more].join("\n"), lang);
}

/** Découpe un long texte en morceaux que la voix du téléphone accepte, sans couper une phrase. */
export function speechChunks(text: string, max = 3500): string[] {
  const out: string[] = [];
  let cur = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const piece = sentence.length > max ? sentence.match(new RegExp(`.{1,${max}}`, "g")) ?? [] : [sentence];
    for (const p of piece) {
      if ((cur + " " + p).trim().length > max && cur) {
        out.push(cur.trim());
        cur = p;
      } else cur = `${cur} ${p}`;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
