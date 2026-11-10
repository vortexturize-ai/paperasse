import type { Category, DocType } from "../lib/categories.ts";
import { countMatches, indexOfWord } from "./normalize.ts";
import type { MrzResult } from "./mrz.ts";
import type { Issuer } from "./issuers.ts";

type Signals = [cue: string, weight: number][];

export const SIGNALS: Partial<Record<DocType, Signals>> = {
  fiche_de_paie: [["net a payer au salarie", 6], ["montant net social", 4], ["bulletin de paie", 8], ["bulletin de salaire", 8], ["fiche de paie", 8], ["net a payer avant impot", 6], ["net a payer", 4], ["salaire brut", 4], ["salaire de base", 3], ["net imposable", 4], ["cotisations", 2], ["conges payes", 2], ["urssaf", 1], ["convention collective", 1], ["heures supplementaires", 2], ["prelevement a la source", 2]],
  contrat_de_travail: [["contrat de travail", 8], ["contrat a duree indeterminee", 6], ["contrat a duree determinee", 6], ["periode d'essai", 4], ["le salarie", 3], ["l'employeur", 2], ["convention collective", 2], ["remuneration", 2], ["fait en deux exemplaires", 2], ["cdi", 2], ["cdd", 2]],
  attestation_employeur: [["motif de la rupture", 5], ["date d'embauche", 3], ["destinee a france travail", 4], ["recu pour solde", 6], ["libre de tout engagement", 5], ["certifie que", 2], ["attestation employeur", 8], ["attestation de travail", 7], ["certificat de travail", 7], ["solde de tout compte", 7], ["atteste que", 2]],
  cv: [["curriculum vitae", 8], ["experience professionnelle", 4], ["experiences professionnelles", 4], ["competences", 3], ["centres d'interet", 3], ["formation", 1], ["langues", 1], ["permis b", 1]],
  diplome: [["releve de notes", 9], ["est decerne", 5], ["credits ects", 4], ["semestre", 2], ["admis", 2], ["diplome", 4], ["baccalaureat", 5], ["a ete decerne", 5], ["certificat d'aptitude", 4], ["brevet", 2], ["licence", 1], ["master", 1], ["mention", 1]],
  avis_imposition: [["avis de situation declarative", 8], ["date de mise en recouvrement", 3], ["avis d'impot", 8], ["avis d'imposition", 8], ["impot sur le revenu", 6], ["taxe fonciere", 8], ["taxe d'habitation", 8], ["revenu fiscal de reference", 6], ["numero fiscal", 4], ["finances publiques", 3], ["impots.gouv", 2], ["prelevement a la source", 1]],
  facture: [["appel de fonds", 7], ["quote-part", 3], ["charges courantes", 2], ["echeancier de cotisations", 6], ["avis d'echeance", 7], ["ne vaut pas quittance", 6], ["avis des sommes a payer", 8], ["echeancier", 4], ["mensualisation", 3], ["cotisation annuelle", 3], ["montant ht", 2], ["total ht", 2], ["facture d'eau", 6], ["facture de regularisation", 6], ["facture", 5], ["montant ttc", 4], ["total ttc", 4], ["tva", 2], ["n° de facture", 4], ["numero de facture", 4], ["consommation", 2], ["kwh", 3], ["abonnement", 2], ["date d'echeance", 2], ["prelevement", 1]],
  quittance_loyer: [["en donne quittance", 6], ["quittance de loyer", 9], ["quittance", 4], ["loyer", 2], ["provision pour charges", 3], ["bailleur", 1], ["locataire", 1]],
  bail: [["contrat de location", 8], ["bail d'habitation", 8], ["bail", 3], ["depot de garantie", 4], ["loi du 6 juillet 1989", 5], ["le bailleur", 3], ["le locataire", 3], ["etat des lieux", 2]],
  attestation_assurance: [["certificat international d'assurance", 8], ["nous attestons", 3], ["est assure", 3], ["attestation d'assurance", 9], ["responsabilite civile", 4], ["multirisque habitation", 5], ["periode de validite", 3], ["carte verte", 4], ["garanties", 2], ["assure", 1], ["souscripteur", 2]],
  releve_bancaire: [["compte de depot", 3], ["releve de compte", 9], ["releve bancaire", 8], ["ancien solde", 4], ["nouveau solde", 4], ["solde crediteur", 4], ["solde debiteur", 4], ["total des operations", 3], ["bic", 1], ["iban", 1]],
  piece_identite: [["carte nationale d'identite", 9], ["identity card", 5], ["passeport", 7], ["passport", 6], ["nationalite", 1], ["date de naissance", 1], ["lieu de naissance", 1]],
  titre_de_sejour: [["titre de sejour", 9], ["residence permit", 6], ["carte de resident", 7], ["carte de sejour", 7], ["autorisation provisoire de sejour", 8], ["recepisse", 3]],
  permis_de_conduire: [["permis de conduire", 9], ["driving licence", 6], ["driving license", 6]],
  carte_grise: [["certificat d'immatriculation", 9], ["carte grise", 8], ["date de premiere immatriculation", 5], ["genre national", 3]],
  document_sante: [["releve de vos remboursements", 7], ["montant rembourse", 3], ["participation forfaitaire", 3], ["biologie medicale", 6], ["compte rendu d'analyses", 6], ["laboratoire", 2], ["indemnites journalieres", 5], ["patient", 2], ["prescripteur", 3], ["hematologie", 3], ["decompte de remboursement", 6], ["assurance maladie", 3], ["feuille de soins", 6], ["carte vitale", 4], ["complementaire sante", 4], ["mutuelle", 3], ["decompte", 3], ["remboursement", 1], ["arret de travail", 5], ["attestation de droits", 4]],
  ordonnance: [["prescription", 4], ["kinesitherapie", 3], ["seances de", 2], ["a renouveler", 2], ["dr", 1], ["ordonnance", 6], ["posologie", 4], ["fois par jour", 4], ["comprime", 3], ["gelule", 3], ["rpps", 4], ["docteur", 1], ["medecin", 1]],
  courrier_administratif: [["nous avons besoin", 3], ["formulaire ci-joint", 3], ["renvoyez", 2], ["nous vous invitons", 2], ["nous vous notifions", 3], ["attestation de vigilance", 4], ["objet :", 2], ["salutations distinguees", 3], ["veuillez agreer", 3], ["sauf erreur de notre part", 3], ["lettre recommandee", 3], ["accuse de reception", 2], ["avis de passage", 6], ["commandement de payer", 7], ["a la requete de", 4], ["convocation", 3], ["vous etes convoque", 3], ["nous vous convoquons", 4], ["entretien prealable", 5], ["audience", 3], ["dernier rappel", 3], ["nous n'avons pas recu", 3], ["nous avons le plaisir", 2], ["appel de cotisations", 5], ["vous etes invite", 2], ["nous vous remercions", 2], ["madame, monsieur", 2], ["madame monsieur", 2], ["nous vous informons", 3], ["votre dossier", 3], ["pieces justificatives", 4], ["veuillez", 2], ["nous vous prions", 2], ["merci de nous faire parvenir", 4], ["votre demande", 2], ["notification", 2], ["allocataire", 3], ["mise en demeure", 4], ["relance", 2]],
  amende: [["forfait post-stationnement", 8], ["avis d'amende", 8], ["exces de vitesse", 3], ["avis de contravention", 9], ["amende forfaitaire", 8], ["antai", 6], ["contravention", 4], ["infraction", 3], ["numero de telepaiement", 5], ["amende majoree", 6], ["avis de paiement", 2]],
  devis: [["devis", 7], ["bon pour accord", 6], ["devis valable", 4], ["proposition commerciale", 3]],
  ticket_garantie: [["sans contact", 3], ["ticket de caisse", 7], ["merci de votre visite", 5], ["garantie", 3], ["carte bancaire", 2], ["rendu", 1], ["total", 1]],
  certificat_scolarite: [["certificat de scolarite", 9], ["annee scolaire", 4], ["annee universitaire", 4], ["est inscrit", 4], ["est inscrite", 4], ["eleve", 2], ["etudiant", 2]],
};

