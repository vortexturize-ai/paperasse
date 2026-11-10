// Spécifications techniques des codes à barres 2D-DOC, France Titres (ANTS), V 3.3.9 :
// en-tête § 3.3, message § 3.4.1, signature § 3.5.2, annexe § 3.6, types § 6.1, données § 7.0 à 7.4.
const GS = "\x1d";
const RS = "\x1e";
const US = "\x1f";

export interface FieldDef {
  label: string;
  min: number;
  /** Infinity = « Aucune » (pas de borne). */
  max: number;
  kind?: "date8" | "hexdate" | "period" | "euros" | "eurosInt" | "phone" | "contract" | "nature" | "bool" | "url" | "uuid";
}

const V = Infinity;

/** Identifiants des sections 7.0 à 7.4 (périmètre C40 « 01 »). */
export const FIELDS: Record<string, FieldDef> = {
  // 7.0 Données complémentaires
  "01": { label: "Identifiant unique du document", min: 0, max: V },
  "02": { label: "Catégorie de document", min: 0, max: V },
  "03": { label: "Sous-catégorie de document", min: 0, max: V },
  "04": { label: "Application de composition", min: 0, max: V },
  "05": { label: "Version de l'application de composition", min: 0, max: V },
  "06": { label: "Date de l'association au code", min: 4, max: 4, kind: "hexdate" },
  "07": { label: "Heure de l'association au code", min: 6, max: 6 },
  "08": { label: "Date d'expiration du document", min: 4, max: 4, kind: "hexdate" },
  "09": { label: "Nombre de pages", min: 4, max: 4 },
  "0A": { label: "Éditeur du 2D-Doc (SIREN)", min: 9, max: 9 },
  "0B": { label: "Intégrateur du 2D-Doc (SIREN)", min: 9, max: 9 },
  "0C": { label: "Adresse du document en ligne", min: 0, max: V, kind: "url" },
  "0D": { label: "Identifiant (UUID) du document", min: 36, max: 36, kind: "uuid" },
  // 7.1 Factures
  "10": { label: "Bénéficiaire (ligne 1 de l'adresse)", min: 1, max: 38 },
  "11": { label: "Qualité du bénéficiaire", min: 1, max: 38 },
  "12": { label: "Prénom du bénéficiaire", min: 1, max: 38 },
  "13": { label: "Nom du bénéficiaire", min: 1, max: 38 },
  "14": { label: "Destinataire de la facture (ligne 1)", min: 1, max: 38 },
  "15": { label: "Qualité du destinataire", min: 1, max: 38 },
  "16": { label: "Prénom du destinataire", min: 1, max: 38 },
  "17": { label: "Nom du destinataire", min: 1, max: 38 },
  "18": { label: "Numéro de la facture", min: 1, max: V },
  "19": { label: "Numéro de client", min: 1, max: V },
  "1A": { label: "Numéro du contrat", min: 1, max: V },
  "1B": { label: "Identifiant du souscripteur", min: 1, max: V },
  "1C": { label: "Date d'effet du contrat", min: 8, max: 8, kind: "date8" },
  "1D": { label: "Montant TTC de la facture", min: 0, max: 16, kind: "euros" },
  "1E": { label: "Téléphone du bénéficiaire", min: 0, max: 30, kind: "phone" },
  "1F": { label: "Téléphone du destinataire", min: 0, max: 30, kind: "phone" },
  "1G": { label: "Autre bénéficiaire non mentionné", min: 1, max: 1, kind: "bool" },
  "1H": { label: "Autre destinataire non mentionné", min: 1, max: 1, kind: "bool" },
  "1I": { label: "Co-bénéficiaire (ligne 1)", min: 0, max: 38 },
  "1J": { label: "Qualité du co-bénéficiaire", min: 0, max: 38 },
  "1K": { label: "Prénom du co-bénéficiaire", min: 0, max: 38 },
  "1L": { label: "Nom du co-bénéficiaire", min: 0, max: 38 },
  "1M": { label: "Co-destinataire (ligne 1)", min: 0, max: 38 },
  "1N": { label: "Qualité du co-destinataire", min: 0, max: 38 },
  "1O": { label: "Prénom du co-destinataire", min: 0, max: 38 },
  "1P": { label: "Nom du co-destinataire", min: 0, max: 38 },
  "20": { label: "Adresse du lieu de service (ligne 2)", min: 0, max: 38 },
  "21": { label: "Adresse du lieu de service (ligne 3)", min: 1, max: 38 },
  "22": { label: "Adresse du lieu de service (n° et voie)", min: 1, max: 38 },
  "23": { label: "Adresse du lieu de service (ligne 5)", min: 0, max: 38 },
  "24": { label: "Code postal du lieu de service", min: 5, max: 5 },
  "25": { label: "Commune du lieu de service", min: 1, max: 32 },
  "26": { label: "Pays du lieu de service", min: 2, max: 2 },
  "27": { label: "Adresse du destinataire (ligne 2)", min: 0, max: 38 },
  "28": { label: "Adresse du destinataire (ligne 3)", min: 0, max: 38 },
  "29": { label: "Adresse du destinataire (n° et voie)", min: 1, max: 38 },
  "2A": { label: "Adresse du destinataire (ligne 5)", min: 0, max: 38 },
  "2B": { label: "Code postal du destinataire", min: 5, max: 5 },
  "2C": { label: "Commune du destinataire", min: 1, max: 32 },
  "2D": { label: "Pays du destinataire", min: 2, max: 2 },
  // 7.2 Données bancaires
  "30": { label: "Titulaire (qualité, nom, prénom)", min: 0, max: 140 },
  "31": { label: "IBAN", min: 14, max: 38 },
  "32": { label: "BIC", min: 8, max: 11 },
  "33": { label: "BBAN", min: 0, max: 30 },
  "34": { label: "Pays du compte", min: 2, max: 2 },
  "35": { label: "Identifiant SEPAmail", min: 14, max: 34 },
  "36": { label: "Début de période", min: 4, max: 4, kind: "hexdate" },
  "37": { label: "Fin de période", min: 4, max: 4, kind: "hexdate" },
  "38": { label: "Solde en début de période", min: 0, max: 11, kind: "euros" },
  "39": { label: "Solde en fin de période", min: 0, max: 11, kind: "euros" },
  // 7.3 Données fiscales
  "40": { label: "Numéro fiscal", min: 13, max: 13 },
  "41": { label: "Revenu fiscal de référence", min: 0, max: 12, kind: "eurosInt" },
  "42": { label: "Situation du foyer", min: 0, max: V },
  "43": { label: "Nombre de parts", min: 1, max: 5 },
  "44": { label: "Référence de l'avis d'impôt", min: 13, max: 13 },
  "45": { label: "Année des revenus", min: 4, max: 4 },
  "46": { label: "Déclarant 1", min: 0, max: 38 },
  "47": { label: "Numéro fiscal du déclarant 1", min: 13, max: 13 },
  "48": { label: "Déclarant 2", min: 0, max: 38 },
  "49": { label: "Numéro fiscal du déclarant 2", min: 13, max: 13 },
  "4A": { label: "Date de mise en recouvrement", min: 8, max: 8, kind: "date8" },
  "4B": { label: "Date de la déclaration", min: 8, max: 8, kind: "date8" },
  "4C": { label: "Date d'enregistrement", min: 8, max: 8, kind: "date8" },
  "4D": { label: "Montant du don", min: 0, max: 12, kind: "eurosInt" },
  "4E": { label: "Montant des droits payés", min: 0, max: 12, kind: "eurosInt" },
  "4F": { label: "Référence d'enregistrement", min: 15, max: 15 },
  "4G": { label: "Nom du donataire", min: 0, max: 38 },
  "4H": { label: "Donateur(s)", min: 0, max: 77 },
  "4I": { label: "Montant taxable", min: 0, max: 12, kind: "eurosInt" },
  "4J": { label: "Montant de la cession", min: 0, max: 12, kind: "eurosInt" },
  "4K": { label: "Cessionnaire", min: 0, max: 38 },
  "4L": { label: "Cédant", min: 0, max: 38 },
  "4M": { label: "Taux applicable (%)", min: 0, max: 3 },
  "4N": { label: "Déclarant", min: 0, max: 38 },
  "4O": { label: "Adresse du déclarant", min: 0, max: 38 },
  "4P": { label: "Code postal du déclarant", min: 5, max: 5 },
  "4Q": { label: "Commune du déclarant", min: 0, max: 32 },
  "4R": { label: "Service des impôts gestionnaire", min: 0, max: 30 },
  "4S": { label: "Millésime", min: 4, max: 4 },
  "4T": { label: "Administration cantonale suisse", min: 0, max: 30 },
  "4U": { label: "Employeur", min: 0, max: 38 },
  "4V": { label: "Impôt sur le revenu net", min: 0, max: 10, kind: "eurosInt" },
  "4W": { label: "Reste à payer", min: 0, max: 10, kind: "eurosInt" },
  "4X": { label: "Retenue à la source", min: 0, max: 10, kind: "eurosInt" },
  "4Y": { label: "Adresse complète du domicile", min: 1, max: 155 },
  "4Z": { label: "Prélèvements sociaux nets", min: 0, max: 10, kind: "eurosInt" },
  // 7.4 Activité professionnelle
  "50": { label: "SIRET de l'employeur", min: 14, max: 14 },
  "51": { label: "Heures travaillées", min: 6, max: 6 },
  "52": { label: "Cumul des heures travaillées", min: 7, max: 7 },
  "53": { label: "Début de période", min: 4, max: 4, kind: "hexdate" },
  "54": { label: "Fin de période", min: 4, max: 4, kind: "hexdate" },
  "55": { label: "Début du contrat", min: 8, max: 8, kind: "date8" },
  "56": { label: "Fin du contrat", min: 4, max: 4, kind: "hexdate" },
  "57": { label: "Signature du contrat", min: 8, max: 8, kind: "date8" },
  "58": { label: "Salaire net imposable", min: 0, max: 11, kind: "euros" },
  "59": { label: "Cumul du net imposable", min: 0, max: 12, kind: "euros" },
  "5A": { label: "Salaire brut du mois", min: 0, max: 11, kind: "euros" },
  "5B": { label: "Cumul du salaire brut", min: 0, max: 12, kind: "euros" },
  "5C": { label: "Salaire net", min: 0, max: 11, kind: "euros" },
  "5D": { label: "Adresse de l'employeur (ligne 2)", min: 0, max: 38 },
  "5E": { label: "Adresse de l'employeur (ligne 3)", min: 0, max: 38 },
  "5F": { label: "Adresse de l'employeur (n° et voie)", min: 0, max: 38 },
  "5G": { label: "Adresse de l'employeur (ligne 5)", min: 0, max: 38 },
  "5H": { label: "Code postal de l'employeur", min: 5, max: 5 },
  "5I": { label: "Commune de l'employeur", min: 0, max: 32 },
  "5J": { label: "Pays de l'employeur", min: 2, max: 2 },
  "5K": { label: "Identifiant cotisant (URSSAF)", min: 0, max: 50 },
  "5L": { label: "SIRET ou RNA", min: 9, max: 14 },
  "5M": { label: "Dénomination sociale", min: 0, max: 38 },
  "5N": { label: "Dossier d'autorisation de travail", min: 21, max: 21 },
  "5O": { label: "Nom de l'employeur", min: 0, max: 38 },
  "5P": { label: "Prénom de l'employeur", min: 0, max: 20 },
  "5Q": { label: "Nom du déclarant", min: 0, max: 38 },
  "5R": { label: "Prénom du déclarant", min: 0, max: 20 },
  "5S": { label: "Fonction du déclarant", min: 0, max: 40 },
  "5T": { label: "Type de contrat", min: 1, max: 1, kind: "contract" },
  "5U": { label: "Durée du contrat", min: 0, max: 12 },
  "5V": { label: "Période de déclaration", min: 12, max: 12, kind: "period" },
  "5W": { label: "Nature du contrat", min: 2, max: 2, kind: "nature" },
  "5X": { label: "Intitulé du poste", min: 1, max: 38 },
  "5Y": { label: "Période de rémunération", min: 12, max: 12, kind: "period" },
  "5Z": { label: "Rémunération de la période", min: 1, max: 11, kind: "eurosInt" },
};

