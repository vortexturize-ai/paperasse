// Location : décret n° 2015-1437 du 5 novembre 2015 ; pièces interdites : loi n° 89-462 du 6 juillet 1989, art. 22-2.
import type { DocType } from "../lib/categories.ts";
import { daysBetween } from "./dates.ts";
import { latest, paperDate, type Paper } from "./vault.ts";

export interface Requirement {
  id: string;
  label: string;
  /** Une de ces sortes de papier convient. */
  types: DocType[];
  /** Nombre de papiers attendus (ex. 3 dernières fiches de paie). */
  count: number;
  /** Âge maximum en jours (ex. avis d'imposition de moins de 2 ans). */
  maxAgeDays?: number;
  /** Texte à trouver dans le papier pour qu'il convienne (ex. « taxe fonciere »). */
  mustContain?: string[];
  optional?: boolean;
  hint: string;
}

export interface DossierTemplate {
  id: string;
  title: string;
  /** Motif écrit dans le filigrane du PDF (« Uniquement pour … »). */
  purpose: string;
  intro: string;
  source: string;
  requirements: Requirement[];
  /** Ce qu'on n'a pas le droit de te demander (affiché pour te protéger). */
  forbidden?: string[];
}

export const DOSSIERS: DossierTemplate[] = [
  {
    id: "location",
    title: "Louer un logement",
    purpose: "Uniquement pour la location d’un logement",
    intro: "Le propriétaire ou l'agence peut demander UNE pièce par ligne ci-dessous, pas plus : la liste est fixée par la loi.",
    source: "Décret n° 2015-1437 du 5 novembre 2015 ; loi du 6 juillet 1989, art. 22-2",
    requirements: [
      { id: "identite", label: "Une pièce d'identité", types: ["piece_identite", "titre_de_sejour", "permis_de_conduire"], count: 1, hint: "Carte d'identité, passeport, permis ou titre de séjour en cours de validité." },
      { id: "domicile", label: "Justificatif de domicile actuel", types: ["quittance_loyer"], count: 3, maxAgeDays: 120, hint: "Tes 3 dernières quittances de loyer (ou une attestation d'hébergement, ou ton avis de taxe foncière si tu es propriétaire)." },
      { id: "activite", label: "Justificatif d'activité", types: ["contrat_de_travail", "attestation_employeur", "certificat_scolarite"], count: 1, hint: "Contrat de travail ou attestation de l'employeur ; carte d'étudiant ou certificat de scolarité." },
      { id: "paie", label: "Les 3 dernières fiches de paie", types: ["fiche_de_paie"], count: 3, maxAgeDays: 120, hint: "Ou d'autres justificatifs de ressources (pension, allocations, bourse)." },
      { id: "impots", label: "Le dernier avis d'imposition", types: ["avis_imposition"], count: 1, maxAgeDays: 730, mustContain: ["revenu"], hint: "Le dernier ou l'avant-dernier avis d'impôt sur le revenu." },
    ],
    forbidden: [
      "Un relevé de compte bancaire ou une attestation de bonne tenue de compte",
      "Ta carte Vitale (carte d'assuré social)",
      "Un extrait de casier judiciaire",
      "Une photo d'identité (en dehors de celle de la pièce d'identité)",
      "Un chèque de réservation ou une somme d'argent avant la signature du bail",
      "Ton dossier médical",
      "Ton contrat de mariage, un certificat de concubinage ou un jugement de divorce",
      "Une attestation d'absence de crédit",
      "Une autorisation de prélèvement automatique sur ton compte",
    ],
  },
  {
    id: "pret",
    title: "Demander un prêt à la banque",
    purpose: "Uniquement pour une demande de prêt",
    intro: "La liste habituelle des banques (elle peut varier un peu selon la banque).",
    source: "Usage des banques françaises",
    requirements: [
      { id: "identite", label: "Une pièce d'identité", types: ["piece_identite", "titre_de_sejour"], count: 1, hint: "En cours de validité." },
      { id: "paie", label: "Les 3 dernières fiches de paie", types: ["fiche_de_paie"], count: 3, maxAgeDays: 120, hint: "Les plus récentes." },
      { id: "impots", label: "Les 2 derniers avis d'imposition", types: ["avis_imposition"], count: 2, maxAgeDays: 800, mustContain: ["revenu"], hint: "Impôt sur le revenu." },
      { id: "contrat", label: "Contrat de travail", types: ["contrat_de_travail", "attestation_employeur"], count: 1, hint: "Ou une attestation de l'employeur." },
      { id: "releves", label: "Les 3 derniers relevés de compte", types: ["releve_bancaire"], count: 3, maxAgeDays: 120, hint: "Ceux de ton compte principal." },
      { id: "domicile", label: "Justificatif de domicile récent", types: ["facture", "quittance_loyer"], count: 1, maxAgeDays: 92, hint: "Facture d'énergie, d'eau, de téléphone fixe ou quittance de moins de 3 mois." },
    ],
  },
  {
    id: "titre_sejour",
    title: "Renouveler un titre de séjour",
    purpose: "Uniquement pour la préfecture (titre de séjour)",
    intro: "Les pièces les plus souvent demandées. La liste exacte dépend de ton titre : vérifie-la sur le site de l'ANEF (administration-etrangers-en-france.interieur.gouv.fr).",
    source: "Pièces habituelles, à vérifier sur le site de l'ANEF",
    requirements: [
      { id: "passeport", label: "Passeport", types: ["piece_identite"], count: 1, hint: "En cours de validité." },
      { id: "titre", label: "Titre de séjour actuel", types: ["titre_de_sejour"], count: 1, hint: "Ou le récépissé en cours." },
      { id: "domicile", label: "Justificatif de domicile récent", types: ["facture", "quittance_loyer"], count: 1, maxAgeDays: 183, hint: "Facture ou quittance récente à ton nom." },
      { id: "ressources", label: "Justificatifs de ressources", types: ["fiche_de_paie", "avis_imposition", "contrat_de_travail"], count: 3, maxAgeDays: 400, hint: "Fiches de paie, contrat de travail, avis d'imposition." },
    ],
  },
  {
    id: "embauche",
    title: "Commencer un nouveau travail",
    purpose: "Uniquement pour une embauche",
    intro: "Ce qu'un employeur demande le plus souvent à l'embauche.",
    source: "Usage courant",
    requirements: [
      { id: "identite", label: "Pièce d'identité ou titre de séjour autorisant à travailler", types: ["piece_identite", "titre_de_sejour"], count: 1, hint: "En cours de validité." },
      { id: "secu", label: "Attestation de droits (n° de sécurité sociale)", types: ["document_sante"], count: 1, mustContain: ["attestation de droits"], hint: "Téléchargeable sur ameli.fr." },
      { id: "diplomes", label: "Diplômes", types: ["diplome"], count: 1, optional: true, hint: "Si le poste les demande." },
      { id: "cv", label: "CV à jour", types: ["cv"], count: 1, optional: true, hint: "Souvent déjà envoyé." },
    ],
  },
];

