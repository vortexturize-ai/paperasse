import { cleanText, fold } from "./normalize.ts";

/**
 * Doublons : le même papier ajouté deux fois (photographié à nouveau, PDF reçu deux fois, texte recollé).
 *
 * Le piège : deux factures du même fournisseur, deux fiches de paie du même employeur ont presque les mêmes
 * mots. Ce qui les distingue, ce sont les nombres (dates, montants, numéro de facture) et les dates lues par
 * le moteur : un doublon doit avoir les mêmes mots ET les mêmes nombres, sans date ni montant différents.
 * Mieux vaut rater un doublon que d'en signaler un faux.
 */

/** Ce qu'il faut d'un papier pour le comparer (champs de la fiche). */
export interface DuplicateInput {
  id: string;
  fullText: string | null;
  docDate: string | null;
  amount: number | null;
  deadline: string | null;
  expiryDate: string | null;
  issuer: string | null;
  amountDirection: string | null;
}

export type DuplicateKind = "identique" | "proche";

export interface DuplicateMatch {
  id: string;
  kind: DuplicateKind;
  /** 0 à 1 : ressemblance des mots. */
  score: number;
}

interface Fingerprint {
  /** Tout le texte replié (pour « identique »). */
  exact: string;
  words: Set<string>;
  numbers: Set<string>;
}

/** En dessous, trop peu de texte pour juger (hors texte identique). */
const MIN_WORDS = 12;
const MIN_EXACT = 40;
const WORDS_WITH_NUMBERS = 0.7;
const WORDS_ALONE = 0.85;
const NUMBERS = 0.75;
/** Assez de nombres de chaque côté pour qu'ils départagent. */
const ENOUGH_NUMBERS = 3;
/** Nombres d'au moins 3 chiffres : « Page 1/2 », les puces et les jours seuls varient trop d'une photo à l'autre. */
const MIN_DIGITS = 3;

const prints = new WeakMap<DuplicateInput, Fingerprint>();

/** Calculée une fois par papier, même s'il est comparé à tout le coffre. */
function fingerprintOf(doc: DuplicateInput, text: string): Fingerprint {
  let f = prints.get(doc);
  if (!f) {
    f = fingerprint(text);
    prints.set(doc, f);
  }
  return f;
}

function fingerprint(text: string): Fingerprint {
  const folded = fold(cleanText(text));
  const exact = (folded.match(/[\p{L}\p{N}]+/gu) ?? []).join(" ");
  const words = new Set(folded.match(/\p{L}{3,}/gu) ?? []);
  // « 15/11/2026 », « 1 234,56 » coupé par l'espace, « FR76-3000… » : on garde les chiffres, sans séparateurs.
  const numbers = new Set<string>();
  for (const run of folded.match(/\d(?:[\d.,/:-]*\d)?/g) ?? []) {
    const digits = run.replace(/\D/g, "");
    if (digits.length >= MIN_DIGITS) numbers.add(digits);
  }
  return { exact, words, numbers };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let common = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) common++;
  return common / (a.size + b.size - common);
}

/** Deux valeurs lues par le moteur qui se contredisent : pas le même papier. */
function conflict<T>(a: T | null, b: T | null, same: (x: T, y: T) => boolean = (x, y) => x === y): boolean {
  return a != null && b != null && !same(a, b);
}

function fieldsDisagree(a: DuplicateInput, b: DuplicateInput): boolean {
  return (
    conflict(a.docDate, b.docDate) ||
    conflict(a.deadline, b.deadline) ||
    conflict(a.expiryDate, b.expiryDate) ||
    conflict(a.amount, b.amount, (x, y) => Math.abs(x - y) < 0.01) ||
    conflict(a.amountDirection, b.amountDirection) ||
    conflict(a.issuer, b.issuer, (x, y) => fold(x).trim() === fold(y).trim())
  );
}

function compare(a: Fingerprint, b: Fingerprint): { kind: DuplicateKind; score: number } | null {
  if (a.exact.length >= MIN_EXACT && a.exact === b.exact) return { kind: "identique", score: 1 };
  if (Math.min(a.words.size, b.words.size) < MIN_WORDS) return null;
  const words = jaccard(a.words, b.words);
  if (words < WORDS_WITH_NUMBERS) return null;
  const numbers = jaccard(a.numbers, b.numbers);
  if (a.numbers.size >= ENOUGH_NUMBERS && b.numbers.size >= ENOUGH_NUMBERS) return numbers >= NUMBERS ? { kind: "proche", score: words } : null;
  // Peu de nombres : il faut des mots presque identiques et les mêmes nombres (une lettre datée et la même
  // sans date ne sont pas le même papier ; deux ensembles vides sont égaux).
  return words >= WORDS_ALONE && numbers >= NUMBERS ? { kind: "proche", score: words } : null;
}

/**
 * Le papier du coffre qui ressemble le plus à `doc`, s'il y en a un assez proche pour être le même.
 * `others` ne doit pas contenir `doc`.
 */
export function findTextDuplicate(doc: DuplicateInput, others: readonly DuplicateInput[]): DuplicateMatch | null {
  const text = doc.fullText;
  if (!text?.trim()) return null;
  const mine = fingerprintOf(doc, text);
  let best: DuplicateMatch | null = null;
  for (const other of others) {
    const otherText = other.fullText;
    if (other.id === doc.id || !otherText?.trim() || fieldsDisagree(doc, other)) continue;
    const hit = compare(mine, fingerprintOf(other, otherText));
    if (!hit) continue;
    if (!best || (hit.kind === "identique" && best.kind !== "identique") || (hit.kind === best.kind && hit.score > best.score)) {
      best = { id: other.id, ...hit };
    }
  }
  return best;
}