export const TYPE_CATEGORY: Record<DocType, Category> = {
  fiche_de_paie: "travail",
  contrat_de_travail: "travail",
  attestation_employeur: "travail",
  cv: "travail",
  diplome: "etudes",
  avis_imposition: "impots",
  facture: "factures",
  quittance_loyer: "logement",
  bail: "logement",
  attestation_assurance: "logement",
  releve_bancaire: "banque",
  piece_identite: "identite",
  titre_de_sejour: "identite",
  permis_de_conduire: "identite",
  carte_grise: "vehicule",
  document_sante: "sante",
  ordonnance: "sante",
  courrier_administratif: "administratif",
  amende: "vehicule",
  devis: "factures",
  ticket_garantie: "factures",
  certificat_scolarite: "etudes",
  autre: "autre",
};

export interface Classification {
  type: DocType;
  category: Category;
  confidence: number; // 0 à 1
  scores: Partial<Record<DocType, number>>;
}

export function classify(folded: string, mrz: MrzResult | null, issuer: Issuer | null): Classification {
  const scores: Partial<Record<DocType, number>> = {};
  for (const [type, signals] of Object.entries(SIGNALS) as [DocType, Signals][]) {
    let s = 0;
    for (const [cue, weight] of signals) {
      const n = countMatches(folded, cue);
      if (n > 0) s += weight * Math.min(n, 3) ** 0.5; // répéter un mot aide un peu, pas trop
    }
    if (s > 0) scores[type] = s;
  }

  // La bande MRZ est une preuve forte.
  if (mrz) {
    const t: DocType = mrz.kind === "titre_sejour" ? "titre_de_sejour" : "piece_identite";
    scores[t] = (scores[t] ?? 0) + (mrz.checksOk ? 20 : 8);
  }
  // Une lettre (« Madame, », « Veuillez agréer… ») qui PARLE d'un passeport n'est pas le passeport.
  if (isLetter(folded)) {
    scores.courrier_administratif = (scores.courrier_administratif ?? 0) + 2;
    if (!mrz) for (const t of ID_TYPES) if (scores[t]) scores[t] = scores[t]! * 0.3;
  }
  // L'organisme oriente : un courrier de la CAF est d'abord un courrier administratif.
  if (issuer) {
    if (issuer.id === "antai" || issuer.id === "amendes") scores.amende = (scores.amende ?? 0) + 6;
    if (issuer.id === "dgfip") scores.avis_imposition = (scores.avis_imposition ?? 0) + 3;
    if (ADMIN_ISSUERS.includes(issuer.id)) scores.courrier_administratif = (scores.courrier_administratif ?? 0) + 3;
    if (issuer.category === "factures") scores.facture = (scores.facture ?? 0) + 2;
  }

  const ranked = (Object.entries(scores) as [DocType, number][]).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] < 3) {
    return { type: "autre", category: issuer?.category ?? "autre", confidence: 0.2, scores };
  }
  const [type, top] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const confidence = Math.min(1, (top - second) / top + Math.min(top, 20) / 40);
  let category = TYPE_CATEGORY[type];
  // Un courrier administratif prend le dossier de l'organisme quand il est plus précis.
  if (type === "courrier_administratif" && issuer && issuer.category !== "administratif") category = issuer.category;
  if (type === "facture" && issuer?.category === "logement") category = "logement";
  // Sans organisme connu (ou chez un assureur), le sujet du papier choisit le dossier :
  // un avis d'échéance de loyer va dans Logement, une facture d'hôpital dans Santé, l'assurance auto dans Véhicule.
  if (["facture", "courrier_administratif", "attestation_assurance"].includes(type)) {
    const topic = topicOf(folded);
    const insurer = issuer?.category === "logement" && type !== "courrier_administratif";
    if (topic && (!issuer || (insurer && topic === "vehicule"))) category = topic;
  }
  return { type, category, confidence: Math.round(confidence * 100) / 100, scores };
}

