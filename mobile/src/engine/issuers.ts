import type { Category } from "../lib/categories.ts";
import { fold, indexOfWord } from "./normalize.ts";

export interface Issuer {
  id: string;
  name: string;
  patterns: string[];
  category: Category;
  site?: string;
}

export const ISSUERS: Issuer[] = [
  { id: "caf", name: "CAF", patterns: ["caisse d'allocations familiales", "allocations familiales", "caf.fr", "caf"], category: "administratif", site: "caf.fr" },
  { id: "cpam", name: "Assurance Maladie", patterns: ["assurance maladie", "ameli.fr", "ameli", "cpam", "caisse primaire d'assurance maladie"], category: "sante", site: "ameli.fr" },
  { id: "dgfip", name: "Impôts (DGFiP)", patterns: ["finances publiques", "impots.gouv.fr", "impots.gouv", "dgfip", "centre des impots", "service des impots"], category: "impots", site: "impots.gouv.fr" },
  { id: "antai", name: "ANTAI", patterns: ["antai", "antai.gouv.fr", "agence nationale de traitement automatise des infractions"], category: "vehicule", site: "antai.gouv.fr" },
  { id: "amendes", name: "Centre des amendes", patterns: ["centre d'encaissement des amendes", "amendes.gouv.fr"], category: "vehicule", site: "amendes.gouv.fr" },
  { id: "francetravail", name: "France Travail", patterns: ["france travail", "pole emploi", "francetravail.fr"], category: "travail", site: "francetravail.fr" },
  { id: "urssaf", name: "Urssaf", patterns: ["urssaf", "urssaf.fr"], category: "administratif", site: "urssaf.fr" },
  { id: "msa", name: "MSA", patterns: ["mutualite sociale agricole", "msa.fr", "msa"], category: "administratif", site: "msa.fr" },
  { id: "retraite", name: "Assurance retraite", patterns: ["assurance retraite", "carsat", "lassuranceretraite.fr"], category: "administratif", site: "lassuranceretraite.fr" },
  { id: "ants", name: "ANTS", patterns: ["ants.gouv.fr", "agence nationale des titres securises"], category: "identite", site: "ants.gouv.fr" },
  { id: "prefecture", name: "Préfecture", patterns: ["prefecture", "sous-prefecture", "prefecture de police"], category: "identite" },
  { id: "mairie", name: "Mairie", patterns: ["mairie de", "mairie d'", "hotel de ville", "ville de"], category: "administratif" },
  { id: "laposte", name: "La Poste", patterns: ["la poste", "laposte.fr"], category: "administratif" },
  { id: "edf", name: "EDF", patterns: ["edf", "edf.fr", "electricite de france"], category: "factures" },
  { id: "engie", name: "Engie", patterns: ["engie"], category: "factures" },
  { id: "totalenergies", name: "TotalEnergies", patterns: ["totalenergies", "total energies"], category: "factures" },
  { id: "orange", name: "Orange", patterns: ["orange sa", "orange.fr", "sosh"], category: "factures" },
  { id: "sfr", name: "SFR", patterns: ["sfr", "red by sfr", "sfr.fr"], category: "factures" },
  { id: "bouygues", name: "Bouygues Telecom", patterns: ["bouygues telecom"], category: "factures" },
  { id: "free", name: "Free", patterns: ["free mobile", "freebox", "free.fr"], category: "factures" },
  { id: "veolia", name: "Veolia", patterns: ["veolia"], category: "factures" },
  { id: "suez", name: "Suez", patterns: ["suez eau", "suez"], category: "factures" },
  { id: "banquepostale", name: "La Banque Postale", patterns: ["la banque postale"], category: "banque" },
  { id: "ca", name: "Crédit Agricole", patterns: ["credit agricole"], category: "banque" },
  { id: "bnp", name: "BNP Paribas", patterns: ["bnp paribas"], category: "banque" },
  { id: "sg", name: "Société Générale", patterns: ["societe generale"], category: "banque" },
  { id: "ce", name: "Caisse d'Épargne", patterns: ["caisse d'epargne"], category: "banque" },
  { id: "lcl", name: "LCL", patterns: ["lcl", "credit lyonnais"], category: "banque" },
  { id: "cm", name: "Crédit Mutuel", patterns: ["credit mutuel"], category: "banque" },
  { id: "bp", name: "Banque Populaire", patterns: ["banque populaire"], category: "banque" },
  { id: "axa", name: "AXA", patterns: ["axa france", "axa"], category: "logement" },
  { id: "maif", name: "MAIF", patterns: ["maif"], category: "logement" },
  { id: "macif", name: "MACIF", patterns: ["macif"], category: "logement" },
  { id: "matmut", name: "Matmut", patterns: ["matmut"], category: "logement" },
  { id: "allianz", name: "Allianz", patterns: ["allianz"], category: "logement" },
  { id: "groupama", name: "Groupama", patterns: ["groupama"], category: "logement" },
  { id: "gmf", name: "GMF", patterns: ["gmf"], category: "logement" },
  { id: "justice", name: "Commissaire de justice", patterns: ["commissaire de justice", "commissaires de justice", "huissier de justice", "huissiers de justice"], category: "administratif" },
  { id: "tribunal", name: "Tribunal", patterns: ["tribunal judiciaire", "tribunal de proximite", "greffe du tribunal", "tribunal d'instance"], category: "administratif" },
  { id: "education", name: "Éducation nationale", patterns: ["education nationale", "academie de", "academie d'", "rectorat"], category: "etudes" },
  { id: "crous", name: "Crous", patterns: ["crous"], category: "etudes", site: "messervices.etudiant.gouv.fr" },
];

