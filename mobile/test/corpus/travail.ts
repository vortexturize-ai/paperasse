import type { Papier } from "../outils/fiche.ts";

export const TRAVAIL: Papier[] = [
  {
    id: "paie-boulangerie",
    texte: `BOULANGERIE MARTIN
BULLETIN DE PAIE
Période du 01/10/2026 au 31/10/2026
Salaire de base 1 801,80
Salaire brut 2 105,00
Cotisations salariales 462,82
Net à payer avant impôt sur le revenu 1 642,18
Net imposable 1 690,40
Net payé 1 642,18 €`,
    attendu: {
      type: "fiche_de_paie", dossier: "travail", emetteur: "Boulangerie Martin", montant: 1642.18, sens: "a_recevoir",
      a_traiter: false, urgence: "aucune", resume: /oct\. 2026/,
    },
  },
  {
    id: "paie-colonnes-sas",
    texte: `SAS EXEMPLE LOGISTIQUE
14 rue du Port 76600 Le Havre
SIRET 812 345 678 00027
BULLETIN DE SALAIRE
Période : 01/10/2026 - 31/10/2026
Date de paiement : 30/10/2026
Salarié : Karim EXEMPLE
Emploi : Préparateur de commandes
Salaire de base 151,67 h 12,10 1 835,21
Heures supplémentaires 25 % 8,00 h 15,13 121,04
SALAIRE BRUT 1 956,25
CSG/CRDS et cotisations URSSAF -428,41
Net à payer avant impôt sur le revenu 1 527,84
Impôt sur le revenu prélevé à la source 0,00 % 0,00
NET À PAYER AU SALARIÉ 1 527,84 €
Montant net social 1 541,30`,
    attendu: {
      type: "fiche_de_paie", dossier: "travail", emetteur: "SAS Exemple Logistique", organisme: null,
      montant: 1527.84, sens: "a_recevoir", a_traiter: false, urgence: "aucune", resume: /oct\. 2026/,
      infos: { SIRET: "81234567800027", "Salaire brut": "1 956,25 €" },
    },
  },
  {
    id: "paie-sans-euro-net-paye-apres-impot",
    texte: `Bulletin de paie
Employeur : Association Les Petits Pas
Convention collective : animation (IDCC 1518)
Mois : octobre 2026
Nom : Julie EXEMPLE
Salaire brut : 1 980,00
Cotisations salariales : 431,64
Net à payer avant impôt sur le revenu : 1 548,36
Prélèvement à la source : 23,23
Net payé : 1 525,13
Payé le 31/10/2026 par virement`,
    attendu: {
      type: "fiche_de_paie", dossier: "travail", emetteur: "Association Les Petits Pas", montant: 1525.13, sens: "a_recevoir",
      a_traiter: false, urgence: "aucune", resume: /oct\. 2026/, infos: { "Salaire brut": "1 980,00 €" },
    },
  },
  {
    id: "contrat-cdd-essai-jours",
    texte: `CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE
Entre les soussignés :
La SARL Exemple Restauration, dont le siège est situé 3 place du Marché, 13001 Marseille, représentée par M. Paul EXEMPLE, gérant, ci-après dénommée « l'employeur »,
et Madame Inès EXEMPLE, née le 12/05/1998 à Marseille, ci-après dénommée « le salarié ».
Article 1 - Objet : le présent contrat est conclu pour faire face à un accroissement temporaire d'activité.
Article 2 - Durée : du 01/12/2026 au 28/02/2027.
Article 3 - Période d'essai : le contrat ne deviendra définitif qu'à l'issue d'une période d'essai de 15 jours.
Article 4 - Rémunération : 1 850,00 € brut par mois pour 35 heures par semaine.
En cas de litige, le tribunal compétent sera celui du lieu de travail.
Fait à Marseille, le 6 novembre 2026, en deux exemplaires.`,
    attendu: {
      type: "contrat_de_travail", dossier: "travail", emetteur: "SARL Exemple Restauration", date_document: "2026-11-06",
      a_traiter: false, urgence: "aucune", infos: { "Période d'essai": "15 jours" },
    },
  },
  {
    id: "contrat-cdi-essai-en-lettres",
    texte: `CONTRAT DE TRAVAIL
(contrat à durée indéterminée)
Entre la société EXEMPLE CONSEIL SAS, 45 boulevard Haussmann, 75009 Paris, et Monsieur Thomas EXEMPLE.
Le salarié est engagé en qualité de consultant junior, statut cadre, à compter du 04/01/2027.
La période d'essai est fixée à trois mois, renouvelable une fois.
Rémunération annuelle brute : 38 000 €.
Le salarié relève de la convention collective Syntec.
Fait à Paris le 30 octobre 2026`,
    attendu: {
      type: "contrat_de_travail", dossier: "travail", date_document: "2026-10-30", a_traiter: false, urgence: "aucune",
      infos: { "Période d'essai": "3 mois" },
    },
  },
  {
    id: "contrat-cdi-lyon",
    texte: `CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE
Entre la société Boulangerie Martin, ci-après l'employeur, et Madame Camille Exemple, ci-après le salarié.
La période d'essai est de deux mois.
Fait à Lyon, le 1er septembre 2025, en deux exemplaires.`,
    attendu: {
      type: "contrat_de_travail", dossier: "travail", date_document: "2025-09-01", a_traiter: false,
      infos: { "Période d'essai": "2 mois" },
    },
  },
  {
    id: "attestation-employeur-destinee-ft",
    texte: `ATTESTATION EMPLOYEUR DESTINÉE À FRANCE TRAVAIL
Employeur : SARL Exemple Bâtiment - SIRET 498 765 432 00019
Salarié : Mehdi EXEMPLE
Emploi occupé : maçon
Date d'embauche : 02/03/2020
Date de fin de contrat : 31/10/2026
Motif de la rupture : fin de contrat à durée déterminée
Salaires des 12 derniers mois : voir tableau ci-joint
Fait à Rouen, le 31/10/2026`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", emetteur: "SARL Exemple Bâtiment", organisme: null,
      date_document: "2026-10-31", a_traiter: false, urgence: "aucune", infos: { SIRET: "49876543200019" },
    },
  },
  {
    id: "certificat-de-travail",
    texte: `CERTIFICAT DE TRAVAIL
Je soussigné, Paul EXEMPLE, gérant de la SARL Exemple Restauration, certifie que Madame Inès EXEMPLE, née le 12/05/1998, a été employée dans notre entreprise du 01/12/2025 au 28/02/2026 en qualité de serveuse.
Elle nous quitte libre de tout engagement.
Fait à Marseille, le 28/02/2026, pour servir et valoir ce que de droit.`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", emetteur: "SARL Exemple Restauration",
      date_document: "2026-02-28", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "solde-de-tout-compte",
    texte: `REÇU POUR SOLDE DE TOUT COMPTE
Je soussigné(e) Mehdi EXEMPLE reconnais avoir reçu de la société SARL Exemple Bâtiment la somme de 2 412,58 € pour solde de tout compte, en paiement des salaires, indemnités de congés payés et indemnité de fin de contrat.
Ce reçu peut être dénoncé dans les six mois qui suivent sa signature.
Fait à Rouen, le 31/10/2026, en deux exemplaires.`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", date_document: "2026-10-31", montant: 2412.58,
      a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "cv-email-orange",
    texte: `Camille EXEMPLE
Développeuse web
06 12 34 56 78 · camille.exemple@orange.fr · Lyon
EXPÉRIENCES PROFESSIONNELLES
2023 - 2026 Développeuse front-end, Agence Exemple, Lyon
2021 - 2023 Alternance, Exemple Informatique, Villeurbanne
FORMATION
2023 Master informatique, Université Exemple
2021 Licence informatique
COMPÉTENCES
JavaScript, TypeScript, React, SQL
LANGUES
Anglais courant, espagnol notions
CENTRES D'INTÉRÊT
Escalade, photographie`,
    attendu: {
      type: "cv", dossier: "travail", organisme: null, date_limite: null, montant: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "employeur-convocation-entretien-prealable",
    texte: `SAS EXEMPLE DISTRIBUTION
Zone industrielle Nord - 59000 Lille
Lettre recommandée avec accusé de réception
Lille, le 6 novembre 2026
Objet : convocation à un entretien préalable à une éventuelle sanction
Monsieur,
Nous envisageons de prendre à votre égard une sanction disciplinaire.
Nous vous convoquons à un entretien préalable le lundi 16 novembre 2026 à 10 h, dans le bureau du directeur.
Vous pouvez vous faire assister lors de cet entretien par une personne de votre choix appartenant au personnel de l'entreprise.
Veuillez agréer, Monsieur, nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", emetteur: "SAS Exemple Distribution", organisme: null,
      date_document: "2026-11-06", date_limite: "2026-11-16", intention: "rdv", a_traiter: true, urgence: "moyenne",
    },
  },
];