const ID_TYPES: DocType[] = ["piece_identite", "titre_de_sejour", "permis_de_conduire"];
const ADMIN_ISSUERS = ["caf", "cpam", "francetravail", "urssaf", "msa", "retraite", "prefecture", "mairie", "justice", "tribunal", "laposte", "crous", "education", "ants"];

const LETTER_MARKS = ["madame,", "monsieur,", "madame, monsieur", "madame monsieur", "bonjour,", "veuillez agreer", "salutations distinguees", "nous vous prions d'agreer", "cordialement"];

/** Le papier est une lettre (formule d'appel ou de politesse). */
export function isLetter(folded: string): boolean {
  return LETTER_MARKS.some((m) => indexOfWord(folded, m) !== -1);
}

const TOPICS: [Category, [string, number][]][] = [
  ["logement", [["loyer", 2], ["loyers", 2], ["locataire", 2], ["bailleur", 2], ["charges locatives", 3], ["office public de l'habitat", 3], ["hlm", 2], ["gestion locative", 3], ["syndic", 2], ["copropriete", 2], ["provision pour charges", 2]]],
  ["sante", [["mutuelle", 3], ["complementaire sante", 3], ["adherent", 1], ["hospitalier", 3], ["hopital", 3], ["clinique", 2], ["patient", 2], ["soins", 1], ["consultation", 1], ["pharmacie", 1], ["chirurgie", 2], ["sejour du", 1]]],
  ["vehicule", [["vehicule", 2], ["immatricule", 2], ["immatriculation", 2], ["automobile", 2], ["stationnement", 2], ["carte verte", 3], ["assurance auto", 3]]],
  ["travail", [["entretien prealable", 3], ["licenciement", 3], ["sanction disciplinaire", 3], ["votre employeur", 2], ["contrat de travail", 2], ["rupture conventionnelle", 3], ["demission", 2], ["personnel de l'entreprise", 1]]],
];

/** Le sujet dominant du papier, s'il est net (au moins 3 points). */
export function topicOf(folded: string): Category | null {
  let best: Category | null = null;
  let bestScore = 2;
  for (const [cat, cues] of TOPICS) {
    let s = 0;
    for (const [cue, w] of cues) if (indexOfWord(folded, cue) !== -1) s += w;
    if (s > bestScore) {
      best = cat;
      bestScore = s;
    }
  }
  return best;
}
