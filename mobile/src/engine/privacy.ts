import { fold } from "./normalize.ts";

export type PersonalKind =
  | "email" | "telephone" | "iban" | "carte_bancaire" | "securite_sociale" | "numero_fiscal"
  | "siret" | "passeport" | "date_naissance" | "adresse" | "bande_mrz";

export type Sensitivity = "haute" | "moyenne" | "basse";

export interface PersonalItem {
  kind: PersonalKind;
  label: string;
  /** Valeur masquée, prête à afficher (jamais la valeur complète d'un numéro sensible). */
  masked: string;
  index: number;
  length: number;
  sensitivity: Sensitivity;
}

const LABELS: Record<PersonalKind, [string, Sensitivity]> = {
  email: ["Adresse mail", "moyenne"],
  telephone: ["Téléphone", "moyenne"],
  iban: ["IBAN (compte bancaire)", "haute"],
  carte_bancaire: ["Numéro de carte bancaire", "haute"],
  securite_sociale: ["N° de sécurité sociale", "haute"],
  numero_fiscal: ["Numéro fiscal", "haute"],
  siret: ["SIRET", "basse"],
  passeport: ["N° de passeport", "haute"],
  date_naissance: ["Date de naissance", "moyenne"],
  adresse: ["Adresse postale", "moyenne"],
  bande_mrz: ["Bande lisible par machine (pièce d'identité)", "haute"],
};

