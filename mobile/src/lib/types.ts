import type { Urgency } from "./categories";

/** Fiche produite par le Moteur Paperasse (src/engine/analyze.ts). */
export interface Analysis {
  type_document: string;
  categorie: string;
  titre: string;
  emetteur: string | null;
  date_document: string | null;
  resume: string;
  a_traiter: boolean;
  actions: string[];
  urgence: Urgency;
  date_limite: string | null;
  date_limite_objet: string | null;
  date_limite_extrait: string | null;
  date_expiration: string | null;
  montant: number | null;
  montant_sens: "a_payer" | "a_recevoir" | "information" | null;
  infos_cles: { label: string; valeur: string }[];
  mots_cles: string[];
  texte: string;
  avertissement: string | null;
}

export type AnalysisStatus = "none" | "done" | "error";

/** Ligne de la table documents, champs JSON décodés. */
export interface DocumentRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  docType: string;
  category: string;
  issuer: string | null;
  docDate: string | null;
  summary: string | null;
  toDo: boolean;
  actions: string[];
  urgency: Urgency;
  deadline: string | null;
  deadlineLabel: string | null;
  deadlineQuote: string | null;
  expiryDate: string | null;
  amount: number | null;
  amountDirection: Analysis["montant_sens"];
  keyFacts: { label: string; valeur: string }[];
  keywords: string[];
  fullText: string | null;
  warning: string | null;
  isDone: boolean;
  isFavorite: boolean;
  analysisStatus: AnalysisStatus;
  analysisLang: string | null;
  notificationIds: string[];
  /** Papier d'un proche (famille, aidant) ; null = moi. */
  personId: string | null;
}

export interface DocFile {
  id: string;
  documentId: string;
  position: number;
  /** Chemin relatif au dossier Documents de l'app (le chemin absolu change sur iOS). */
  path: string;
  mime: string;
}

export interface PendingPage {
  /** Fichier temporaire (cache) avant enregistrement. */
  uri: string;
  mime: "image/jpeg" | "application/pdf";
  name: string;
}
