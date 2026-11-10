import type { Papier } from "../outils/fiche.ts";
import { td1 } from "../outils/mrz.ts";

// Verso d'une carte d'identité photographié : la bande MRZ est lue avec un caractère en trop ou en moins par ligne.
const [m1, m2, m3] = td1({
  code: "ID", pays: "FRA", numero: "Y7KQ2MZ81", naissance: "1987-02-11", sexe: "F", expiration: "2032-05-20",
  nationalite: "FRA", nom: "EXEMPLE", prenoms: ["CAMILLE"],
});
const mrzPhoto = [`${m1}<`, m2.slice(0, 29), `${m3.slice(0, 25)} ${m3.slice(25)}<`].join("\n");

// Pièges rencontrés sur de vrais papiers, réécrits avec des noms, numéros et montants inventés.
export const PIEGES: Papier[] = [
  {
    id: "ij-attestation-loi-1978",
    texte: `Numéro de l'assuré : 2 91 03 75 123 456
Nom de l'assuré : EXEMPLE Camille
Pour mes démarches, j'utilise mon compte ameli. Avec l'appli sur mon smartphone c'est très simple !
La loi n° 78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers et aux libertés s'applique aux réponses faites sur ce formulaire.
Document établi le 05/09/2023
ATTESTATION DE PAIEMENT DES INDEMNITÉS JOURNALIÈRES
Arrêts liés à l'activité salariée :
Maladie du 03/02/2022 au 20/06/2022 : 2 870,00 euros
A déduire de ce montant CSG : 172,20 euros et RDS : 14,35 euros
Ce paiement a été effectué à votre employeur (subrogation).`,
    attendu: {
      type: "document_sante", dossier: "sante", organisme: "cpam", date_document: "2023-09-05", date_limite: null,
      a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "paie-sans-titre-lisible",
    texte: `31/01/26 Virement 4 an(s) et 3 mois
INDUSTRIES EXEMPLE
Conducteur de ligne OUVRIER
M. Lucas EXEMPLE
01/10/21 151,67
Salaire horaire 13,27 2 012,40
Prime de nuit 20 % 131,20
Prime dimanche 198,75
IJSS Maladie du 12/01/26 au 15/01/26 248,30
Total Brut 2 395,60
Total des Cotisations et Contributions 498,10
Prime panier jour non soumis 28,00`,
    attendu: { type: "fiche_de_paie", dossier: "travail", date_document: "2026-01-31", a_traiter: false, date_limite: null },
  },
  {
    id: "paie-agricole-msa-en-tete",
    texte: `MSA Ain-Rhône
EARL DES EXEMPLES
BULLETIN DE SALAIRE
Période du 01/04/2021 au 30/04/2021
Salarié : Mme Camille EXEMPLE
Salaire de base 151,67 h x 10,48 1 589,50
Salaire brut 1 589,50
Cotisations MSA 349,70
Net à payer avant impôt sur le revenu 1 239,80
Net payé 1 239,80 €`,
    attendu: {
      type: "fiche_de_paie", emetteur: "EARL des Exemples", organisme: null, date_document: "2021-04-30",
      montant: 1239.8, sens: "a_recevoir", a_traiter: false,
    },
  },
  {
    id: "convention-stage-clause-48h",
    texte: `CONVENTION DE STAGE
Entre l'établissement d'enseignement : Lycée professionnel Exemple, Lyon
Et l'organisme d'accueil : SAS Exemple Mécanique
Article 6 – Protection sociale
Le stagiaire continue à bénéficier de la législation sur les accidents du travail. En cas d'accident survenant au stagiaire, l'organisme d'accueil s'engage à procéder à la déclaration, dans les 48 heures à compter du jour où il en a été personnellement informé, auprès de la caisse primaire d'assurance maladie.
Article 7 – Absences
Toute absence doit être signalée à l'établissement d'enseignement.
Article 8 – Durée
Le stage se déroule du 13/03/2023 au 07/04/2023.
Fait en trois exemplaires.`,
    attendu: { type: "contrat_de_travail", dossier: "travail", date_limite: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "contrat-certificat-medical-48h",
    texte: `ASSOCIATION EXEMPLE SERVICES
Contrat de travail à durée déterminée
Article 1 – Engagement
L'association engage Mme Camille EXEMPLE en qualité d'agente d'entretien.
Article 2 – Durée
Le contrat est conclu du 03/01/2022 au 30/04/2022.
Article 5-2 Conditions d'exercice de l'activité
En cas d'absence pour maladie, la salariée doit prévenir l'association et en justifier par la production d'un certificat médical dans les 48 heures.
Rémunération : 10,57 € de l'heure.`,
    attendu: {
      type: "contrat_de_travail", emetteur: "Association Exemple Services", date_limite: null, montant: null, a_traiter: false,
    },
  },
  {
    id: "attestation-employeur-pole-emploi",
    texte: `GAEC DU MOULIN EXEMPLE
ATTESTATION EMPLOYEUR DESTINÉE À PÔLE EMPLOI
Caisse de protection sociale : MSA Ain-Rhône
Salariée : Mme Camille EXEMPLE
Emploi occupé : ouvrière agricole
Contrat à durée déterminée du 05/07/2021 au 30/07/2021
Motif de la rupture du contrat de travail : fin de contrat à durée déterminée
Salaires des 12 mois civils complets précédant le dernier jour travaillé
Juillet 2021 : 912,00 €
Taux horaire : 10,48 €
Pour toute information concernant le prélèvement à la source de l'impôt sur le revenu, contactez l'administration fiscale sur www.impots.gouv.fr. Montant prélevé : 1,87 €
Le salarié doit remettre cette attestation à Pôle emploi : s'il est déjà inscrit, dans les 72 h de sa délivrance.`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", emetteur: "GAEC du Moulin Exemple", date_limite: null,
      montant: null, a_traiter: false,
    },
  },
  {
    id: "attestation-pole-emploi-scannee-liens-mal-lus",
    texte: `ATTESTATION PÔLE EMPLOI page 1/2
Employeur : SCEA DES COTEAUX EXEMPLE
N° SIRET : 000 000 000 00000
Salariée : Mme Camille EXEMPLE
Emploi occupé : ouvrière viticole saisonnière
Nature du contrat : contrat à durée déterminée saisonnier
Date d'embauche : 07/02/2022
Dernier jour travaillé et payé : 04/03/2022
Motif de la rupture du contrat de travail : fin de contrat à durée déterminée
Salaires des 12 mois civils complets précédant le dernier jour travaillé payé
Février 2022 : 1 498,30 € brut, nombre d'heures 151,67
Mars 2022 : 47,10 € brut, nombre d'heures 4
Indemnités de fin de contrat et de congés payés versées au salarié : 154,30 €
L'employeur certifie l'exactitude des renseignements portés sur cette attestation.
Pour toute information concernant le prélèvement à la source de l'impôt sur le revenu, contactez l'administration fiscale sur www.tmpats.gouv.fi ou sur seruice-public.fr.
Le salarié doit remettre cette attestation à Pôle emploi : s'il est déjà inscrit, dans les 72 h de sa délivrance ; sinon, lors de son inscription.
Fait à Exempleville, le 08/03/2022. Cachet et signature de l'employeur.`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", emetteur: "SCEA des Coteaux Exemple", date_document: "2022-03-08",
      date_limite: null, montant: null, a_traiter: false,
    },
  },
  {
    id: "attestation-scannee-adresses-collees",
    texte: `ATTESTATION D'EMPLOYEUR DESTINÉE À PÔLE EMPLOI
Employeur : SAS EXEMPLE ESPACES VERTS
N° SIRET : 000 000 000 00000
Salarié : M. Lucas EXEMPLE
Emploi occupé : jardinier
Date d'embauche : 02/05/2022
Dernier jour travaillé et payé : 30/06/2022
Motif de la rupture du contrat de travail : fin de contrat à durée déterminée
Salaires des 12 mois civils complets précédant le dernier jour travaillé payé
Mai 2022 : 1 610,00 € brut, nombre d'heures 151,67
Juin 2022 : 1 610,00 € brut, nombre d'heures 151,67
Indemnité compensatrice de congés payés versée : 322,00 €. Indemnité de fin de contrat versée : 322,00 €.
Préavis : non effectué. Contrat de professionnalisation : non. Le salarié bénéficie d'une portabilité de la prévoyance.
L'employeur certifie l'exactitude des renseignements portés sur cette attestation et la remet au salarié le jour de la fin du contrat.
Pour toute information sur le prélèvement à la source, consultez www.impots.gouv.fr.ou rendez-vous dans votre centre des finances publiques (www.impots.gouu;fr.ou contacter votre centre).
Pour le calcul de vos droits par France Travail, la fiche de paie détaillée est disponible sur www.exemple-paie.fr.
Le salarié doit remettre cette attestation à France Travail dès son inscription.
Fait à Exempleville, le 01/07/2022. Cachet et signature de l'employeur.`,
    attendu: {
      type: "attestation_employeur", dossier: "travail", emetteur: "SAS Exemple Espaces Verts", date_document: "2022-07-01",
      date_limite: null, a_traiter: false,
    },
  },
  {
    id: "paie-titre-mal-lu",
    texte: `BI'ILLETIN DE PAIE GLARIFIE
SAS EXEMPLE TRANSPORTS
Période du 01/03/2023 au 31/03/2023
Salaire de base 151,67 h 1 720,00
Salaire brut 1 720,00
Cotisations salariales 378,40
Net à payer avant impôt sur le revenu 1 341,60
Net payé 1 341,60 €`,
    attendu: {
      type: "fiche_de_paie", emetteur: "SAS Exemple Transports", date_document: "2023-03-31", montant: 1341.6, sens: "a_recevoir",
      a_traiter: false,
    },
  },
  {
    id: "caf-montant-du-droit",
    texte: `Caisse d'allocations familiales du Rhône
Lyon, le 05/10/2026
Madame,
Votre allocation de logement a été recalculée à partir du 01/10/2026.
Montant du droit : 212,40 € par mois.
Ce montant sera versé sur votre compte le 05 de chaque mois.
Veuillez agréer, Madame, nos salutations distinguées.`,
    attendu: { type: "courrier_administratif", organisme: "caf", montant: 212.4, sens: "a_recevoir", a_traiter: false, date_limite: null },
  },
  {
    id: "bordereau-total-sans-demande",
    texte: `BORDEREAU DE REMISE DE CHÈQUES
Nombre de chèques remis : 3
Total : 1 250,00 €
Remis le 12/09/2026
Signature du remettant`,
    attendu: { type: "autre", montant: 1250, sens: "information", a_traiter: false, date_limite: null },
  },
  {
    id: "cni-verso-photo-mrz-mal-lue",
    texte: `RÉPUBLIQUE FRANÇAISE
Adresse : 12 rue des Exemples 69000 Lyon
Date de délivrance : 20.05.2022
Autorité de délivrance : Préfecture du Rhône
${mrzPhoto}`,
    attendu: { type: "piece_identite", dossier: "identite", a_traiter: false, date_limite: null, urgence: "aucune" },
  },
  {
    id: "compte-rendu-radiologie-dentaire",
    texte: `CABINET DE RADIOLOGIE EXEMPLE
Prise de rendez-vous au 04 00 00 00 00 ou sur doctolib.fr
www.radiologie-exemple.fr Rendez-vous : 04 00 00 00 01
Docteur Paul EXEMPLE
Diplômé de la faculté de médecine de Lyon
COMPTE RENDU
Radiographie panoramique dentaire du 12/03/2024
Indication : bilan dentaire avant soins.
Résultat : pas de lésion osseuse visible, dents de sagesse incluses.
Conclusion : examen sans particularité.
Dr Paul EXEMPLE`,
    attendu: { type: "document_sante", dossier: "sante", date_document: "2024-03-12", a_traiter: false, date_limite: null },
  },
  {
    id: "rib-photo-iban-mal-lu",
    texte: `RELEVÉ D'IDENTITÉ BANCAIRE
Titulaire du compte : M. Lucas EXEMPLE
Domiciliation : BANQUE EXEMPLE LYON CENTRE
Code banque 30006 Code guichet 00001 N° de compte 12345678901 Clé RIB 89
IBAN FR76 3000 6000 O112 3456 7890 l89
BIC EXEMFRPP`,
    attendu: { type: "releve_bancaire", dossier: "banque", a_traiter: false, date_limite: null, montant: null },
  },
  {
    id: "cni-ancienne-verso",
    texte: `Carte valable jusqu'au : 14.03.2029
délivrée le : 15.03.2014
par : PRÉFECTURE DU RHÔNE
Signature de l'autorité
Adresse : 12 rue des Exemples 69000 LYON`,
    attendu: { type: "piece_identite", dossier: "identite", date_expiration: "2029-03-14", a_traiter: false, date_limite: null },
  },
  {
    id: "pension-paiement-verse",
    texte: `L'Assurance Maladie
Caisse primaire d'assurance maladie du Rhône
Votre pension d'invalidité
Paiement du 05/06/2024
Montant brut de votre pension : 1 358,00 €
CSG, CRDS et CASA : 109,40 €
Montant net du paiement : 1 248,60 €
Montant imposable : 1 291,00 €
Prélèvement à la source de l'impôt sur le revenu : 0,00 €
Ce montant a été versé sur votre compte bancaire.`,
    attendu: {
      type: "courrier_administratif", organisme: "cpam", montant: 1248.6, sens: "a_recevoir", a_traiter: false,
    },
  },
  {
    id: "pension-total-du-paiement",
    texte: `Assurance Maladie
Relevé de paiement de votre pension d'invalidité
Période de juin 2024
Montant brut : 1 358,00 €
CSG taux réduit : 51,60 €
CASA : 4,10 €
Total du paiement : 1 302,30 €`,
    attendu: { type: "courrier_administratif", organisme: "cpam", montant: 1302.3, sens: "a_recevoir", a_traiter: false, date_limite: null },
  },
  {
    id: "pension-notification-recours-sans-date",
    texte: `Assurance Maladie
Notification d'attribution d'une pension d'invalidité
Nous vous informons que votre pension d'invalidité de catégorie 2 vous est attribuée.
Montant mensuel de votre pension : 612,40 €
En cas de désaccord, vous devez, dans un délai de deux mois à compter de cette notification, adresser votre recours à la commission de recours amiable.`,
    attendu: { type: "courrier_administratif", organisme: "cpam", emetteur: "Assurance Maladie", date_limite: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "simulation-rsa-titre-de-sejour-cite",
    texte: `Caisse d'allocations familiales
Simulation de vos droits au revenu de solidarité active (RSA)
Simulation réalisée le 14/04/2022
Vous
État civil : en couple
Votre conjoint
Nationalité : Autre
Titre de séjour : votre conjoint a résidé plus de 5 ans en France avec un titre de séjour valide.
Ressources perçues : 540,00 €
Montant estimé de votre RSA : 1 012,00 € par mois
Cette simulation est donnée à titre indicatif et n'ouvre pas de droit.`,
    attendu: { type: "courrier_administratif", dossier: "administratif", organisme: "caf", emetteur: "CAF", date_document: "2022-04-14", a_traiter: false },
  },
  {
    id: "avis-impot-amende-penale-citee",
    texte: `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
AVIS D'IMPÔT 2023 SUR LES REVENUS DE L'ANNÉE 2022
Date d'établissement : 31/07/2023
Revenu fiscal de référence : 18 540 €
Impôt sur le revenu net : 0 €
Vous n'êtes pas imposable.
Le fait de se faire délivrer indûment un document administratif est puni de deux ans d'emprisonnement et de 30 000 € d'amende en vertu de l'article 441-6 du code pénal.`,
    attendu: { type: "avis_imposition", date_document: "2023-07-31", montant: null, a_traiter: false, date_limite: null },
  },
  {
    id: "bon-de-commande-marketplace",
    texte: `Récapitulatif de commande
Commande n° X7QW2PL9RT
Quantité totale : 1
Poids total : 640 g
Montant total: €84.90
Total produit: €84.90
Livraison: €0.00
Vendeur : contact via c-1234-abcd@marketplace. fnac.com / 06 00 00 00 00
Écran de remplacement`,
    attendu: { type: "ticket_garantie", dossier: "factures", montant: 84.9, date_limite: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "justificatif-domicile-energie",
    texte: `4 RUE DES EXEMPLES
69000 LYON
JUSTIFICATIF D'ABONNEMENT N° ATT0000000001
Madame, Monsieur,
TotalEnergies Électricité et Gaz France atteste que depuis le 12/05/2018 Camille EXEMPLE est titulaire d'un contrat de fourniture d'énergie à l'adresse ci-dessus.
Le présent document peut valoir justificatif de domicile et est établi sur la base des déclarations du titulaire du contrat lors de sa souscription.
Fait le 18/09/2023
Merci de votre confiance,
Votre conseiller TotalEnergies`,
    attendu: {
      emetteur: "TotalEnergies", organisme: "totalenergies", dossier: "logement", date_document: "2023-09-18",
      a_traiter: false, intention: "info",
    },
  },
  {
    id: "rapport-expertise-auto",
    texte: `CABINET EXPERT AUTO EXEMPLE
RAPPORT D'EXPERTISE
Date du rapport : 08/03/2022
Véhicule : Exemple Modèle 2.0
Immatriculation : AB-123-CD
Date de première immatriculation : 15/03/2015
Certificat d'immatriculation présenté : oui
Kilométrage relevé : 132 400 km
Conclusions : véhicule réparable.
Valeur de remplacement à dire d'expert : 19 400 €`,
    attendu: { dossier: "vehicule", date_document: "2022-03-08", montant: 19400, sens: "information", a_traiter: false },
  },
  {
    id: "caf-merci-de-nous-le-faire-parvenir",
    texte: `Caisse d'allocations familiales du Rhône
Lyon, le 02/11/2026
Madame Camille EXEMPLE
Objet : demande de justificatif
Madame,
Pour continuer à vous verser l'aide au logement, nous avons besoin de votre dernier avis d'impôt. Merci de nous le faire parvenir au plus tard le 20/11/2026 sur caf.fr, rubrique Mon Compte.
Sans réponse de votre part, le versement de vos droits sera suspendu.
Veuillez agréer, Madame, nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", organisme: "caf", date_document: "2026-11-02", date_limite: "2026-11-20",
      a_traiter: true, intention: "envoyer_document",
    },
  },
  {
    id: "vieux-courrier-delai-relatif",
    texte: `MUTUELLE EXEMPLE SANTÉ
Objet : votre dossier de remboursement
Soins du 03/03/2021 au 31/03/2021
Madame, Monsieur,
Merci de nous retourner le formulaire complété dans un délai de 15 jours.
Veuillez agréer nos salutations distinguées.`,
    attendu: { type: "courrier_administratif", dossier: "sante", emetteur: "Mutuelle Exemple Santé", date_limite: null, a_traiter: true, intention: "envoyer_document" },
  },
  {
    id: "mda-decision-aah",
    texte: `Maison départementale de l'autonomie (MDA) du Rhône
Courrier à conserver
Votre numéro de dossier : 00X000
Madame,
La commission des droits et de l'autonomie des personnes handicapées a examiné votre demande.
Elle vous attribue l'allocation aux adultes handicapés du 01/02/2024 au 31/01/2029.
Veuillez agréer, Madame, nos salutations distinguées.`,
    attendu: { type: "courrier_administratif", organisme: "mdph", emetteur: "MDPH", a_traiter: false, date_limite: null },
  },
  {
    id: "opposition-prelevement-sepa",
    texte: `CAISSE D'EPARGNE RHÔNE ALPES
Opposition à un prélèvement SEPA
Le client donne instruction à la Caisse d'Epargne de rejeter sur ce compte tout prélèvement SEPA émis par le créancier et concernant le mandat référencé ci-après, à compter du 15/03/2022.
Créancier : EXEMPLE ABONNEMENTS
Référence unique du mandat : EX0000000
Fait le 14/03/2022
Signature du client`,
    attendu: { dossier: "banque", organisme: "ce", emetteur: "Caisse d'Épargne", date_document: "2022-03-14", date_limite: null, a_traiter: false },
  },
  {
    id: "attestation-inscription-cfa",
    texte: `CFA EXEMPLE DES MÉTIERS
ATTESTATION D'INSCRIPTION
Je soussigné M. Paul EXEMPLE, formateur référent, atteste que M. Lucas EXEMPLE est bien inscrit au CFA et prépare une formation en mécanique.
Le contrat de formation, établi pour une durée de 10 mois, débute le 04/09/2023.
Fait à Lyon, le 04/09/2023.`,
    attendu: { type: "certificat_scolarite", dossier: "etudes", date_document: "2023-09-04", date_limite: null, a_traiter: false },
  },
];
