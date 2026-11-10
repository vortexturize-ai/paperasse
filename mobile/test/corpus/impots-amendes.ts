import type { Papier } from "../outils/fiche.ts";

export const IMPOTS_AMENDES: Papier[] = [
  {
    id: "dgfip-taxe-fonciere",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
AVIS DE TAXE FONCIÈRE 2026
Numéro fiscal : 12 34 567 890 123
Référence de l'avis : 26 75 123 456 789
Date d'établissement : 31/08/2026
Montant à payer : 612,00 €
Date limite de paiement : 15/12/2026
Vous pouvez payer en ligne sur impots.gouv.fr`,
    attendu: {
      type: "avis_imposition", dossier: "impots", emetteur: "Impôts (DGFiP)", organisme: "dgfip",
      date_document: "2026-08-31", date_limite: "2026-12-15", montant: 612, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "Numéro fiscal": "12 34 567 890 123", "Référence de l'avis": "26 75 123 456 789" },
    },
  },
  {
    id: "dgfip-impot-revenu-reste-a-payer",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
AVIS D'IMPÔT 2026
IMPÔT SUR LES REVENUS de l'année 2025
Numéro fiscal : 30 12 345 678 901
Date de mise en recouvrement : 31/07/2026
Revenu fiscal de référence : 28 450 €
Impôt sur le revenu net : 1 620 €
Retenue à la source déjà payée : 1 200 €
Reste à payer : 420 €
Date limite de paiement : 15/12/2026
Payez en ligne sur impots.gouv.fr.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-07-31",
      date_limite: "2026-12-15", montant: 420, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "Numéro fiscal": "30 12 345 678 901" },
    },
  },
  {
    id: "dgfip-restitution",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
AVIS D'IMPÔT 2026 SUR LES REVENUS 2025
Numéro fiscal : 31 98 765 432 100
Date d'établissement : 31/07/2026
Impôt sur le revenu net avant corrections : 890 €
Retenue à la source prélevée en 2025 : 1 232 €
Somme qui vous sera remboursée : 342 €
Ce montant sera versé par virement sur votre compte bancaire.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-07-31",
      montant: 342, sens: "a_recevoir", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "dgfip-non-imposable",
    texte: `Direction générale des Finances publiques
Avis de situation déclarative à l'impôt sur le revenu 2026
Date : 05/08/2026
Revenu fiscal de référence : 9 870 €
Nombre de parts : 1
Vous n'êtes pas imposable sur les revenus de 2025.
Ce document peut vous être demandé pour bénéficier de certaines aides.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-08-05",
      date_limite: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "dgfip-taxe-habitation-mensualisee",
    texte: `FINANCES PUBLIQUES
TAXE D'HABITATION SUR LES RÉSIDENCES SECONDAIRES 2026
Numéro fiscal : 12 34 567 890 123
Date d'établissement : 31/10/2026
Montant de votre taxe : 734 €
Vous êtes mensualisé : ce montant sera prélevé le 15/12/2026 sur votre compte.
Aucune démarche n'est nécessaire.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-10-31",
      montant: 734, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "dgfip-relance-majoration",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
Service des impôts des particuliers de Lille
LETTRE DE RELANCE
Le 30/10/2026
Madame, Monsieur,
Sauf erreur de notre part, votre taxe foncière 2026 n'a pas été payée à la date limite du 15/10/2026.
Une majoration de 10 % a été appliquée.
Montant restant dû : 673,20 €
Merci de régler cette somme au plus tard le 30/11/2026 sur impots.gouv.fr.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-10-30",
      date_limite: "2026-11-30", montant: 673.2, sens: "a_payer", intention: "relance", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "dgfip-taxe-fonciere-sans-entete-depassee",
    texte: `AVIS DE TAXE FONCIÈRE
2026
Propriétés bâties
Adresse du bien : 8 allée des Tilleuls 44000 Nantes
Date de mise en recouvrement : 31/08/2026
Montant de votre impôt : 1 089 €
Date limite de paiement en ligne : 20/10/2026`,
    attendu: {
      type: "avis_imposition", dossier: "impots", emetteur: "Impôts (DGFiP)", organisme: "dgfip",
      date_document: "2026-08-31", date_limite: "2026-10-20", montant: 1089, sens: "a_payer", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "amende-majoree-tresor",
    texte: `AVIS D'AMENDE FORFAITAIRE MAJORÉE
Trésor public - Centre d'encaissement des amendes
Date d'émission : 02/11/2026
Infraction du 14/08/2026 : excès de vitesse inférieur à 20 km/h
Montant de l'amende forfaitaire majorée : 180 €
Vous devez payer cette somme dans un délai de 30 jours.
Numéro de télépaiement : 9876 5432 1098 7654 32`,
    attendu: {
      type: "amende", dossier: "vehicule", emetteur: "Centre des amendes", date_document: "2026-11-02",
      date_limite: "2026-12-02", montant: 180, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° de télépaiement": "9876 5432 1098 7654 32" },
    },
  },
  {
    id: "antai-vitesse-minoree",
    texte: `AGENCE NATIONALE DE TRAITEMENT AUTOMATISÉ DES INFRACTIONS
AVIS DE CONTRAVENTION
Date d'envoi : 06/11/2026
Infraction : excès de vitesse inférieur à 20 km/h hors agglomération
Date et heure : 01/11/2026 à 16 h 42
Véhicule : AB-123-CD
Montant de l'amende forfaitaire : 135 €
Montant minoré : 90 € si vous payez dans les 15 jours suivant l'envoi de cet avis.
Montant majoré : 375 € après 45 jours.
Payez sur www.antai.gouv.fr ou au 0 811 10 10 10.`,
    attendu: {
      type: "amende", dossier: "vehicule", emetteur: "ANTAI", organisme: "antai", date_document: "2026-11-06",
      date_limite: "2026-11-21", montant: 135, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { Immatriculation: "AB-123-CD" },
    },
  },
  {
    id: "antai-stationnement",
    texte: `ANTAI
AVIS DE CONTRAVENTION
Date d'envoi : 25/09/2026
Infraction : stationnement gênant
Montant de l'amende forfaitaire : 35 €
Numéro de télépaiement : 1234 5678 9012 3456
Paiement dans un délai de 45 jours à compter de la date d'envoi.`,
    attendu: {
      type: "amende", dossier: "vehicule", organisme: "antai", date_document: "2026-09-25",
      date_limite: "2026-11-09", montant: 35, a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "forfait-post-stationnement",
    texte: `Ville de Paris
AVIS DE PAIEMENT
FORFAIT POST-STATIONNEMENT
Date de l'avis : 04/11/2026
Véhicule immatriculé GH-456-JK
Stationnement le 28/10/2026 à 15 h 10, rue de Rivoli
Montant du forfait post-stationnement : 50,00 €
À payer dans un délai de 3 mois à compter de la date de l'avis.
Paiement sur www.stationnement.gouv.fr`,
    attendu: {
      type: "amende", dossier: "vehicule", date_document: "2026-11-04", date_limite: "2027-02-04",
      montant: 50, sens: "a_payer", a_traiter: true, urgence: "faible", infos: { Immatriculation: "GH-456-JK" },
    },
  },
];