/** Clé IBAN (ISO 13616) : le numéro réarrangé, lettres → nombres, modulo 97 = 1. */
export function isValidIban(raw: string): boolean {
  const s = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Algorithme de Luhn (cartes bancaires, SIRET). */
export function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** Clé du numéro de sécurité sociale : 97 − (13 premiers chiffres modulo 97). Corse : 2A → 19, 2B → 18. */
export function isValidNir(raw: string): boolean {
  const s = raw.replace(/\s/g, "").toUpperCase();
  if (!/^[12]\d{2}(?:0[1-9]|1[0-2]|[2-9]\d)(?:\d{2}|2A|2B)\d{6}\d{2}$/.test(s)) return false;
  const body = s.slice(0, 13).replace("2A", "19").replace("2B", "18");
  const key = Number(s.slice(13));
  // Calcul par morceaux : 13 chiffres dépassent la précision exacte des nombres JS.
  let rest = 0;
  for (const d of body) rest = (rest * 10 + Number(d)) % 97;
  return 97 - rest === key;
}

function maskKeepEnds(value: string, start: number, end: number): string {
  const compact = value.replace(/\s/g, "");
  if (compact.length <= start + end) return "•".repeat(compact.length);
  return `${compact.slice(0, start)} •••• ${compact.slice(-end)}`;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

// Quantificateurs bornés partout : pas de blocage possible sur un texte piège.
const EMAIL = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,4}\.[A-Za-z]{2,12}(?![A-Za-z0-9-])/g;
const PHONE_FR = /(?<![\d+])(?:\+33\s?(?:\(0\)\s?)?|0033\s?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/g;
const PHONE_INTL = /(?<![\d+])\+(?:[1-9]\d{0,2})(?:[\s.-]?\d{2,4}){3,5}(?!\d)/g;
const IBAN = /(?<![A-Za-z0-9])[A-Za-z]{2}\d{2}(?:\s?[A-Za-z0-9]{4}){2,7}(?:\s?[A-Za-z0-9]{1,4})?(?![A-Za-z0-9])/g;
const CARD = /(?<![\d])(?:\d{4}[\s-]?){3}\d{4}(?:[\s-]?\d{3})?(?!\d)/g;
const NIR = /(?<![\dA-Za-z])[12]\s?\d{2}\s?\d{2}\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}(?:\s?\d{2})?(?![\dA-Za-z])/gi;
const SIRET = /(?<!\d)\d{3}\s?\d{3}\s?\d{3}\s?\d{5}(?!\d)/g;
const FISCAL = /numero fiscal\s*:?\s*(\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{3})(?!\d)/g;
const PASSPORT = /(?:passeport|passport)[^\n\d]{0,30}?(\d{2}[A-Z]{2}\d{5})(?![A-Z0-9])/gi;
const BIRTH = /(?:ne|nee|ne\(e\)|date de naissance|naissance)\s*(?:le|:)?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{1,2}(?:er)? [a-z]+\.? \d{4})/g;
const ADDRESS = /(?<![\dA-Za-z])\d{1,4}(?:\s?(?:bis|ter))?,?\s(?:rue|avenue|av\.|boulevard|bd|all[ée]e|place|chemin|impasse|route|quai|cours|square|r[ée]sidence|lotissement)\s[^\n,]{2,40}?,?\s(?:\d{5})\s[A-Za-zÀ-ÿ' -]{2,30}/gi;
const MRZ_LINE = /^[A-Z0-9<]{30,44}$/;

/** « L78 08 45 2O8 … » lu par la caméra : lettres prises pour des chiffres dans une longue suite de chiffres.
 *  Même longueur que le texte, pour garder les positions. */
function ocrDigits(text: string): string {
  return text.replace(/[0-9OolIL|][0-9OolIL| ]{11,22}[0-9OolIL|]/g, (run) => {
    if (run.replace(/\D/g, "").length < 8 || !/[OolIL|]/.test(run)) return run;
    return run.replace(/[Oo]/g, "0").replace(/[lIL|]/g, "1");
  });
}

/** Toutes les données personnelles du papier, une fois chacune, dans l'ordre du texte. */
export function findPersonalData(text: string): PersonalItem[] {
  const out: PersonalItem[] = [];
  const taken: [number, number][] = [];
  const free = (i: number, len: number) => !taken.some(([s, e]) => i < e && i + len > s);
  const push = (kind: PersonalKind, index: number, length: number, masked: string) => {
    if (!free(index, length)) return;
    taken.push([index, index + length]);
    const [label, sensitivity] = LABELS[kind];
    out.push({ kind, label, masked, index, length, sensitivity });
  };
  const folded = fold(text);

  // Bande MRZ d'une pièce d'identité : la ligne entière est sensible.
  let pos = 0;
  for (const line of text.split("\n")) {
    const compact = line.replace(/\s/g, "");
    if (MRZ_LINE.test(compact) && compact.includes("<<")) push("bande_mrz", pos, line.length, `${compact.slice(0, 5)}…`);
    pos += line.length + 1;
  }
  for (const m of text.matchAll(IBAN)) {
    if (isValidIban(m[0])) push("iban", m.index ?? 0, m[0].length, maskKeepEnds(m[0].toUpperCase(), 4, 4));
  }
  for (const source of [text, ocrDigits(text)]) {
    for (const m of source.matchAll(NIR)) {
      // « NlR » : le I du libellé est souvent lu l par la caméra.
      if (isValidNir(m[0]) || /securite sociale|n° ss|\bn[il1|]r\b/.test(folded.slice(Math.max(0, (m.index ?? 0) - 40), m.index))) {
        push("securite_sociale", m.index ?? 0, m[0].length, maskKeepEnds(m[0], 1, 2));
      }
    }
  }
  for (const m of folded.matchAll(FISCAL)) {
    const i = (m.index ?? 0) + m[0].lastIndexOf(m[1]);
    push("numero_fiscal", i, m[1].length, maskKeepEnds(m[1], 2, 3));
  }
  for (const m of text.matchAll(CARD)) {
    const digits = m[0].replace(/\D/g, "");
    const ctx = folded.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
    // Un n° de télépaiement ou de dossier peut passer Luhn par hasard : le contexte doit parler de carte.
    if (/^[2-6]/.test(digits) && luhn(digits) && /carte|cb\b|card|visa|mastercard/.test(ctx)) {
      push("carte_bancaire", m.index ?? 0, m[0].length, maskKeepEnds(digits, 0, 4));
    }
  }
  for (const m of text.matchAll(SIRET)) {
    // Seulement s'il est annoncé : 14 chiffres sans libellé peuvent être une référence de facture.
    const ctx = folded.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
    if (/siret/.test(ctx)) push("siret", m.index ?? 0, m[0].length, m[0].replace(/\D/g, ""));
  }
  for (const m of text.matchAll(PASSPORT)) {
    const i = (m.index ?? 0) + m[0].lastIndexOf(m[1]);
    push("passeport", i, m[1].length, maskKeepEnds(m[1], 2, 2));
  }
  for (const m of folded.matchAll(BIRTH)) {
    const i = (m.index ?? 0) + m[0].lastIndexOf(m[1]);
    push("date_naissance", i, m[1].length, "••/••/" + m[1].slice(-4));
  }
  for (const m of text.matchAll(EMAIL)) push("email", m.index ?? 0, m[0].length, maskEmail(m[0]));
  for (const m of text.matchAll(PHONE_FR)) push("telephone", m.index ?? 0, m[0].length, maskKeepEnds(m[0], 2, 2));
  for (const m of text.matchAll(PHONE_INTL)) push("telephone", m.index ?? 0, m[0].length, maskKeepEnds(m[0], 3, 2));
  for (const m of text.matchAll(ADDRESS)) push("adresse", m.index ?? 0, m[0].length, "•• rue ••••, " + (m[0].match(/\d{5}/)?.[0] ?? ""));

  return out.sort((a, b) => a.index - b.index);
}

/** Le texte prêt à partager : chaque donnée personnelle (de la sensibilité choisie) remplacée par sa version masquée. */
export function redactText(text: string, items: PersonalItem[], minimum: Sensitivity = "moyenne"): string {
  const rank: Record<Sensitivity, number> = { basse: 0, moyenne: 1, haute: 2 };
  const chosen = items.filter((i) => rank[i.sensitivity] >= rank[minimum]).sort((a, b) => b.index - a.index);
  let out = text;
  for (const it of chosen) out = out.slice(0, it.index) + `[${it.label} masqué]` + out.slice(it.index + it.length);
  return out;
}

export interface ExposureSummary {
  total: number;
  high: number;
  kinds: PersonalKind[];
}

export function exposureSummary(items: PersonalItem[]): ExposureSummary {
  return {
    total: items.length,
    high: items.filter((i) => i.sensitivity === "haute").length,
    kinds: [...new Set(items.map((i) => i.kind))],
  };
}
