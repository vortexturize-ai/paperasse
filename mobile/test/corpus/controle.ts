import type { Papier } from "../outils/fiche.ts";

export const CONTROLE: Papier[] = [
  {
    id: "controle-dgfip-taux-prelevement",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
Votre taux de prélèvement à la source
Le 12/08/2026
Numéro fiscal : 30 12 345 678 901
À compter de septembre 2026, votre taux personnalisé de prélèvement à la source est de 4,1 %.
Ce taux sera transmis à votre employeur, qui l'appliquera à votre salaire.
Vous pouvez le modifier à tout moment dans votre espace particulier sur impots.gouv.fr.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-08-12",
      date_limite: null, montant: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "controle-dgfip-degrevement",
    texte: `Finances publiques
AVIS DE DÉGRÈVEMENT
Taxe foncière 2026
Date : 28/10/2026
Suite à votre réclamation, un dégrèvement de 145 € vous est accordé.
Cette somme vous sera remboursée par virement dans les prochaines semaines.`,
    attendu: {
      type: "avis_imposition", dossier: "impots", organisme: "dgfip", date_document: "2026-10-28",
      montant: 145, sens: "a_recevoir", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "controle-caf-attestation-paiement",
    texte: `CAF de la Haute-Garonne
ATTESTATION DE PAIEMENT
Le 02/11/2026
N° allocataire : 3344556
Nous certifions avoir versé à Madame EXEMPLE les prestations suivantes :
Octobre 2026 : aide personnalisée au logement 212,00 €
Octobre 2026 : prime d'activité 158,40 €`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: "2026-11-02", date_limite: null, a_traiter: false, urgence: "aucune",
      infos: { "N° allocataire": "3344556" },
    },
  },
  {
    id: "controle-caf-changement-adresse",
    texte: `Caisse d'Allocations Familiales du Var
Toulon, le 30 octobre 2026
Madame, Monsieur,
Vous nous avez signalé votre déménagement. Nous avons bien enregistré votre nouvelle adresse.
Vos droits seront recalculés à partir du mois prochain. Vous n'avez rien à faire.
Nous vous prions d'agréer, Madame, Monsieur, nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "caf", date_document: "2026-10-30",
      date_limite: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "controle-cpam-carte-vitale-photo",
    texte: `Assurance Maladie
Votre carte Vitale
Paris, le 4 novembre 2026
Madame,
Pour fabriquer votre carte Vitale, nous avons besoin de votre photo et d'une copie de votre pièce d'identité.
Renvoyez le formulaire ci-joint complété dans un délai de 15 jours, dans l'enveloppe T jointe.`,
    attendu: {
      type: "courrier_administratif", dossier: "sante", organisme: "cpam", date_document: "2026-11-04",
      date_limite: "2026-11-19", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "controle-pole-emploi-ancien-nom-radiation",
    texte: `Pôle emploi
Agence de Nantes
Le 26/10/2026
Objet : décision de radiation
Monsieur,
Vous ne vous êtes pas présenté au rendez-vous du 15/10/2026. Vous êtes radié de la liste des demandeurs d'emploi pour une durée d'un mois.
Vous pouvez contester cette décision dans un délai de deux mois par un recours auprès de votre agence.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", organisme: "francetravail", date_document: "2026-10-26",
      date_limite: "2026-12-26", a_traiter: true,
    },
  },
  {
    id: "controle-free-mobile-a-regler",
    texte: `Free Mobile
Facture du 01/11/2026
Forfait Free 5G : 15,99 €
Montant à régler : 15,99 € avant le 25/11/2026
Votre paiement par carte a été refusé. Merci de régulariser depuis votre Espace Abonné.`,
    attendu: {
      type: "facture", dossier: "factures", organisme: "free", date_document: "2026-11-01",
      date_limite: "2026-11-25", montant: 15.99, sens: "a_payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "controle-engie-rappel-impaye",
    texte: `ENGIE
Rappel
Le 03/11/2026
Madame, Monsieur,
Sauf erreur de notre part, votre facture n° 2026-554433 du 02/10/2026, d'un montant de 96,40 €, reste impayée à ce jour.
Merci de procéder à son règlement sous 10 jours.`,
    attendu: {
      type: "facture", dossier: "factures", organisme: "engie", date_document: "2026-11-03",
      date_limite: "2026-11-13", montant: 96.4, sens: "a_payer", intention: "relance", a_traiter: true, urgence: "moyenne",
      infos: { "N° de facture": "2026-554433" },
    },
  },
  {
    id: "controle-sosh-facture",
    texte: `Sosh
Votre facture du 05/11/2026
Forfait mobile 20 Go : 10,99 €
Total TTC : 10,99 €
Prélèvement sur votre compte le 15/11/2026.`,
    attendu: { type: "facture", dossier: "factures", emetteur: "Orange", organisme: "orange", montant: 10.99, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "controle-mairie-convocation-cni",
    texte: `Mairie de Nantes
Service des titres d'identité
Nantes, le 5 novembre 2026
Madame,
Votre carte nationale d'identité est prête. Nous vous invitons à venir la retirer le jeudi 19 novembre 2026 à 9 h 30, muni de votre ancienne carte.
Sans retrait dans les 3 mois, la carte sera détruite.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "mairie", date_document: "2026-11-05",
      date_limite: "2026-11-19", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "controle-prefecture-rdv-remise-titre",
    texte: `PRÉFECTURE DE LA GIRONDE
Bureau du séjour
Bordeaux, le 2 novembre 2026
Monsieur,
Vous êtes convoqué le vendredi 27 novembre 2026 à 14 h 00 au guichet n° 3 pour la remise de votre titre de séjour.
Présentez-vous avec votre récépissé, votre passeport et un timbre fiscal de 225 euros.`,
    attendu: {
      type: "courrier_administratif", dossier: "identite", organisme: "prefecture", date_document: "2026-11-02",
      date_limite: "2026-11-27", intention: "rdv", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "controle-lcl-releve",
    texte: `LCL
RELEVÉ DE COMPTE COURANT
Du 01/10/2026 au 31/10/2026
IBAN FR76 3000 2012 3400 0012 3456 789
Solde au 01/10/2026 : 512,30 €
CB CARREFOUR 03/10 42,18
VIR SEPA EMPLOYEUR 1 845,00
PRLV SFR 19,99
Solde au 31/10/2026 : 2 295,13 €`,
    attendu: {
      type: "releve_bancaire", dossier: "banque", emetteur: "LCL", organisme: "lcl", a_traiter: false, urgence: "aucune",
      infos: { IBAN: "FR76 •••• •••• 6789" },
    },
  },
  {
    id: "controle-allianz-echeance-habitation",
    texte: `Allianz
Avis d'échéance
Contrat multirisque habitation n° 55667788
Date : 20/10/2026
Votre cotisation pour la période du 01/12/2026 au 30/11/2027 s'élève à 312,40 €.
Montant à payer avant le 01/12/2026 : 312,40 €`,
    attendu: {
      type: "facture", dossier: "logement", organisme: "allianz", date_document: "2026-10-20",
      date_limite: "2026-12-01", montant: 312.4, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° de contrat": "55667788" },
    },
  },
  {
    id: "controle-syndic-appel-de-fonds",
    texte: `CABINET EXEMPLE GESTION
Syndic de copropriété
APPEL DE FONDS
Résidence Les Tilleuls - Lot n° 12
Date d'émission : 01/11/2026
Quote-part charges courantes 4e trimestre 2026 : 384,00 €
Total à payer : 384,00 €
Date d'exigibilité : 01/12/2026`,
    attendu: {
      type: "facture", dossier: "logement", emetteur: "Cabinet Exemple Gestion", date_document: "2026-11-01",
      date_limite: "2026-12-01", montant: 384, sens: "a_payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "controle-antai-montant-simple",
    texte: `ANTAI - Avis de contravention
Date de l'avis : 04/11/2026
Lieu de l'infraction : avenue de la Gare, Rennes
Nature : feu rouge
Montant de l'amende : 135 euros
Le paiement doit intervenir dans un délai de 45 jours.`,
    attendu: {
      type: "amende", dossier: "vehicule", organisme: "antai", date_document: "2026-11-04",
      date_limite: "2026-12-19", montant: 135, sens: "a_payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "controle-paie-net-paye-en-euros",
    texte: `GARAGE EXEMPLE AUTOMOBILES
BULLETIN DE SALAIRE - OCTOBRE 2026
Salarié : Hugo EXEMPLE - Mécanicien
Salaire de base 2 050,00
Prime d'ancienneté 61,50
Total brut 2 111,50
Total cotisations salariales -468,23
Net à payer avant impôt 1 643,27
Impôt sur le revenu prélevé à la source -36,15
Net payé en euros 1 607,12`,
    attendu: {
      type: "fiche_de_paie", dossier: "travail", emetteur: "Garage Exemple Automobiles", montant: 1607.12, sens: "a_recevoir",
      a_traiter: false, urgence: "aucune", resume: /oct\. 2026/,
    },
  },
  {
    id: "controle-contrat-saisonnier-une-semaine",
    texte: `CONTRAT DE TRAVAIL SAISONNIER
Entre la SAS Exemple Vendanges et Monsieur Léo EXEMPLE.
Le contrat est conclu pour la durée des vendanges, du 05/09/2026 au 30/09/2026.
La période d'essai est d'une semaine.
Fait à Beaune, le 01/09/2026`,
    attendu: {
      type: "contrat_de_travail", dossier: "travail", emetteur: "SAS Exemple Vendanges", date_document: "2026-09-01",
      a_traiter: false, urgence: "aucune", infos: { "Période d'essai": "1 semaine" },
    },
  },
  {
    id: "controle-ordonnance-kine",
    texte: `Dr Paul EXEMPLE
Médecin du sport
Lyon, le 02/11/2026
Prescription : 10 séances de kinésithérapie pour rééducation du genou gauche.
À renouveler si besoin.`,
    attendu: { type: "ordonnance", dossier: "sante", date_document: "2026-11-02", a_traiter: false, urgence: "aucune" },
  },
  {
    id: "controle-urssaf-attestation-vigilance",
    texte: `Urssaf
ATTESTATION DE VIGILANCE
Délivrée le 15/10/2026
L'Urssaf atteste que l'entreprise EXEMPLE SERVICES, SIRET 812 345 678 00027, est à jour de ses obligations de déclaration et de paiement.
Cette attestation est valable 6 mois.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "urssaf", date_document: "2026-10-15",
      a_traiter: false, urgence: "aucune", infos: { SIRET: "81234567800027" },
    },
  },
  {
    id: "controle-signification-jugement",
    texte: `Maître Claire EXEMPLE
Commissaire de justice
5 place du Palais 33000 Bordeaux
SIGNIFICATION DE JUGEMENT
Le 06/11/2026
À la requête de la SA Exemple Finance, je vous ai signifié le jugement rendu par le tribunal judiciaire de Bordeaux le 15/09/2026, vous condamnant à payer la somme de 3 210,50 €.
Vous disposez d'un délai d'un mois pour faire appel de cette décision.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "justice", date_document: "2026-11-06",
      date_limite: "2026-12-06", montant: 3210.5, sens: "a_payer", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "controle-banque-postale-frais",
    texte: `La Banque Postale
Le 25/10/2026
Madame, Monsieur,
Nous vous informons qu'à compter du 01/01/2027, la cotisation annuelle de votre carte bancaire évoluera.
Le détail de nos tarifs est disponible sur labanquepostale.fr.
Veuillez agréer nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", dossier: "banque", organisme: "banquepostale", date_document: "2026-10-25",
      date_limite: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "controle-mutuelle-appel-cotisation",
    texte: `MUTUELLE EXEMPLE SANTÉ
Échéancier de cotisations 2027
Date : 30/10/2026
Adhérent n° 778899
Votre cotisation mensuelle sera de 54,20 € à partir du 01/01/2027.
Elle sera prélevée le 5 de chaque mois.`,
    attendu: { type: "facture", dossier: "sante", emetteur: "Mutuelle Exemple Santé", date_document: "2026-10-30", a_traiter: false, urgence: "aucune" },
  },
  {
    id: "controle-licenciement",
    texte: `EXEMPLE TRANSPORTS SARL
Lettre recommandée avec accusé de réception
Marseille, le 30 octobre 2026
Monsieur,
Nous vous notifions par la présente votre licenciement pour motif économique.
Votre préavis, d'une durée de deux mois, débutera à la première présentation de cette lettre.
Vous trouverez ci-joint les documents relatifs au contrat de sécurisation professionnelle.
Veuillez agréer, Monsieur, nos salutations distinguées.`,
    // Aucune date limite écrite : le moteur ne doit pas en inventer une (le préavis n'en est pas une).
    attendu: {
      type: "courrier_administratif", dossier: "travail", emetteur: "Exemple Transports SARL", organisme: null,
      date_document: "2026-10-30", date_limite: null, montant: null,
    },
  },
  {
    id: "controle-ticket-pharmacie",
    texte: `PHARMACIE DU CENTRE
Le 06/11/2026 à 18:05
Doliprane 1000 mg 2,18 €
Sérum physiologique 3,90 €
TOTAL 6,08 €
Réglé CB
Merci de votre visite`,
    attendu: { type: "ticket_garantie", dossier: "factures", emetteur: "Pharmacie du Centre", montant: 6.08, a_traiter: false, urgence: "aucune" },
  },
];
