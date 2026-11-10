// Sources : service-public.fr (durée de conservation des papiers), economie.gouv.fr.
import type { DocType } from "../lib/categories.ts";
import { addDuration } from "./dates.ts";
import { fold, hasAny } from "./normalize.ts";

export interface KeepAdvice {
  /** À garder toute la vie (ou jusqu'à la retraite). */
  forever: boolean;
  /** Date à partir de laquelle on peut jeter, si on peut la calculer. */
  until: string | null;
  /** La règle, en une phrase simple. */
  rule: string;
  /** La date est passée : on peut jeter (une copie numérique reste dans Paperasse si on le souhaite). */
  canDiscard: boolean;
}

export interface KeepInput {
  type: DocType;
  organisme: string | null;
  docDate: string | null;
  expiry: string | null;
  text?: string;
}

const TELECOM = ["orange", "sfr", "bouygues", "free"];
const ENERGY = ["edf", "engie", "totalenergies", "veolia", "suez"];

function endOfYear(year: number): string {
  return `${year}-12-31`;
}

function plus(iso: string | null, years: number): string | null {
  return iso ? addDuration(iso, years, "an") : null;
}

export function keepAdvice(input: KeepInput, today: string): KeepAdvice {
  const { type, organisme, docDate, expiry } = input;
  const text = fold(input.text ?? "");
  const make = (until: string | null, rule: string, forever = false): KeepAdvice => ({
    forever, until, rule, canDiscard: !forever && until !== null && until < today,
  });

  switch (type) {
    case "fiche_de_paie":
      return make(null, "À garder toute ta vie : les fiches de paie prouvent tes droits à la retraite.", true);
    case "contrat_de_travail":
    case "attestation_employeur":
      return make(null, "À garder jusqu'à ta retraite (et même après) : il prouve tes périodes de travail.", true);
    case "diplome":
      return make(null, "À garder toute ta vie, en lieu sûr.", true);
    case "avis_imposition": {
      // Les impôts peuvent revenir sur une année jusqu'à la fin de la 3e année qui suit les revenus :
      // l'avis 2026 (revenus 2025) se garde jusqu'au 31 décembre 2028.
      const year = docDate ? Number(docDate.slice(0, 4)) : null;
      return make(year ? endOfYear(year + 2) : null, "À garder jusqu'à la fin de la 3e année qui suit l'année des revenus (les impôts peuvent vérifier jusque-là). Beaucoup de démarches demandent aussi les 2 derniers avis.");
    }
    case "facture":
      if (organisme && TELECOM.includes(organisme)) return make(plus(docDate, 1), "Facture de téléphone ou d'internet : à garder 1 an.");
      if (organisme && ENERGY.includes(organisme)) return make(plus(docDate, 5), "Facture d'énergie ou d'eau : à garder 5 ans.");
      if (hasAny(text, ["loyer", "locataire", "charges locatives", "copropriete"])) {
        return make(null, "Papier de logement : à garder pendant toute la location, puis 3 ans.");
      }
      return make(plus(docDate, 5), "Facture : à garder au moins la durée de la garantie, et 5 ans par prudence.");
    case "quittance_loyer":
    case "bail":
      return make(null, "À garder pendant toute la location, puis 3 ans après ton départ.");
    case "releve_bancaire":
      return make(plus(docDate, 5), "Relevé de compte : à garder 5 ans.");
    case "attestation_assurance":
      return make(plus(expiry, 2), "Assurance : à garder pendant tout le contrat, puis 2 ans après sa fin.");
    case "document_sante":
      if (hasAny(text, ["indemnites journalieres", "arret de travail", "accident du travail", "maladie professionnelle"])) {
        return make(null, "Arrêt de travail, indemnités journalières : à garder jusqu'à ta retraite (ils comptent pour tes droits).", true);
      }
      return make(plus(docDate, 2), "Remboursements de santé : à garder 2 ans (l'Assurance Maladie peut réclamer un trop-versé pendant ce temps).");
    case "ordonnance":
      return make(plus(docDate, 1), "Ordonnance : à garder au moins 1 an (3 ans pour des lunettes).");
    case "amende":
      return make(plus(docDate, 3), "Amende : garde l'avis et la preuve de paiement 3 ans par prudence.");
    case "piece_identite":
    case "titre_de_sejour":
    case "permis_de_conduire":
      return make(null, "À garder tant qu'il est valable. Après, garde une copie : elle peut être demandée pour le renouvellement.");
    case "carte_grise":
      return make(null, "À garder tant que tu as le véhicule.");
    case "devis":
      return make(null, "À garder jusqu'à la fin des travaux, puis avec la facture pour la garantie.");
    case "ticket_garantie":
      return make(plus(docDate, 2), "Ticket : à garder au moins pendant la garantie (2 ans pour un produit neuf, plus si extension).");
    case "certificat_scolarite":
      return make(plus(docDate, 1), "Certificat de scolarité : utile pendant l'année scolaire et l'année qui suit.");
    case "cv":
      return make(null, "Ton CV : à mettre à jour, pas à jeter.");
    case "courrier_administratif":
      if (organisme === "francetravail" || organisme === "retraite") {
        return make(null, "Courrier de France Travail ou de la retraite : à garder jusqu'à ta retraite (il prouve tes droits).", true);
      }
      if (organisme === "justice" || organisme === "tribunal") return make(null, "Papier de justice : à garder toute ta vie par prudence.", true);
      if (organisme === "cpam") return make(plus(docDate, 2), "Courrier de l'Assurance Maladie : à garder 2 ans.");
      return make(plus(docDate, 5), "Courrier d'un organisme : à garder 5 ans par prudence (la CAF peut réclamer un trop-versé jusqu'à 2 ans, 5 ans en cas de fraude).");
    default:
      return make(null, "Pas de règle connue pour ce papier : garde-le tant qu'il peut servir.");
  }
}
