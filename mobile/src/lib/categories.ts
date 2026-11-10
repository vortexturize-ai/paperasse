import type { IconName } from "../components/Icon";
import type { Tone } from "../components/theme";

export const CATEGORIES = {
  travail: { label: "Travail", icon: "briefcase", tone: "orange" },
  logement: { label: "Logement", icon: "home", tone: "green" },
  sante: { label: "Santé", icon: "heart", tone: "red" },
  impots: { label: "Impôts", icon: "receipt", tone: "blue" },
  identite: { label: "Identité", icon: "idcard", tone: "yellow" },
  banque: { label: "Banque", icon: "bank", tone: "purple" },
  vehicule: { label: "Véhicule", icon: "car", tone: "orange" },
  etudes: { label: "Études", icon: "cap", tone: "blue" },
  famille: { label: "Famille", icon: "family", tone: "pink" },
  factures: { label: "Factures", icon: "bulb", tone: "yellow" },
  administratif: { label: "Courriers", icon: "mail", tone: "purple" },
  autre: { label: "Autre", icon: "folder", tone: "neutral" },
} as const satisfies Record<string, { label: string; icon: IconName; tone: Tone }>;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function categoryOf(key: string | null | undefined): Category {
  return key && key in CATEGORIES ? (key as Category) : "autre";
}

export const DOC_TYPES = {
  fiche_de_paie: "Fiche de paie",
  contrat_de_travail: "Contrat de travail",
  attestation_employeur: "Attestation employeur",
  cv: "CV",
  diplome: "Diplôme",
  avis_imposition: "Avis d'impôt",
  facture: "Facture",
  quittance_loyer: "Quittance de loyer",
  bail: "Bail",
  attestation_assurance: "Attestation d'assurance",
  releve_bancaire: "Relevé bancaire",
  piece_identite: "Pièce d'identité",
  titre_de_sejour: "Titre de séjour",
  permis_de_conduire: "Permis de conduire",
  carte_grise: "Carte grise",
  document_sante: "Papier de santé",
  ordonnance: "Ordonnance",
  courrier_administratif: "Courrier",
  amende: "Amende",
  devis: "Devis",
  ticket_garantie: "Ticket / garantie",
  certificat_scolarite: "Certificat de scolarité",
  autre: "Papier",
} as const;

export type DocType = keyof typeof DOC_TYPES;

export function docTypeLabel(key: string | null | undefined): string {
  return key && key in DOC_TYPES ? DOC_TYPES[key as DocType] : "Papier";
}

export const URGENCY = {
  aucune: { label: "Rien à faire", tone: "neutral" },
  faible: { label: "Pas urgent", tone: "green" },
  moyenne: { label: "À faire bientôt", tone: "orange" },
  haute: { label: "Urgent", tone: "red" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export type Urgency = keyof typeof URGENCY;