/** Types de documents, périmètre « 01 » (section 6.1). */
export const DOC_TYPES_2D: Record<string, string> = {
  "00": "Justificatif de domicile",
  "01": "Facture (énergie, téléphone, internet, eau)",
  "02": "Avis de taxe d'habitation",
  "03": "Relevé d'identité bancaire",
  "05": "Relevé d'identité SEPAmail",
  "11": "Relevé de compte",
  "09": "Facture étendue",
  "19": "Déclaration de dons",
  "20": "Déclaration de cession de droits sociaux",
  "21": "Attestation 2041-ASK",
  "04": "Avis d'impôt sur les revenus",
  "06": "Bulletin de salaire",
  "18": "Avis de situation déclarative à l'impôt sur les revenus",
  "24": "Avis de situation déclarative à l'impôt sur les revenus (V2)",
  "27": "Avis de situation déclarative à l'impôt sur les revenus (V3)",
  "28": "Avis d'impôt sur les revenus (V2)",
  "10": "Contrat de travail",
  "15": "Attestation de décision favorable d'autorisation de travail",
  "25": "Autorisation de travail – AES métier en tension",
  "29": "Attestation d'activité professionnelle",
  "07": "Titre d'identité",
  "08": "MRZ",
  "13": "Document étranger",
  A0: "Certificat de qualité de l'air",
  A7: "Certificat de qualité de l'air (V2)",
  "14": "Attestation DICEM",
  A8: "Certificat de cession électronique",
  A1: "Courrier permis à points",
  AA: "Arrêté permis de conduire",
  AB: "Relevé d'information permis de conduire",
  AD: "Certificat de réussite à l'examen du permis (CEPC)",
  B0: "Diplôme",
  B1: "Attestation de contribution vie étudiante (CVEC)",
  B4: "Traduction certifiée",
  A4: "Certificat de décès",
  AE: "Certificat de décès V2",
  A2: "Carte mobilité inclusion (CMI)",
  "23": "Certificat de preuve de vie",
  A3: "Macaron VTC",
  A5: "Carte T3P",
  A6: "Carte professionnelle sapeur-pompier",
  A9: "Permis de chasser",
  AC: "Licence de conducteur de train",
  "12": "Acte d'huissier",
  "22": "Carte européenne d'arme à feu",
  C1: "Renseignement tarifaire contraignant",
  C2: "Accord préalable de transfert d'armes",
  C3: "Permis de transfert d'armes à feu et de munitions",
  C4: "Autorisation d'importation de matériels de guerre",
  C5: "Licence d'exportation d'armes à feu",
  C6: "Agrément de transfert d'armes à feu et de munitions",
  C7: "Bon de livraison",
  C8: "Bon de livraison V2",
  B2: "Test COVID",
  B3: "Titrage antirabique",
  L1: "Attestation vaccinale",
  "16": "Attestation de demande d'asile",
  "17": "Attestation de fin de droit à l'ADA",
  C9: "Caducée infirmier",
  "26": "Certificat de conformité sûreté aéroportuaire",
};

