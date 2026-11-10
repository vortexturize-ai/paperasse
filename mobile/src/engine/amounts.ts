import { before, lastIndexOfWord } from "./normalize.ts";

export type AmountDirection = "a_payer" | "a_recevoir" | "information";

export interface AmountMention {
  value: number;
  index: number;
  length: number;
}

export interface AmountResult {
  value: number;
  direction: AmountDirection;
  index: number;
}

// 1 234,56 € · 1.234,56 EUR · 612 € · 35,00€ · € 35,00 · 1234.56 € · 35,- €
// Les groupes de milliers sont capturés d'un bloc (?=(…))\1 : pas de retour en arrière, donc pas de
// blocage sur un texte piège (« 123 123 123 … » sans €).
// « €96.25 » (site marchand) : le groupe de milliers n'est essayé que s'il existe vraiment.
const AMOUNT =
  /(?:€|(?<![a-z])eur)\s?(?=(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?))\1(?![\d,])|(?<![\d.,])(?=(\d{1,3}(?:[ .]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2}|,-)?))\2\s?(?:€|eur(?:os?)?(?![a-z]))/g;

// Un montant juste après « capital » est celui de la société, jamais celui du papier.
const CAPITAL = /capital(?: social)?(?: de)?\s*:?\s*$/;
// Peine encourue citée par un texte de loi (« 30 000 € d'amende »), taux horaire : jamais le montant du papier.
const PENALTY_AFTER = /^\s*d'amende/;
const PENALTY_BEFORE = /emprisonnement|est puni|sont punis|passible/;
const HOURLY = /^\s*(?:\/\s*h(?:eure)?\b|de l'heure|par heure|brut de l'heure|net de l'heure)/;

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\s/g, "").replace(/,-$/, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(?!\d)/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
}

export function findAmounts(folded: string): AmountMention[] {
  const out: AmountMention[] = [];
  for (const m of folded.matchAll(AMOUNT)) {
    const raw = m[1] ?? m[2];
    const value = raw ? parseAmount(raw) : null;
    if (value === null || value <= 0) continue;
    const at = m.index ?? 0;
    const next = folded.slice(at + m[0].length, at + m[0].length + 20);
    if (CAPITAL.test(before(folded, at, 30))) continue;
    if (PENALTY_AFTER.test(next) || PENALTY_BEFORE.test(before(folded, at, 80))) continue;
    if (HOURLY.test(next) || /taux horaire\s*:?\s*$/.test(before(folded, at, 20))) continue;
    out.push({ value, index: at, length: m[0].length });
  }
  return out;
}

const PAY_CUES: [string, number][] = [
  ["montant a payer", 10],
  ["restant du", 10],
  ["montant restant", 8],
  ["solde en notre faveur", 10],
  ["somme due", 9],
  ["regler la somme", 9],
  ["payer la somme", 9],
  ["montant de votre impot", 9],
  ["montant de votre taxe", 9],
  ["impot a payer", 9],
  ["d'un montant de", 6],
  ["la somme de", 5],
  ["cotisation annuelle", 5],
  ["total a payer", 10],
  ["reste a payer", 10],
  ["somme a payer", 9],
  ["solde a payer", 9],
  ["montant de l'amende", 9],
  ["amende forfaitaire", 8],
  ["montant du", 8],
  ["a regler", 8],
  ["a payer", 7],
  ["total ttc", 6],
  ["montant ttc", 6],
  ["montant a rembourser", 9],
  ["vous devez", 6],
  ["prelevement", 4],
  ["total", 2],
];

const RECEIVE_CUES: [string, number][] = [
  ["vous allez recevoir", 10],
  ["degrevement de", 9],
  ["degrevement", 7],
  ["solde en votre faveur", 11],
  ["nous vous versons", 10],
  ["total rembourse", 10],
  ["montant rembourse", 9],
  ["rembourse par", 8],
  ["vous beneficiez", 7],
  ["montant journalier", 7],
  ["votre allocation", 6],
  ["sera vire", 9],
  ["vous recevrez", 10],
  ["sera verse", 9],
  ["montant verse", 9],
  ["vous sera rembourse", 9],
  ["remboursement de", 7],
  ["montant de votre aide", 9],
  ["montant de vos droits", 8],
  ["a percevoir", 8],
  ["restitution", 7],
  ["net paye", 9],
  ["net a payer", 9], // sur une fiche de paie, c'est ce que la personne reçoit
  ["montant du paiement", 10],
  ["montant net du paiement", 11],
  ["montant du versement", 10],
  ["montant net verse", 10],
  ["montant de votre pension", 9],
  ["montant de la pension", 9],
  ["montant du droit", 10],
  ["montant de l'allocation", 9],
  ["montant de la prestation", 9],
  ["montant de l'aide", 9],
  ["montant mensuel", 8],
  ["total du paiement", 10],
  ["total verse", 10],
  ["total paye", 9],
  ["a ete verse", 9],
];

function bestCue(context: string, cues: [string, number][]): number {
  let best = 0;
  for (const [cue, weight] of cues) {
    const pos = lastIndexOfWord(context, cue);
    if (pos === -1) continue;
    // Plus l'indice est proche du montant, plus il compte.
    const proximity = 1 - (context.length - pos) / (context.length + 40);
    best = Math.max(best, weight * (0.5 + proximity));
  }
  return best;
}

/** Le montant principal du papier. `isPayslip` : « net à payer » = ce que la personne reçoit. */
export function mainAmount(folded: string, isPayslip = false): AmountResult | null {
  const amounts = findAmounts(folded);
  if (amounts.length === 0) return null;
  let best: AmountResult | null = null;
  let bestScore = -1;
  for (const a of amounts) {
    const ctx = before(folded, a.index, 70);
    const payCues = isPayslip ? PAY_CUES.filter(([c]) => c !== "a payer") : PAY_CUES.filter(([c]) => c !== "net a payer");
    const pay = isPayslip ? 0 : bestCue(ctx, payCues);
    const receive = bestCue(ctx, isPayslip ? [["net a payer", 12], ...RECEIVE_CUES] : RECEIVE_CUES.filter(([c]) => c !== "net a payer"));
    const score = Math.max(pay, receive) + a.value / 1_000_000; // à égalité, le plus gros
    if (score > bestScore) {
      bestScore = score;
      const direction: AmountDirection = pay === 0 && receive === 0 ? "information" : receive > pay ? "a_recevoir" : "a_payer";
      best = { value: a.value, direction, index: a.index };
    }
  }
  return best;
}

/** Montant juste après un libellé (« salaire brut », « net imposable »…). */
export function amountAfterLabel(folded: string, label: string): number | null {
  const at = folded.indexOf(label);
  if (at === -1) return null;
  const window = folded.slice(at + label.length, at + label.length + 60);
  const m = window.match(/(\d{1,3}(?:[ .]\d{3})*(?:,\d{1,2})|\d+(?:,\d{1,2}))/);
  return m ? parseAmount(m[1]) : null;
}
