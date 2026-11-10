import type { Papier } from "../outils/fiche.ts";

export const LOGEMENT_BANQUE: Papier[] = [
  {
    id: "quittance-loyer-sci",
    texte: `QUITTANCE DE LOYER
Période : novembre 2026
Bailleur : SCI EXEMPLE PATRIMOINE, 10 rue Victor Hugo, 31000 Toulouse
Locataire : Lucas EXEMPLE
Adresse du logement : 25 rue des Fleurs, appartement 12, 31000 Toulouse
Loyer : 620,00 €
Provision pour charges : 75,00 €
Total : 695,00 €
Je soussigné, bailleur du logement désigné ci-dessus, déclare avoir reçu la somme de 695,00 € au titre du loyer et des charges pour la période indiquée, et en donne quittance.
Fait à Toulouse, le 05/11/2026`,
    attendu: {
      type: "quittance_loyer", dossier: "logement", emetteur: "SCI Exemple Patrimoine", date_document: "2026-11-05",
      montant: 695, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "bail-habitation",
    texte: `CONTRAT DE LOCATION
Logement nu - soumis à la loi du 6 juillet 1989
Entre : Madame Anne EXEMPLE, ci-après dénommée « le bailleur »
Et : Monsieur Lucas EXEMPLE, ci-après dénommé « le locataire »
Désignation : appartement de type T2, 42 m², 25 rue des Fleurs, 31000 Toulouse
Date de prise d'effet : 01/09/2025
Durée du contrat : 3 ans
Loyer mensuel : 620,00 € hors charges
Dépôt de garantie : 620,00 €
Fait à Toulouse, le 25/08/2025`,
    attendu: {
      type: "bail", dossier: "logement", emetteur: null, date_document: "2025-08-25", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "avis-echeance-loyer",
    texte: `AGENCE EXEMPLE IMMOBILIER
Gestion locative - 5 place du Capitole 31000 Toulouse
AVIS D'ÉCHÉANCE
Date : 05/11/2026
Locataire : Lucas EXEMPLE
Période : décembre 2026
Loyer : 620,00 €
Provision pour charges : 75,00 €
Montant à payer : 695,00 €
À régler avant le 05/12/2026 par virement ou prélèvement.
Cet avis ne vaut pas quittance.`,
    attendu: {
      type: "facture", dossier: "logement", emetteur: "Agence Exemple Immobilier", date_document: "2026-11-05",
      date_limite: "2026-12-05", montant: 695, sens: "a_payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "regularisation-charges",
    texte: `Exemple Habitat - Office public de l'habitat
Régularisation annuelle des charges locatives 2025
Le 02/11/2026
Madame, Monsieur,
Nous avons procédé à la régularisation de vos charges pour l'année 2025.
Charges réelles : 1 012,40 €
Provisions versées : 900,00 €
Solde en notre faveur : 112,40 €
Ce montant sera ajouté à votre prochain avis d'échéance de décembre 2026.`,
    attendu: {
      type: "facture", dossier: "logement", date_document: "2026-11-02", montant: 112.4, sens: "a_payer",
    },
  },
  {
    id: "maif-attestation-habitation",
    texte: `MAIF
Attestation d'assurance habitation
N° de sociétaire : 1234567 A
Nous attestons que Monsieur Lucas EXEMPLE est assuré au titre d'un contrat Raqvam pour le logement situé 25 rue des Fleurs, 31000 Toulouse.
Ce contrat comprend la garantie responsabilité civile vie privée et les garanties des risques locatifs.
Période de validité : du 01/01/2026 au 31/12/2026.
Fait à Niort, le 02/01/2026.`,
    attendu: {
      type: "attestation_assurance", dossier: "logement", emetteur: "MAIF", organisme: "maif", date_document: "2026-01-02",
      date_expiration: "2026-12-31", a_traiter: false, urgence: "aucune", infos: { "N° de sociétaire": "1234567 A" },
    },
  },
  {
    id: "axa-avis-echeance-auto",
    texte: `AXA France
Avis d'échéance - Assurance automobile
Contrat n° 0123456789
Véhicule : Peugeot 208 immatriculé AB-123-CD
Date : 02/11/2026
Cotisation annuelle du 01/01/2027 au 31/12/2027 : 486,00 €
Montant à payer : 486,00 €
À régler avant le 01/01/2027.`,
    attendu: {
      type: "facture", dossier: "vehicule", emetteur: "AXA", organisme: "axa", date_document: "2026-11-02",
      date_limite: "2027-01-01", montant: 486, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° de contrat": "0123456789", Immatriculation: "AB-123-CD" },
    },
  },
  {
    id: "matmut-carte-verte",
    texte: `MATMUT
CERTIFICAT INTERNATIONAL D'ASSURANCE AUTOMOBILE (CARTE VERTE)
Valable du 01/04/2026 au 31/03/2027
Numéro d'immatriculation : GH-456-JK
Catégorie du véhicule : A - Voiture particulière
Marque : RENAULT
Souscripteur : Inès EXEMPLE`,
    attendu: {
      type: "attestation_assurance", dossier: "vehicule", emetteur: "Matmut", organisme: "matmut",
      date_expiration: "2027-03-31", a_traiter: false, urgence: "aucune", infos: { Immatriculation: "GH-456-JK" },
    },
  },
  {
    id: "releve-compte-virements-caf",
    texte: `Crédit Agricole Exemple
RELEVÉ DE COMPTE
Compte de dépôt n° 12345678901
Période du 01/10/2026 au 31/10/2026
IBAN : FR76 1234 5678 9012 3456 7890 123
BIC : AGRIFRPP123
Ancien solde au 30/09/2026 : 1 204,55 €
04/10 CB SUPERMARCHE EXEMPLE 54,20
05/10 VIR CAF DE PARIS PRESTATIONS 245,32
05/10 VIREMENT SALAIRE 1 642,18
10/10 PRLV EDF 84,60
12/10 PRLV FREE MOBILE 19,99
20/10 VIR CAF DE PARIS RAPPEL 37,00
Nouveau solde au 31/10/2026 : 2 970,25 €`,
    attendu: {
      type: "releve_bancaire", dossier: "banque", emetteur: "Crédit Agricole", organisme: "ca",
      date_limite: null, a_traiter: false, urgence: "aucune", infos: { IBAN: "FR76 •••• •••• 0123" },
    },
  },
  {
    id: "bnp-solde-debiteur",
    texte: `BNP Paribas
Agence Paris République
Paris, le 3 novembre 2026
Objet : position débitrice de votre compte
Madame,
Sauf erreur de notre part, votre compte courant n° 00012345678 présente un solde débiteur de 312,45 € depuis le 20/10/2026, au-delà de votre autorisation de découvert.
Nous vous remercions de bien vouloir régulariser cette situation sous 8 jours, en approvisionnant votre compte.
À défaut, nous serions contraints de rejeter les prochaines opérations présentées au paiement.
Veuillez agréer, Madame, l'expression de nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", dossier: "banque", emetteur: "BNP Paribas", organisme: "bnp", date_document: "2026-11-03",
      date_limite: "2026-11-11", montant: 312.45, a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "sg-nouvelle-carte",
    texte: `Société Générale
Le 28/10/2026
Madame, Monsieur,
Votre carte bancaire arrive bientôt à expiration. Votre nouvelle carte vous sera envoyée par courrier dans les prochains jours.
Votre code confidentiel reste inchangé.
Dès réception, pensez à signer votre carte et à détruire l'ancienne.`,
    attendu: {
      type: "courrier_administratif", dossier: "banque", emetteur: "Société Générale", organisme: "sg",
      date_document: "2026-10-28", date_limite: null, intention: "info", a_traiter: false, urgence: "aucune",
    },
  },
];