export interface IssuerMatch {
  issuer: Issuer;
  index: number;
  /** L'organisme apparaît dans l'en-tête (les premières lignes), pas seulement dans le corps du texte. */
  inHeader: boolean;
}

/** Un organisme cité comme destinataire ou comme moyen n'est pas l'expéditeur. */
const NOT_SENDER = /(?:destinee? a|a destination d[eu']|a l'attention d[eu']|a adresser a|a envoyer a|a retourner a|a renvoyer a|a transmettre a|cachet d[eu']|aupres d[eu']|par l'|par la|prise en charge par)\s*(?:la |le |l'|votre |vos )?$/;

const HEADER_LINES = 3;

/** Fin de l'en-tête : les 3 premières lignes qui contiennent un vrai mot (le papier à en-tête). */
function headerEnd(folded: string): number {
  let seen = 0;
  let pos = 0;
  for (const line of folded.split("\n")) {
    pos += line.length + 1;
    if (/[a-z]{3}/.test(line)) seen++;
    if (seen >= HEADER_LINES) break;
  }
  return pos;
}

/** L'organisme le plus probable. Celui de l'en-tête passe avant ceux cités dans le corps
 *  (un relevé de banque cite la CAF à chaque virement) ; sinon le plus cité, et à égalité le plus haut. */
export function detectIssuer(foldedText: string): IssuerMatch | null {
  const head = headerEnd(foldedText);
  const folded = foldedText.replace(/\n/g, " "); // un nom long peut être coupé sur deux lignes
  let best: { issuer: Issuer; score: number; index: number; inHeader: boolean } | null = null;
  for (const issuer of ISSUERS) {
    let score = 0;
    let first = Infinity;
    let inHeader = false;
    const ranges: [number, number][] = [];
    for (const p of issuer.patterns) {
      let i = indexOfWord(folded, p, 0, false);
      while (i !== -1) {
        // « camille@orange.fr » est une adresse mail, pas une facture Orange.
        const mail = folded[i - 1] === "@";
        const overlaps = ranges.some(([s, e]) => i < e && i + p.length > s); // « allocations familiales » dans « caisse d'allocations familiales »
        if (!mail && !overlaps && !NOT_SENDER.test(folded.slice(Math.max(0, i - 30), i))) {
          ranges.push([i, i + p.length]);
          score++;
          inHeader ||= i < head;
          first = Math.min(first, i);
        }
        i = indexOfWord(folded, p, i + p.length, false);
      }
    }
    if (score === 0) continue;
    const better = !best
      || (inHeader && !best.inHeader)
      || (inHeader === best.inHeader && (score > best.score || (score === best.score && first < best.index)));
    if (better) best = { issuer, score, index: first, inHeader };
  }
  return best ? { issuer: best.issuer, index: best.index, inHeader: best.inHeader } : null;
}

const LEGAL_FORMS = ["SA", "SAS", "SASU", "SARL", "EURL", "SCI", "SNC", "SCOP", "SELARL", "SCP", "GIE", "SCM", "EI"];
const PREPOSITIONS = new Set(["de", "du", "des", "d", "à", "a", "au", "aux", "et", "en", "sur", "sous", "pour", "par"]);
const ARTICLES = new Set(["le", "la", "les", "l"]);

/** « BOULANGERIE DE LA GARE » → « Boulangerie de la Gare », « SAS EXEMPLE » → « SAS Exemple ».
 *  Laisse tel quel un nom déjà écrit en casse mixte. */
export function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const words = s.toLowerCase().split(/(\s+)/);
  let prevPrep = false;
  let first = true;
  return words
    .map((w) => {
      if (/^\s+$/.test(w) || w === "") return w;
      const parts = w.split(/(['’-])/);
      const out = parts
        .map((p, i) => {
          if (p === "'" || p === "’" || p === "-") return p;
          const isFirst = first && i === 0;
          const bare = p.replace(/[^a-zà-ÿ]/g, "");
          if (LEGAL_FORMS.includes(bare.toUpperCase())) return p.toUpperCase();
          // « de », « du », « d' » en minuscules ; « la », « le » seulement après eux (« de la Gare »,
          // mais « SARL Le Bon Goût »).
          if (!isFirst && (PREPOSITIONS.has(bare) || (ARTICLES.has(bare) && i === 0 && prevPrep))) return p;
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join("");
      prevPrep = PREPOSITIONS.has(w.replace(/[^a-zà-ÿ]/g, ""));
      first = false;
      return out;
    })
    .join("");
}

const fl = (s: string) => fold(s).trim();

/** Une ligne qui est un titre de papier, une formule ou une rubrique, pas un nom d'expéditeur. */
const NOT_A_NAME = new RegExp(
  "^(?:madame|monsieur|mademoiselle|bonjour|objet|date|page|tel|telephone|fax|e-?mail|mail|courriel|www|http|" +
    "facture|bulletin|avis|releve|quittance|devis|attestation|certificat|contrat|notification|convocation|lettre|" +
    "mise en demeure|rappel|relance|commandement|recu|ticket|decompte|echeancier|declaration|ordonnance|compte rendu|" +
    "proces-verbal|carte|permis|passeport|titre de sejour|recepisse|diplome|curriculum|offre|votre |vos |notre |nos |" +
    "n°|no |numero|reference|client|periode|montant|total|iban|siret|entre |et |je |nous |soussigne|republique|ministere|" +
    "service |direction |agence de |accueil|identifiant|enfant|beneficiaire|salarie|locataire|patient|nom |prenom)",
);

/** Ressemble à un organisme ou une entreprise (pour un courrier, on est plus exigeant). */
function looksLikeOrganisation(line: string): boolean {
  const words = line.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w));
  if (words.length >= 2 && line === line.toUpperCase()) return true;
  if (words.some((w) => LEGAL_FORMS.includes(w.replace(/[^A-Z]/g, "")) && w.length >= 2)) return true;
  return /\b(?:agence|cabinet|office|association|societe|groupe|centre|clinique|banque|assurances?|mutuelle|laboratoire|etude|syndic|habitat|immobili\w*|hopital|hospitalier|universite|lycee|college|ecole|entreprise)\b/.test(fl(line));
}

function cleanName(raw: string): string | null {
  const name = raw.split(/\s+-\s+|,|\s+\(|\s{2,}|\s+siret\b|\s+n°/i)[0].replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 45 || !/[A-Za-zÀ-ÿ]{3}/.test(name) || /\d{2}/.test(name)) return null;
  return titleCase(name);
}

const LABELS = /^(?:employeur|bailleur|entreprise|raison sociale|emetteur|vendeur|societe|organisme|etablissement)\s*:\s*(.+)$/;

/** Nom de l'expéditeur lu sur le papier quand l'organisme n'est pas connu.
 *  1. un libellé « Employeur : … », « Bailleur : … » ; 2. une ligne d'en-tête ; 3. une société citée avec sa forme juridique.
 *  `strict` (courriers) : la ligne d'en-tête doit ressembler à un organisme. */
export function guessSender(textLines: string[], opts: { strict?: boolean; company?: boolean } = {}): string | null {
  const { strict = false, company = true } = opts;
  const ls = textLines.map((l) => l.trim()).filter((l) => /[A-Za-zÀ-ÿ]{3}/.test(l)); // sans traits, puces, bouts de logo

  // 1. « Employeur : … », « Bailleur : … » (la valeur peut continuer sur la ligne suivante, coupée par la photo).
  for (let i = 0; i < Math.min(ls.length, 15); i++) {
    const m = fl(ls[i]).match(LABELS);
    if (!m) continue;
    const value = ls[i].slice(ls[i].length - m[1].length);
    const next = ls[i + 1];
    const joined = next && !next.includes(":") && /^[A-ZÀ-Ý]/.test(next) && !/[.,;]$/.test(value) ? cleanName(`${value} ${next}`) : null;
    const name = joined && joined.split(" ").length <= 6 ? joined : cleanName(value);
    if (name) return name;
  }

  // 2. Une ligne d'en-tête qui est un nom (pas un titre, une adresse, une phrase).
  const candidates: string[] = [];
  for (let i = 0; i < Math.min(ls.length, 6); i++) {
    const l = ls[i];
    if (l.length < 3 || l.length > 45) continue;
    if (/\d{2}/.test(l)) continue; // adresse, téléphone, date
    if (/^[a-zà-ÿ]/.test(l)) continue; // suite d'une phrase coupée
    if (NOT_A_NAME.test(fl(l))) continue;
    if (/[:;!?.]$|^[^\wÀ-ÿ]/.test(l) || l.split(/\s+/).length > 6) continue; // une phrase, pas un nom
    // La phrase continue sur la ligne suivante : ce n'est pas un nom isolé.
    if (!/[.:;!?,]$/.test(l) && /^[a-zà-ÿ]/.test(ls[i + 1] ?? "")) continue;
    candidates.push(l);
  }
  for (const l of candidates) {
    if (!looksLikeOrganisation(l)) continue;
    const name = /\b(?:SARL|SAS|SASU|SCI|EURL|SA|SNC|SELARL)\b/.test(l) && !/^(?:SARL|SAS|SASU|SCI|EURL|SA|SNC|SELARL)\b/.test(l) && /^(?:La|Le|De|Du)\s/i.test(l)
      ? companyName(l)
      : cleanName(l);
    if (name) return name;
  }

  // 3. Une société citée avec sa forme juridique (« … gérant de la SARL Exemple Restauration … »).
  const fromText = company ? companyName(textLines.join("\n")) : null;
  if (fromText) return fromText;

  // 4. Pour un papier (pas un courrier), la première ligne qui ressemble à un nom.
  if (!strict) for (const l of candidates) {
    const name = cleanName(l);
    if (name) return name;
  }
  return null;
}

const COMPANY = new RegExp(String.raw`\b(${LEGAL_FORMS.filter((f) => f.length >= 2).join("|")})\s+((?:[A-ZÀ-Ý][\wÀ-ÿ'’&\-]*\s?){1,4})`);

/** « … de la SARL Exemple Restauration, dont … » → « SARL Exemple Restauration ». */
export function companyName(text: string): string | null {
  const m = text.slice(0, 3000).match(COMPANY);
  if (!m) return null;
  // S'arrête au premier mot de liaison, même écrit en majuscules (« SAS EXEMPLE VENDANGES ET MONSIEUR … »).
  // Le premier mot après la forme juridique est gardé (« SARL Le Bon Goût »).
  const STOP = /^(?:et|dont|representee?|ci-apres|monsieur|madame|mme|m\.?|siege|situee?|sise|au|aux|la|le|les)$/;
  const words = m[2].trim().split(/\s+/);
  const kept: string[] = [];
  for (const [i, wd] of words.entries()) {
    if (i > 0 && STOP.test(fold(wd))) break;
    kept.push(wd);
  }
  if (kept.length > 1 && STOP.test(fold(kept[kept.length - 1]))) kept.pop();
  return cleanName(`${m[1]} ${kept.join(" ")}`);
}