const CONTRACT: Record<string, string> = { "0": "CDD", "1": "CDI", "2": "CTT (intérim)", "3": "CAP" };
const NATURE: Record<string, string> = {
  "01": "CDI de droit privé",
  "02": "CDD de droit privé",
  "03": "Contrat de mission (intérim)",
  "07": "CDI intermittent",
  "08": "CDI intérimaire",
  "09": "CDI de droit public",
  "10": "CDD de droit public",
  "29": "Convention de stage",
  "89": "Volontariat de service civique",
  "90": "Autre nature de contrat",
};

export interface TwoDDocField {
  id: string;
  label: string;
  /** Valeur telle qu'écrite dans le code. */
  raw: string;
  /** Valeur lisible (dates, montants…). */
  value: string;
  truncated: boolean;
}

export interface TwoDDoc {
  version: number;
  authority: string;
  certificate: string;
  issued: string | null;
  signed: string | null;
  docType: string;
  docTypeLabel: string;
  perimeter: string | null;
  country: string | null;
  fields: TwoDDocField[];
  /** Fin du message que l'on ne sait pas découper (identifiant inconnu de nous). */
  undecoded: string | null;
  /** Signature (octets), si présente. */
  signature: Uint8Array | null;
  /** Données couvertes par la signature (en-tête + message). */
  signedData: string;
  /** Données d'annexe : NON signées. */
  annex: TwoDDocField[];
}

