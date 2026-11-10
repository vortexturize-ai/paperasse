import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { applyAnalysis, insertDocument } from "./db";
import { refreshReminders } from "./documents";
import { todayIso } from "./text";
import type { Analysis } from "./types";


function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

const base = {
  emetteur: null,
  date_document: null,
  a_traiter: false,
  actions: [],
  urgence: "aucune",
  date_limite: null,
  date_limite_objet: null,
  date_limite_extrait: null,
  date_expiration: null,
  montant: null,
  montant_sens: null,
  infos_cles: [],
  mots_cles: [],
  avertissement: null,
} satisfies Partial<Analysis>;

function samples(): Analysis[] {
  return [
    {
      ...base,
      type_document: "courrier_administratif",
      categorie: "administratif",
      titre: `${inDays(-3).slice(0, 7)} Demande de justificatif – CAF`,
      emetteur: "CAF",
      date_document: inDays(-3),
      resume:
        "La CAF te demande ton attestation de loyer pour continuer à verser ton aide au logement. Sans réponse, l'aide peut être suspendue.",
      a_traiter: true,
      actions: [
        "Demande l'attestation de loyer à ton propriétaire ou à ton agence.",
        "Connecte-toi sur caf.fr, rubrique « Mon Compte » puis « Envoyer un document ».",
        "Envoie l'attestation en photo ou en PDF, avec ton numéro d'allocataire.",
      ],
      urgence: "haute",
      date_limite: inDays(5),
      date_limite_objet: "envoyer l'attestation de loyer",
      date_limite_extrait: "Merci de nous faire parvenir ce document dans un délai de 15 jours.",
      infos_cles: [
        { label: "N° allocataire", valeur: "1234567 X" },
        { label: "Pièce demandée", valeur: "Attestation de loyer" },
      ],
      mots_cles: ["caf", "apl", "aide au logement", "justificatif", "loyer"],
      texte: "Madame, Monsieur, afin de poursuivre l'étude de vos droits à l'aide au logement…",
    },
    {
      ...base,
      type_document: "amende",
      categorie: "vehicule",
      titre: `${inDays(-40).slice(0, 7)} Avis de contravention – ANTAI`,
      emetteur: "ANTAI",
      date_document: inDays(-40),
      resume: "Amende pour stationnement gênant. Payée dans les délais, elle reste à 35 € ; après, elle augmente.",
      a_traiter: true,
      actions: ["Paie sur antai.gouv.fr avec le numéro de télépaiement.", "Ou conteste en ligne si ce n'était pas toi."],
      urgence: "haute",
      date_limite: inDays(-2),
      date_limite_objet: "payer l'amende au tarif normal",
      date_limite_extrait: "Délai de paiement : 45 jours à compter de l'envoi du présent avis.",
      montant: 35,
      montant_sens: "a_payer",
      infos_cles: [{ label: "N° de télépaiement", valeur: "00 0000 0000 0000" }],
      mots_cles: ["amende", "stationnement", "antai", "contravention"],
      texte: "Avis de contravention. Stationnement gênant…",
    },
    {
      ...base,
      type_document: "avis_imposition",
      categorie: "impots",
      titre: `${inDays(-10).slice(0, 7)} Avis de taxe foncière – Impôts`,
      emetteur: "Direction générale des finances publiques",
      date_document: inDays(-10),
      resume: "Ta taxe foncière est de 612 €. Tu peux payer en ligne ou demander un paiement mensuel.",
      a_traiter: true,
      actions: ["Paie sur impots.gouv.fr, espace particulier, rubrique « Payer »."],
      urgence: "moyenne",
      date_limite: inDays(21),
      date_limite_objet: "payer la taxe foncière",
      date_limite_extrait: "Date limite de paiement : le 15 du mois prochain.",
      montant: 612,
      montant_sens: "a_payer",
      infos_cles: [{ label: "Référence de l'avis", valeur: "26 00 000 000 000" }],
      mots_cles: ["taxe foncière", "impôts", "dgfip"],
      texte: "Avis de taxe foncière 2026…",
    },
    {
      ...base,
      type_document: "fiche_de_paie",
      categorie: "travail",
      titre: `${inDays(-9).slice(0, 7)} Fiche de paie – Boulangerie Martin`,
      emetteur: "Boulangerie Martin",
      date_document: inDays(-9),
      resume: "Fiche de paie du mois : 1 642,18 € net versés, 3 heures supplémentaires comptées.",
      infos_cles: [
        { label: "Salaire net", valeur: "1 642,18 €" },
        { label: "Heures supplémentaires", valeur: "3 h" },
        { label: "Congés restants", valeur: "12,5 jours" },
      ],
      mots_cles: ["salaire", "fiche de paie", "bulletin", "boulangerie martin"],
      texte: "Bulletin de paie. Salaire de base…",
    },
    {
      ...base,
      type_document: "piece_identite",
      categorie: "identite",
      titre: "Carte d'identité – Camille Exemple",
      emetteur: "République française",
      resume: "Ta carte d'identité expire bientôt. Prends rendez-vous en mairie, les délais peuvent être longs.",
      date_expiration: inDays(45),
      infos_cles: [{ label: "Valable jusqu'au", valeur: inDays(45) }],
      mots_cles: ["carte d'identité", "cni", "identité"],
      texte: "Carte nationale d'identité…",
    },
    {
      ...base,
      type_document: "contrat_de_travail",
      categorie: "travail",
      titre: "2025-09 Contrat de travail CDI – Boulangerie Martin",
      emetteur: "Boulangerie Martin",
      date_document: "2025-09-01",
      resume: "CDI de vendeuse à temps plein, 35 h par semaine. Période d'essai de 2 mois, terminée.",
      infos_cles: [
        { label: "Poste", valeur: "Vendeuse" },
        { label: "Période d'essai", valeur: "2 mois" },
        { label: "Préavis", valeur: "1 mois" },
      ],
      mots_cles: ["contrat", "cdi", "période d'essai", "préavis"],
      texte: "Contrat de travail à durée indéterminée…",
    },
  ];
}

export async function insertDemoDocuments(db: SQLiteDatabase): Promise<number> {
  const list = samples();
  for (const a of list) {
    const id = randomUUID();
    await insertDocument(db, id, { title: a.titre, category: a.categorie, docType: a.type_document }, []);
    await applyAnalysis(db, id, a, "français");
    await refreshReminders(db, id);
  }
  return list.length;
}
