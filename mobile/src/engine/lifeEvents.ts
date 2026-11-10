// Délais marqués `legal` : service-public.fr. Les autres sont des conseils.
import type { DocType } from "../lib/categories.ts";
import { addDuration } from "./dates.ts";
import { latest, type Paper } from "./vault.ts";

export type LifeEventId =
  | "demenagement" | "nouvel_emploi" | "perte_emploi" | "naissance" | "mariage_pacs"
  | "retraite" | "deces_proche" | "arrivee_france" | "achat_vehicule";

export interface LifeStep {
  id: string;
  title: string;
  detail: string;
  /** Délai par rapport à la date de l'événement (négatif = avant). */
  offset?: { amount: number; unit: "jour" | "mois" };
  /** Délai fixé par la loi (sinon : conseil). */
  legal?: boolean;
  site?: string;
  /** Papiers du coffre utiles pour cette démarche. */
  docTypes?: DocType[];
  optional?: boolean;
}

export interface LifeEvent {
  id: LifeEventId;
  title: string;
  question: string;
  intro: string;
  steps: LifeStep[];
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    id: "demenagement",
    title: "Je déménage",
    question: "Date du déménagement ?",
    intro: "Les démarches dans l'ordre, du préavis à la nouvelle adresse partout.",
    steps: [
      { id: "preavis", title: "Prévenir ton propriétaire", detail: "Lettre recommandée ou remise en main propre. Préavis de 3 mois, réduit à 1 mois en logement meublé ou en zone tendue (grandes villes).", offset: { amount: -3, unit: "mois" }, legal: true, docTypes: ["bail"] },
      { id: "assurance", title: "Assurer le nouveau logement", detail: "Obligatoire pour un locataire, dès la remise des clés. Résilie l'ancienne assurance (possible à tout moment après 1 an).", offset: { amount: 0, unit: "jour" }, legal: true, docTypes: ["attestation_assurance"] },
      { id: "energie", title: "Énergie, eau, internet", detail: "Résilier ou transférer les contrats, relever les compteurs le jour du départ.", offset: { amount: 0, unit: "jour" }, docTypes: ["facture"] },
      { id: "etat_des_lieux", title: "État des lieux de sortie et remise des clés", detail: "Garde une preuve de la date de remise des clés : elle fait courir le délai du dépôt de garantie.", offset: { amount: 0, unit: "jour" }, docTypes: ["bail"] },
      { id: "adresse", title: "Changer d'adresse partout en une fois", detail: "Le service en ligne de service-public.fr prévient en une fois les impôts, la CAF, l'Assurance Maladie, France Travail, la retraite…", offset: { amount: 0, unit: "jour" }, site: "service-public.fr" },
      { id: "carte_grise", title: "Mettre à jour ta carte grise", detail: "Obligatoire dans le mois qui suit, gratuit en ligne.", offset: { amount: 1, unit: "mois" }, legal: true, site: "ants.gouv.fr", docTypes: ["carte_grise"] },
      { id: "depot", title: "Récupérer ton dépôt de garantie", detail: "Il doit être rendu 1 mois après la remise des clés (2 mois si l'état des lieux montre des dégâts). En retard : +10 % du loyer par mois commencé. Paperasse peut écrire la lettre de réclamation.", offset: { amount: 2, unit: "mois" }, legal: true, docTypes: ["bail", "quittance_loyer"] },
      { id: "autres", title: "Banque, employeur, mutuelle, assurances", detail: "Donne-leur ta nouvelle adresse.", offset: { amount: 1, unit: "mois" } },
      { id: "courrier", title: "Faire suivre le courrier (option payante)", detail: "Service de réexpédition de La Poste, utile quelques mois.", offset: { amount: 0, unit: "jour" }, optional: true, site: "laposte.fr" },
    ],
  },
  {
    id: "perte_emploi",
    title: "Je perds mon travail",
    question: "Dernier jour de travail ?",
    intro: "Pour toucher tes droits au plus vite et ne rien perdre.",
    steps: [
      { id: "papiers", title: "Récupérer tes papiers de fin de contrat", detail: "L'employeur doit te remettre : certificat de travail, attestation employeur pour France Travail, reçu pour solde de tout compte.", offset: { amount: 0, unit: "jour" }, legal: true, docTypes: ["attestation_employeur", "contrat_de_travail"] },
      { id: "inscription", title: "T'inscrire à France Travail", detail: "Le plus tôt possible : l'allocation chômage ne commence pas avant l'inscription.", offset: { amount: 0, unit: "jour" }, site: "francetravail.fr", docTypes: ["attestation_employeur", "fiche_de_paie", "piece_identite"] },
      { id: "mutuelle", title: "Garder ta mutuelle d'entreprise", detail: "Elle peut être gardée gratuitement pendant un temps (portabilité) : demande-le à ton employeur.", offset: { amount: 0, unit: "jour" } },
      { id: "caf", title: "Prévenir la CAF si tu reçois des aides", detail: "Ton changement de situation peut augmenter tes aides (logement, prime d'activité, RSA).", offset: { amount: 1, unit: "mois" }, site: "caf.fr" },
      { id: "actualisation", title: "T'actualiser chaque mois", detail: "Entre le 28 du mois et le 15 du mois suivant, sinon tu n'es pas payé.", offset: { amount: 1, unit: "mois" }, site: "francetravail.fr" },
      { id: "solde", title: "Vérifier le solde de tout compte", detail: "Après l'avoir signé, tu as 6 mois pour le contester.", offset: { amount: 6, unit: "mois" }, legal: true, docTypes: ["attestation_employeur"] },
    ],
  },
  {
    id: "nouvel_emploi",
    title: "Je commence un nouveau travail",
    question: "Premier jour de travail ?",
    intro: "Ce qu'il faut donner, et qui prévenir.",
    steps: [
      { id: "dossier", title: "Préparer ton dossier d'embauche", detail: "Pièce d'identité, attestation de droits de l'Assurance Maladie, RIB, diplômes. Voir le dossier prêt « Commencer un nouveau travail ».", offset: { amount: -7, unit: "jour" }, docTypes: ["piece_identite", "titre_de_sejour", "document_sante", "diplome"] },
      { id: "francetravail", title: "Prévenir France Travail", detail: "Si tu étais inscrit : déclare ta reprise d'emploi lors de ton actualisation.", offset: { amount: 1, unit: "mois" }, site: "francetravail.fr" },
      { id: "mutuelle", title: "Mutuelle d'entreprise", detail: "L'adhésion est en principe obligatoire (sauf cas de dispense). Résilie ton ancienne mutuelle si besoin.", offset: { amount: 1, unit: "mois" } },
      { id: "caf", title: "Prévenir la CAF", detail: "Ton nouveau salaire change tes aides. Avec un petit salaire, tu as peut-être droit à la prime d'activité.", offset: { amount: 1, unit: "mois" }, site: "caf.fr" },
      { id: "paie", title: "Garder toutes tes fiches de paie", detail: "Ajoute-les dans Paperasse chaque mois : elles servent pour la retraite, toute ta vie.", offset: { amount: 1, unit: "mois" }, docTypes: ["fiche_de_paie"] },
    ],
  },
  {
    id: "naissance",
    title: "Un bébé arrive",
    question: "Date de naissance ?",
    intro: "Les démarches des premières semaines.",
    steps: [
      { id: "declaration", title: "Déclarer la naissance", detail: "À la mairie du lieu de naissance, dans les 5 jours qui suivent l'accouchement (le jour de l'accouchement ne compte pas). Souvent possible à la maternité.", offset: { amount: 5, unit: "jour" }, legal: true, docTypes: ["piece_identite"] },
      { id: "reconnaissance", title: "Reconnaissance (si vous n'êtes pas mariés)", detail: "Le père doit reconnaître l'enfant à la mairie, avant la naissance ou au moment de la déclaration.", offset: { amount: 5, unit: "jour" } },
      { id: "secu", title: "Rattacher l'enfant à l'Assurance Maladie", detail: "Dans ton compte ameli.fr, pour les remboursements.", offset: { amount: 1, unit: "mois" }, site: "ameli.fr" },
      { id: "caf", title: "Prévenir la CAF", detail: "Allocations et aides pour la garde : déclare la naissance dans ton espace.", offset: { amount: 1, unit: "mois" }, site: "caf.fr" },
      { id: "mutuelle", title: "Ajouter l'enfant à la mutuelle", detail: "Préviens ta complémentaire santé.", offset: { amount: 1, unit: "mois" } },
      { id: "employeur", title: "Congés : prévenir ton employeur", detail: "Congé de naissance, de paternité ou de maternité : vois les dates avec lui.", offset: { amount: 0, unit: "jour" } },
      { id: "impots", title: "Impôts : une part en plus", detail: "Ta situation change : mets-la à jour dans ton espace particulier sur impots.gouv.fr.", offset: { amount: 2, unit: "mois" }, site: "impots.gouv.fr" },
    ],
  },
  {
    id: "mariage_pacs",
    title: "Je me marie / je me pacse",
    question: "Date du mariage ou du PACS ?",
    intro: "Qui prévenir après.",
    steps: [
      { id: "impots", title: "Impôts : déclarer le changement de situation", detail: "Dans ton espace particulier sur impots.gouv.fr ; l'année suivante, déclaration commune.", offset: { amount: 2, unit: "mois" }, site: "impots.gouv.fr" },
      { id: "caf", title: "Prévenir la CAF", detail: "Les aides dépendent des revenus du foyer.", offset: { amount: 1, unit: "mois" }, site: "caf.fr" },
      { id: "autres", title: "Employeur, banque, mutuelle, assurances", detail: "Pour mettre à jour ta situation (et éventuellement ton nom d'usage).", offset: { amount: 1, unit: "mois" } },
    ],
  },
  {
    id: "retraite",
    title: "Je pars à la retraite",
    question: "Date de départ souhaitée ?",
    intro: "S'y prendre tôt évite des mois sans revenu.",
    steps: [
      { id: "carriere", title: "Vérifier ton relevé de carrière", detail: "Chaque trimestre compte : compare avec tes fiches de paie, attestations France Travail, arrêts maladie.", offset: { amount: -12, unit: "mois" }, site: "info-retraite.fr", docTypes: ["fiche_de_paie", "attestation_employeur", "contrat_de_travail"] },
      { id: "demande", title: "Faire ta demande de retraite", detail: "Une seule demande en ligne pour tous tes régimes, environ 6 mois avant la date choisie.", offset: { amount: -6, unit: "mois" }, site: "info-retraite.fr" },
      { id: "employeur", title: "Prévenir ton employeur", detail: "Respecte ton préavis de départ (voir ta convention collective).", offset: { amount: -3, unit: "mois" }, docTypes: ["contrat_de_travail"] },
      { id: "mutuelle", title: "Choisir une mutuelle", detail: "Si tu quittes la mutuelle de l'entreprise.", offset: { amount: 0, unit: "jour" } },
    ],
  },
  {
    id: "deces_proche",
    title: "Un proche est décédé",
    question: "Date du décès ?",
    intro: "Les démarches principales, à ton rythme. Tu peux te faire aider (notaire, pompes funèbres, France Services).",
    steps: [
      { id: "declaration", title: "Déclarer le décès à la mairie", detail: "Très rapidement ; les pompes funèbres le font souvent pour la famille.", offset: { amount: 1, unit: "jour" } },
      { id: "organismes", title: "Prévenir la banque, l'employeur, la CAF, l'Assurance Maladie, la retraite", detail: "Avec un acte de décès.", offset: { amount: 1, unit: "mois" } },
      { id: "capital", title: "Capital décès", detail: "Si la personne travaillait ou était au chômage, un capital peut être versé : renseigne-toi auprès de l'Assurance Maladie.", offset: { amount: 1, unit: "mois" }, site: "ameli.fr" },
      { id: "notaire", title: "Succession : contacter un notaire", detail: "Une déclaration de succession est souvent à déposer dans les 6 mois.", offset: { amount: 6, unit: "mois" }, legal: true },
      { id: "contrats", title: "Résilier les abonnements et contrats", detail: "Énergie, téléphone, assurances, abonnements.", offset: { amount: 2, unit: "mois" }, docTypes: ["facture", "attestation_assurance"] },
    ],
  },
  {
    id: "arrivee_france",
    title: "J'arrive en France",
    question: "Date d'arrivée ?",
    intro: "Les premières démarches pour avoir tes droits.",
    steps: [
      { id: "titre", title: "Surveiller la fin de ton titre de séjour", detail: "Ajoute-le dans Paperasse : il te rappellera la date à temps. Prépare le renouvellement tôt.", offset: { amount: 0, unit: "jour" }, docTypes: ["titre_de_sejour", "piece_identite"] },
      { id: "banque", title: "Ouvrir un compte bancaire", detail: "Si une banque refuse, la Banque de France peut t'en désigner une (droit au compte).", offset: { amount: 1, unit: "mois" } },
      { id: "secu", title: "T'inscrire à l'Assurance Maladie", detail: "Après 3 mois de résidence stable en France, ou dès ton embauche.", offset: { amount: 3, unit: "mois" }, site: "ameli.fr" },
      { id: "caf", title: "Demander tes droits à la CAF", detail: "Aide au logement, allocations : simule sur caf.fr.", offset: { amount: 1, unit: "mois" }, site: "caf.fr" },
      { id: "permis", title: "Échanger ton permis étranger", detail: "Selon ton pays, la demande d'échange doit être faite dans l'année qui suit ta résidence en France.", offset: { amount: 12, unit: "mois" }, legal: true, site: "ants.gouv.fr", docTypes: ["permis_de_conduire"] },
    ],
  },
  {
    id: "achat_vehicule",
    title: "J'achète un véhicule",
    question: "Date d'achat ?",
    intro: "Pour rouler en règle.",
    steps: [
      { id: "assurance", title: "Assurer le véhicule avant de rouler", detail: "Obligatoire dès le premier trajet.", offset: { amount: 0, unit: "jour" }, legal: true, docTypes: ["attestation_assurance"] },
      { id: "ct", title: "Contrôle technique de moins de 6 mois", detail: "Pour un véhicule d'occasion de plus de 4 ans, le vendeur doit le fournir.", offset: { amount: 0, unit: "jour" }, legal: true },
      { id: "carte_grise", title: "Carte grise à ton nom", detail: "Dans le mois qui suit l'achat, en ligne.", offset: { amount: 1, unit: "mois" }, legal: true, site: "ants.gouv.fr", docTypes: ["carte_grise"] },
    ],
  },
];

export interface PlannedStep {
  step: LifeStep;
  due: string | null;
  overdue: boolean;
  /** Papiers utiles déjà dans le coffre. */
  papers: Paper[];
  /** Sortes de papiers utiles qui manquent. */
  missing: DocType[];
}

export function planLifeEvent(id: LifeEventId, eventDate: string, papers: Paper[], today: string): { event: LifeEvent; steps: PlannedStep[] } {
  const event = LIFE_EVENTS.find((e) => e.id === id);
  if (!event) throw new Error(`Moment de vie inconnu : ${id}`);
  const steps = event.steps.map((step): PlannedStep => {
    const due = step.offset ? addDuration(eventDate, step.offset.amount, step.offset.unit) : null;
    const types = step.docTypes ?? [];
    const found = types.flatMap((t) => latest(papers, [t]).slice(0, 1));
    const missing = types.length && found.length === 0 ? types : [];
    return { step, due, overdue: due !== null && due < today, papers: found, missing };
  });
  steps.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  return { event, steps };
}