/** Jours depuis le 1er janvier 2000 (hexadécimal) → AAAA-MM-JJ ; FFFF → null. */
export function hexDate(h: string): string | null {
  if (!/^[0-9A-F]{4}$/i.test(h) || /^FFFF$/i.test(h)) return null;
  return new Date(Date.UTC(2000, 0, 1) + parseInt(h, 16) * 86_400_000).toISOString().slice(0, 10);
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Uint8Array | null {
  const clean = s.replace(/=+$/, "");
  if (!/^[A-Z2-7]*$/.test(clean)) return null;
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const c of clean) {
    acc = (acc << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
  }
  return Uint8Array.from(out);
}

function frDate8(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}` : v;
}

function isoToFr(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

function euros(v: string, int: boolean): string {
  const m = /^(-?)(\d+)(?:,(\d{1,2}))?$/.exec(v);
  if (!m) return v;
  const whole = m[2].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${m[1]}${whole}${!int && m[3] !== undefined ? `,${m[3].padEnd(2, "0")}` : ""} €`;
}

function display(def: FieldDef | undefined, v: string): string {
  switch (def?.kind) {
    case "date8":
      return frDate8(v);
    case "hexdate":
      return isoToFr(hexDate(v)) || v;
    case "period":
      return /^\d{12}$/.test(v) ? `${v.slice(0, 2)}/${v.slice(2, 6)} au ${v.slice(6, 8)}/${v.slice(8)}` : v;
    case "euros":
      return euros(v, false);
    case "eurosInt":
      return euros(v, true);
    case "phone":
      return /^33\d{9}$/.test(v) ? `0${v.slice(2)}`.replace(/(\d{2})(?=\d)/g, "$1 ") : `+${v}`;
    case "contract":
      return CONTRACT[v] ?? v;
    case "nature":
      return NATURE[v] ?? v;
    case "bool":
      return v === "1" ? "oui" : v === "0" ? "non" : v;
    case "uuid":
      return v.replace(/ /g, "-");
    case "url": {
      const b = base32Decode(v);
      try {
        return b ? new TextDecoder("utf-8", { fatal: true }).decode(b) : v;
      } catch {
        return v;
      }
    }
    default:
      return v;
  }
}

