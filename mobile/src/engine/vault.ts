import type { DocType } from "../lib/categories.ts";

export interface Paper {
  id: string;
  title: string;
  type: DocType;
  category: string;
  /** Nom affiché de l'expéditeur. */
  issuer: string | null;
  /** Identifiant d'organisme connu (« caf », « edf »…), si reconnu. */
  organisme: string | null;
  docDate: string | null;
  deadline: string | null;
  expiry: string | null;
  amount: number | null;
  amountDirection: "a_payer" | "a_recevoir" | "information" | null;
  text: string;
  /** Marqué « C'est fait » par l'utilisateur. */
  done: boolean;
  /** Date d'ajout dans l'app (AAAA-MM-JJ). */
  added: string;
}

/** Date de référence d'un papier : sa date, sinon sa date d'ajout. */
export function paperDate(p: Paper): string {
  return p.docDate ?? p.added;
}

/** Les papiers d'un type, du plus récent au plus ancien. */
export function latest(papers: Paper[], types: DocType[]): Paper[] {
  return papers.filter((p) => types.includes(p.type)).sort((a, b) => paperDate(b).localeCompare(paperDate(a)));
}