export type RequirementStatus = "ok" | "incomplet" | "manquant";

export interface RequirementResult {
  requirement: Requirement;
  status: RequirementStatus;
  papers: Paper[];
  /** Papiers du bon type mais trop vieux ou périmés. */
  tooOld: Paper[];
}

export interface DossierResult {
  template: DossierTemplate;
  items: RequirementResult[];
  ready: boolean;
  missing: number;
}

/** Pourquoi un papier du bon type ne convient pas (null s'il convient). */
export function whyNot(p: Paper, r: Requirement, today: string): "perime" | "ancien" | "contenu" | null {
  if (p.expiry && p.expiry < today) return "perime";
  if (r.maxAgeDays !== undefined && daysBetween(paperDate(p), today) > r.maxAgeDays) return "ancien";
  if (r.mustContain && !r.mustContain.some((w) => p.text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(w))) return "contenu";
  return null;
}

function usable(p: Paper, r: Requirement, today: string): boolean {
  return whyNot(p, r, today) === null;
}

/** Ce que le coffre contient pour ce dossier. */
export function prepareDossier(templateId: string, papers: Paper[], today: string): DossierResult {
  const template = DOSSIERS.find((d) => d.id === templateId);
  if (!template) throw new Error(`Dossier inconnu : ${templateId}`);
  const used = new Set<string>();
  const items = template.requirements.map((r): RequirementResult => {
    const candidates = latest(papers, r.types).filter((p) => !used.has(p.id));
    const good = candidates.filter((p) => usable(p, r, today)).slice(0, r.count);
    for (const p of good) used.add(p.id);
    const tooOld = candidates.filter((p) => !good.includes(p) && !usable(p, r, today)).slice(0, 3);
    const status: RequirementStatus = good.length >= r.count ? "ok" : good.length > 0 ? "incomplet" : "manquant";
    return { requirement: r, status, papers: good, tooOld };
  });
  const missing = items.filter((i) => i.status !== "ok" && !i.requirement.optional).length;
  return { template, items, ready: missing === 0, missing };
}