/** Découpe une zone de message (ou d'annexe). S'arrête sur un identifiant inconnu. */
export function parseMessage(msg: string): { fields: TwoDDocField[]; undecoded: string | null } {
  const fields: TwoDDocField[] = [];
  let i = 0;
  while (i < msg.length) {
    if (msg[i] === GS) {
      i++;
      continue;
    }
    const id = msg.slice(i, i + 2).toUpperCase();
    const def = FIELDS[id];
    if (id.length < 2 || !def) return { fields, undecoded: msg.slice(i) };
    i += 2;
    let raw: string;
    let truncated = false;
    if (def.min === def.max) {
      raw = msg.slice(i, i + def.max);
      if (raw.length < def.max || /[\x1d\x1e\x1f]/.test(raw)) return { fields, undecoded: msg.slice(i - 2) };
      i += def.max;
    } else {
      let j = i;
      while (j < msg.length && j - i < def.max && msg[j] !== GS && msg[j] !== RS) j++;
      raw = msg.slice(i, j);
      if (msg[j] === RS) {
        truncated = true;
        j++;
      } else if (msg[j] === GS) j++;
      i = j;
    }
    fields.push({ id, label: def.label, raw, value: display(def, raw), truncated });
  }
  return { fields, undecoded: null };
}

/** Lit un code 2D-Doc (texte rendu par le lecteur de code-barres). null si ce n'en est pas un. */
export function parse2DDoc(input: string): TwoDDoc | null {
  const s = input.replace(/^\][A-Za-z]\d/, ""); // préfixe d'identification de symbologie éventuel
  const m = /^DC(0[1-4])/.exec(s);
  if (!m) return null;
  const version = Number(m[1]);
  const headLen = version <= 2 ? 22 : version === 3 ? 24 : 26;
  const head = s.slice(0, headLen);
  if (head.length < headLen || !/^[A-Z0-9]+$/.test(head)) return null;
  const issuedHex = head.slice(12, 16);
  const signedHex = head.slice(16, 20);
  if (!/^[0-9A-F]{4}$/.test(issuedHex) || !/^[0-9A-F]{4}$/.test(signedHex)) return null;
  const docType = head.slice(20, 22);
  const rest = s.slice(headLen);
  const us = version >= 2 ? rest.indexOf(US) : -1;
  const message = us >= 0 ? rest.slice(0, us) : rest;
  let signature: Uint8Array | null = null;
  let annex: TwoDDocField[] = [];
  if (us >= 0) {
    const after = rest.slice(us + 1);
    const gs = after.indexOf(GS);
    signature = base32Decode(gs >= 0 ? after.slice(0, gs) : after);
    if (gs >= 0) annex = parseMessage(after.slice(gs + 1)).fields;
  }
  const { fields, undecoded } = parseMessage(message);
  return {
    version,
    authority: head.slice(4, 8),
    certificate: head.slice(8, 12),
    issued: hexDate(issuedHex),
    signed: hexDate(signedHex),
    docType,
    docTypeLabel: DOC_TYPES_2D[docType] ?? `Type ${docType}`,
    perimeter: version >= 3 ? head.slice(22, 24) : null,
    country: version >= 4 ? head.slice(24, 26) : null,
    fields,
    undecoded,
    signature,
    signedData: head + message,
    annex,
  };
}

