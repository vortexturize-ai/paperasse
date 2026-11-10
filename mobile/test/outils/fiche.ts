import type { EngineResult } from "../../src/engine/analyze.ts";
import type { Intent } from "../../src/engine/i18n.ts";
import { cleanText, fold } from "../../src/engine/normalize.ts";
import { isValidDate } from "../../src/engine/dates.ts";
import { CATEGORIES, DOC_TYPES, URGENCY, type Category, type DocType, type Urgency } from "../../src/lib/categories.ts";

export const TODAY = "2026-11-09"; // lundi

/** Ce qu'un humain attentif lirait sur le papier. Un champ absent n'est pas vérifié. */
export interface Attendu {
  type?: DocType;
  dossier?: Category;
  emetteur?: string | null;
  organisme?: string | null;
  date_document?: string | null;
  date_limite?: string | null;
  date_expiration?: string | null;
  montant?: number | null;
  sens?: "a_payer" | "a_recevoir" | "information" | null;
  a_traiter?: boolean;
  intention?: Intent;
  urgence?: Urgency;
  /** Libellé → valeur exacte (sous-ensemble des infos clés). */
  infos?: Record<string, string>;
  /** Libellés qui ne doivent PAS apparaître. */
  sans_infos?: string[];
  /** La phrase citée pour la date limite doit correspondre. */
  extrait?: RegExp;
  resume?: RegExp;
}

export interface Papier {
  id: string;
  texte: string;
  attendu: Attendu;
  today?: string;
}

export type Champ = keyof Attendu;

export const CHAMPS_FIABILITE: Champ[] = [
  "type", "dossier", "emetteur", "organisme", "date_document", "date_limite", "date_expiration",
  "montant", "sens", "a_traiter", "intention", "urgence", "infos",
];

export interface Ecart {
  champ: Champ;
  attendu: unknown;
  obtenu: unknown;
}

const compact = (s: string) => fold(s).replace(/[\s.\-]/g, "");
/** Espaces typographiques (fine insécable dans « 1 956,25 € ») = espace simple. */
const spaces = (s: string) => s.replace(/[\s  ]+/g, " ");

/** Compare une fiche à l'attendu. `souple` : noms et valeurs comparés sans accents, casse ni espaces
 *  (une photo en majuscules ou sans accents donne « CAISSE D'EPARGNE » au lieu de « Caisse d'Épargne »). */
export function comparer(r: EngineResult, a: Attendu, souple = false): Ecart[] {
  const ecarts: Ecart[] = [];
  const eq = (champ: Champ, attendu: unknown, obtenu: unknown) => {
    if (attendu === undefined) return;
    let same = attendu === obtenu;
    if (!same && souple && typeof attendu === "string" && typeof obtenu === "string") same = compact(attendu) === compact(obtenu);
    if (!same) ecarts.push({ champ, attendu, obtenu });
  };
  eq("type", a.type, r.type_document);
  eq("dossier", a.dossier, r.categorie);
  eq("emetteur", a.emetteur, r.emetteur);
  eq("organisme", a.organisme, r.organisme);
  eq("date_document", a.date_document, r.date_document);
  eq("date_limite", a.date_limite, r.date_limite);
  eq("date_expiration", a.date_expiration, r.date_expiration);
  eq("montant", a.montant, r.montant);
  eq("sens", a.sens, r.montant_sens);
  eq("a_traiter", a.a_traiter, r.a_traiter);
  eq("intention", a.intention, r.intention);
  eq("urgence", a.urgence, r.urgence);
  if (a.infos) {
    for (const [label, valeur] of Object.entries(a.infos)) {
      const got = r.infos_cles.find((f) => f.label === label)?.valeur;
      const same = (got !== undefined && spaces(got) === spaces(valeur)) || (souple && got !== undefined && compact(got) === compact(valeur));
      if (!same) ecarts.push({ champ: "infos", attendu: `${label} = ${valeur}`, obtenu: got ?? "(absent)" });
    }
  }
  for (const label of a.sans_infos ?? []) {
    const got = r.infos_cles.find((f) => f.label === label);
    if (got) ecarts.push({ champ: "infos", attendu: `${label} absent`, obtenu: got.valeur });
  }
  if (a.extrait && !a.extrait.test(r.date_limite_extrait ?? "")) ecarts.push({ champ: "extrait", attendu: String(a.extrait), obtenu: r.date_limite_extrait });
  if (a.resume && !a.resume.test(r.resume)) ecarts.push({ champ: "resume", attendu: String(a.resume), obtenu: r.resume });
  return ecarts;
}

