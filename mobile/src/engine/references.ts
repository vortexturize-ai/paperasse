export interface KeyFact {
  label: string;
  valeur: string;
}

interface Rule {
  label: string;
  re: RegExp; // sur le texte replié ; groupe 1 = valeur
  clean?: (v: string) => string;
  mask?: boolean;
}

const spaces = (v: string) => v.replace(/\s+/g, " ").trim();
const digitsOnly = (v: string) => v.replace(/\D/g, "");

const NUM = String.raw`(?:n[°ºo]|no\.?|numero)`;
// Entre le libellé et la valeur : jusqu'à 3 mots de précision (« N° de dossier social étudiant : »).
const QUALIF = String.raw`(?:\s+[a-z']{2,15}){0,3}?`;
// La valeur contient un chiffre (sinon ce sont des mots : « N° de dossier social étudiant : … »).
const VALUE = String.raw`((?=[a-z0-9\-/ ]{0,25}\d)[a-z0-9][a-z0-9\-/ ]{2,24}[a-z0-9])`;

const RULES: Rule[] = [
  { label: "N° allocataire", re: new RegExp(String.raw`${NUM}\s*(?:d'|de l')?\s*allocataire\s*:?\s*([a-z0-9][a-z0-9 ]{4,13}[a-z0-9])`), clean: spaces },
  // (?![\d/]|[.,]\d) : le numéro s'arrête avant « 1/2 » (numéro de page) ou une date collée.
  // Formats officiels : numéro fiscal 13 chiffres, sécurité sociale 15, SIRET 14 (SIREN 9 + NIC 5).
  { label: "Numéro fiscal", re: /numero fiscal\s*:?\s*(\d{2} ?\d{2} ?\d{3} ?\d{3} ?\d{3})(?![\d/]|[.,]\d)/, clean: spaces },
  { label: "Référence de l'avis", re: /reference de l'avis\s*:?\s*(\d[\d ]{9,24}\d(?: ?[a-z0-9](?![a-z0-9]))?)/, clean: spaces },
  { label: "N° de télépaiement", re: new RegExp(String.raw`${NUM} de telepaiement\s*:?\s*(\d[\d ]{9,32}\d)(?![\d/]|[.,]\d)`), clean: spaces },
  { label: "N° de sécurité sociale", re: new RegExp(String.raw`${NUM} de securite sociale\s*:?\s*([12] ?\d{2} ?\d{2} ?(?:\d{2}|2a|2b) ?\d{3} ?\d{3} ?\d{2})(?![\d/]|[.,]\d)`), clean: spaces, mask: true },
  { label: "N° de dossier", re: new RegExp(String.raw`(?:${NUM}|ref(?:erence)?\.?)\s*(?:de |du )?dossier${QUALIF}\s*:?\s*${VALUE}`), clean: spaces },
  { label: "N° de contrat", re: new RegExp(String.raw`(?:${NUM}\s*(?:de |du )?contrat${QUALIF}|contrat${QUALIF}\s*${NUM})\s*:?\s*${VALUE}`), clean: spaces },
  { label: "N° client", re: new RegExp(String.raw`(?:(?:${NUM}|ref(?:erence)?\.?)\s*(?:de )?client|client\s*${NUM})\s*:?\s*${VALUE}`), clean: spaces },
  { label: "N° de facture", re: new RegExp(String.raw`(?:${NUM}\s*(?:de )?facture|facture\s*${NUM})\s*:?\s*${VALUE}`), clean: spaces },
  { label: "N° de sociétaire", re: new RegExp(String.raw`${NUM}\s*(?:de )?societaire\s*:?\s*([a-z0-9][a-z0-9 ]{3,14}[a-z0-9])`), clean: spaces },
  { label: "N° d'adhérent", re: new RegExp(String.raw`${NUM}\s*(?:d')?adherent\s*:?\s*([a-z0-9][a-z0-9 ]{3,14}[a-z0-9])`), clean: spaces },
  { label: "Identifiant", re: /(?<![a-z])identifiant(?: france travail| client)?\s*:?\s*([a-z0-9]{5,15})(?![a-z0-9])/, clean: spaces },
  { label: "Référence", re: /(?:votre |notre )?reference\s*:\s*([a-z0-9][a-z0-9\-/ ]{2,24}[a-z0-9])/, clean: spaces },
  { label: "SIRET", re: /siret\s*:?\s*(\d{3} ?\d{3} ?\d{3} ?\d{5})(?![\d/]|[.,]\d)/, clean: digitsOnly },
  { label: "IBAN", re: /(?<![a-z0-9])(fr\d{2}(?:\s?[a-z0-9]{4}){5}\s?[a-z0-9]{3})(?![a-z0-9])/, clean: spaces, mask: true },
  { label: "Immatriculation", re: /(?<![a-z0-9-])([a-z]{2}-\d{3}-[a-z]{2})(?![a-z0-9-])/ },
];

/** Cache le milieu d'un numéro sensible : FR76 •••• •••• 1234. */
export function maskMiddle(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (compact.length <= 8) return value;
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`;
}

/** Coupe la valeur au premier mot qui ne fait plus partie du numéro (« 1A2B du 05/11 », « 12 345 Paris »). */
function trimValue(v: string): string {
  return v
    .split(/\s+(?=(?:du|le|au|en|et|des|pour|par)\s)|\s+(?=[A-Za-zÀ-ÿ]{4,})|\s+-\s+|\s*\(/i)[0]
    .trim();
}

export function findReferences(text: string, folded: string): KeyFact[] {
  const facts: KeyFact[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    if (seen.has(rule.label)) continue;
    const m = rule.re.exec(folded);
    if (!m || m.index === undefined) continue;
    const start = m.index + m[0].lastIndexOf(m[1]);
    let value = text.slice(start, start + m[1].length);
    value = trimValue(rule.clean ? rule.clean(value) : value);
    // Un numéro contient au moins un chiffre : « numéro de dossier vous sera communiqué » n'en est pas un.
    if (value.length < 3 || !/\d/.test(value)) continue;
    if (rule.label === "Immatriculation" || rule.label === "IBAN") value = value.toUpperCase();
    seen.add(rule.label);
    facts.push({ label: rule.label, valeur: rule.mask ? maskMiddle(value) : value });
  }
  return facts;
}