/** Données qui doivent se retrouver écrites sur le papier. */
const CHECKED = new Set([
  "10", "12", "13", "14", "16", "17", "18", "1D", "22", "24", "25", "29", "2B", "2C",
  "30", "31", "40", "41", "44", "46", "47", "48", "49", "4N", "4P", "50", "58", "5C", "5M",
]);

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export interface CrossCheck {
  checked: number;
  found: TwoDDocField[];
  missing: TwoDDocField[];
}

/** Ce que dit le code et que l'on ne retrouve pas sur le papier lu (signe possible de papier modifié). */
export function crossCheck(doc: TwoDDoc, paperText: string): CrossCheck {
  const text = fold(paperText);
  const words = new Set(text.split(/[^A-Z0-9]+/).filter(Boolean));
  const digits = text.replace(/[^0-9]/g, "");
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const found: TwoDDocField[] = [];
  const missing: TwoDDocField[] = [];
  for (const f of doc.fields) {
    if (!CHECKED.has(f.id) || !f.raw.trim() || f.truncated) continue;
    const v = fold(f.raw);
    let ok: boolean;
    if (/^-?[\d\s,.]+$/.test(v)) ok = digits.includes(v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""));
    else if (/^[A-Z0-9]{8,}$/.test(v)) ok = compact.includes(v);
    else ok = v.split(/[^A-Z0-9]+/).filter((w) => w.length >= 2).every((w) => words.has(w));
    (ok ? found : missing).push(f);
  }
  return { checked: found.length + missing.length, found, missing };
}