export function decrire(ecarts: Ecart[]): string {
  return ecarts.map((e) => `  ${e.champ} : attendu ${JSON.stringify(e.attendu)}, obtenu ${JSON.stringify(e.obtenu)}`).join("\n");
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (s: string) => ISO.test(s) && isValidDate(Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10)));
const BROKEN = /undefined|NaN|\[object|null\b|\{|\}|\$\{/;
const FULL_IBAN = /\bFR\d{2}(?:\s?[A-Z0-9]{4}){5}\s?[A-Z0-9]{3}\b/i;
const FULL_NIR = /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/;

/** Règles qui doivent tenir pour N'IMPORTE QUEL texte, même absurde. Renvoie la liste des violations. */
export function verifierFiche(r: EngineResult, entree: string): string[] {
  const p: string[] = [];
  if (!(r.type_document in DOC_TYPES)) p.push(`type inconnu ${r.type_document}`);
  if (!(r.categorie in CATEGORIES)) p.push(`dossier inconnu ${r.categorie}`);
  if (!(r.urgence in URGENCY)) p.push(`urgence inconnue ${r.urgence}`);
  if (typeof r.titre !== "string" || r.titre.trim() === "" || r.titre.length > 140) p.push(`titre invalide ${JSON.stringify(r.titre)}`);
  if (typeof r.resume !== "string" || r.resume.trim() === "") p.push("résumé vide");
  for (const [nom, v] of [["titre", r.titre], ["resume", r.resume], ["emetteur", r.emetteur ?? ""], ["objet", r.date_limite_objet ?? ""]] as const) {
    if (BROKEN.test(v)) p.push(`${nom} cassé : ${JSON.stringify(v)}`);
  }
  for (const [nom, v] of [["date_document", r.date_document], ["date_limite", r.date_limite], ["date_expiration", r.date_expiration]] as const) {
    if (v !== null && !isIso(v)) p.push(`${nom} invalide ${v}`);
  }
  if (r.montant !== null && !(Number.isFinite(r.montant) && r.montant > 0 && r.montant < 100_000_000 && Math.abs(Math.round(r.montant * 100) - r.montant * 100) < 1e-6)) {
    p.push(`montant invalide ${r.montant}`);
  }
  if ((r.montant === null) !== (r.montant_sens === null)) p.push("montant et sens incohérents");
  if ((r.date_limite === null) !== (r.date_limite_objet === null)) p.push("date limite sans objet (ou l'inverse)");
  if (r.date_limite !== null && !r.date_limite_extrait) p.push("date limite sans phrase citée");
  if (!Array.isArray(r.actions) || r.actions.some((s) => typeof s !== "string" || !s.trim() || BROKEN.test(s))) p.push("actions invalides");
  if (new Set(r.actions).size !== r.actions.length) p.push("actions en double");
  if (r.actions.length > 6) p.push("trop d'actions");
  // Exception : face à une arnaque, rien à faire mais les bons réflexes sont listés.
  if (!r.a_traiter && ((r.actions.length > 0 && r.arnaque?.level !== "arnaque_probable") || r.urgence !== "aucune")) p.push("rien à faire mais des actions ou une urgence");
  if (r.a_traiter && r.urgence === "aucune") p.push("à faire mais sans urgence");
  if (r.infos_cles.length > 10) p.push("trop d'infos clés");
  for (const f of r.infos_cles) {
    if (!f.label || !f.valeur || f.valeur.length > 60 || BROKEN.test(f.valeur)) p.push(`info clé invalide ${JSON.stringify(f)}`);
    if (FULL_IBAN.test(f.valeur) || FULL_NIR.test(f.valeur)) p.push(`numéro sensible en clair : ${f.label}`);
  }
  // Rien de sensible ne doit sortir en clair ailleurs que dans le texte lu.
  for (const v of [r.titre, r.resume, ...r.actions, ...r.mots_cles]) {
    if (FULL_IBAN.test(v)) p.push("IBAN en clair hors du texte");
  }
  if (new Set(r.mots_cles).size !== r.mots_cles.length) p.push("mots-clés en double");
  if (!(r.confiance >= 0 && r.confiance <= 1)) p.push(`confiance hors bornes ${r.confiance}`);
  if (r.texte !== cleanText(entree)) p.push("le texte rendu n'est pas le texte lu");
  return p;
}
