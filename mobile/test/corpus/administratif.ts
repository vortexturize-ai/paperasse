import type { Papier } from "../outils/fiche.ts";

export const ADMINISTRATIF: Papier[] = [
  {
    id: "caf-pieces-avant-le",
    texte: `Caisse d'Allocations Familiales
de la Seine-Saint-Denis
93024 Bobigny Cedex
Bobigny, le 2 novembre 2026
N° allocataire : 7654321 B
Objet : demande de pièces justificatives
Madame,
Pour continuer à étudier votre demande de prime d'activité, nous avons besoin des documents suivants :
- vos trois derniers bulletins de salaire ;
- un relevé d'identité bancaire.
Merci de nous les transmettre avant le 30/11/2026, par courrier ou depuis votre espace Mon Compte sur caf.fr.
Nous vous prions d'agréer, Madame, nos salutations distinguées.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: "2026-11-02", date_limite: "2026-11-30", intention: "envoyer_document",
      a_traiter: true, urgence: "faible", infos: { "N° allocataire": "7654321 B" },
      extrait: /avant le 30\/11\/2026/,
    },
  },
  {
    id: "caf-notification-apl",
    texte: `CAF du Rhône
Notification de droits
Lyon, le 28/10/2026
N° allocataire : 1122334
Madame, Monsieur,
Nous avons étudié vos droits à l'aide personnalisée au logement (APL).
À partir de novembre 2026, le montant de votre aide est de 245,32 € par mois.
Cette somme sera versée directement à votre bailleur.
Vous pouvez consulter le détail de ce calcul dans votre espace Mon Compte sur caf.fr.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: "2026-10-28", date_limite: null, montant: 245.32, sens: "a_recevoir",
      intention: "droits", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "caf-indu",
    texte: `Caisse d'allocations familiales de Paris
75750 Paris Cedex 15
Paris, le 4 novembre 2026
N° allocataire : 9988776 C
Objet : notification d'indu
Madame, Monsieur,
Suite à la mise à jour de votre situation professionnelle, nous avons recalculé vos droits à la prime d'activité.
Vous avez perçu 512,40 € de trop entre juin et septembre 2026.
Vous devez rembourser la somme de 512,40 €. Sans réponse de votre part, cette somme sera retenue sur vos prochaines prestations.
Si vous n'êtes pas d'accord, vous pouvez contester cette décision dans un délai de deux mois.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: "2026-11-04", date_limite: "2027-01-04", montant: 512.4, sens: "a_payer",
      intention: "indu", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "caf-rendez-vous-jour-de-semaine",
    texte: `CAF de la Gironde
Bordeaux, le 5 novembre 2026
Objet : rendez-vous
Madame,
Dans le cadre de l'examen de votre dossier RSA, vous êtes convoquée le mardi 24 novembre 2026 à 10 h 30 à l'accueil de la CAF, 6 rue Claude-Bonnier à Bordeaux.
Merci de vous munir d'une pièce d'identité et de vos trois derniers avis de paiement.
En cas d'empêchement, prévenez-nous au plus vite.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: "2026-11-05", date_limite: "2026-11-24", intention: "rdv", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "caf-declaration-trimestrielle",
    texte: `caf.fr
Déclaration trimestrielle de ressources
Madame, Monsieur,
Pour continuer à recevoir votre revenu de solidarité active, vous devez déclarer vos ressources des mois d'août, septembre et octobre 2026.
Faites votre déclaration au plus tard le 15 novembre 2026 sur caf.fr ou sur l'application Caf - Mon Compte.
Sans déclaration, votre droit sera suspendu.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "CAF", organisme: "caf",
      date_document: null, date_limite: "2026-11-15", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "caf-date-sans-annee",
    texte: `Caisse d'Allocations Familiales du Nord
Lille, le 3 novembre 2026
N° allocataire : 5544332 D
Madame,
Votre dossier d'aide au logement est incomplet : il manque votre attestation de loyer.
Merci de nous la renvoyer avant le 27 novembre, depuis votre espace sur caf.fr.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "caf",
      date_document: "2026-11-03", date_limite: "2026-11-27", intention: "envoyer_document", a_traiter: true,
    },
  },
  {
    id: "cpam-releve-remboursements",
    texte: `l'Assurance Maladie
Relevé de vos remboursements
Paris, le 3 novembre 2026
N° de sécurité sociale : 2 85 07 75 123 456 78
Soins du 21/10/2026 - Consultation médecin généraliste
Montant de la dépense : 30,00 €
Montant remboursé : 20,00 €
Participation forfaitaire : 2,00 €
Montant versé : 18,00 € le 03/11/2026 sur votre compte.`,
    attendu: {
      type: "document_sante", dossier: "sante", emetteur: "Assurance Maladie", organisme: "cpam",
      date_document: "2026-11-03", montant: 18, sens: "a_recevoir", a_traiter: false, urgence: "aucune",
      infos: { "N° de sécurité sociale": "2850 •••• •••• 5678" },
    },
  },
  {
    id: "cpam-attestation-droits",
    texte: `ATTESTATION DE DROITS À L'ASSURANCE MALADIE
Caisse primaire d'assurance maladie des Hauts-de-Seine
Date d'édition : 12/10/2026
Bénéficiaire : Camille EXEMPLE
Droits ouverts du 01/01/2026 au 31/12/2026
Complémentaire santé solidaire : non
Ce document ne remplace pas votre carte Vitale.`,
    attendu: {
      type: "document_sante", dossier: "sante", emetteur: "Assurance Maladie", organisme: "cpam",
      date_document: "2026-10-12", date_limite: null, montant: null, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "cpam-pieces-css",
    texte: `Assurance Maladie
CPAM du Val-de-Marne
Créteil, le 6 novembre 2026
Objet : votre demande de Complémentaire santé solidaire
Madame, Monsieur,
Votre dossier est incomplet. Pour que nous puissions l'étudier, merci de nous retourner les pièces justificatives suivantes avant le 1er décembre 2026 :
- votre avis d'impôt 2026 ;
- les justificatifs de vos ressources des 12 derniers mois.
Vous pouvez aussi les déposer dans votre compte ameli.`,
    attendu: {
      type: "courrier_administratif", dossier: "sante", emetteur: "Assurance Maladie", organisme: "cpam",
      date_document: "2026-11-06", date_limite: "2026-12-01", intention: "envoyer_document", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "cpam-indemnites-journalieres",
    texte: `Assurance Maladie
Paiement de vos indemnités journalières
Date : 30/10/2026
Arrêt de travail du 05/10/2026 au 25/10/2026
Nombre de jours indemnisés : 18
Montant journalier : 42,17 €
Montant versé : 759,06 €
Ce paiement a été effectué sur votre compte le 30/10/2026.`,
    attendu: {
      type: "document_sante", dossier: "sante", organisme: "cpam", date_document: "2026-10-30",
      montant: 759.06, sens: "a_recevoir", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "cpam-relance-suspension",
    texte: `Assurance Maladie
Dernier rappel
Nous n'avons pas reçu le formulaire demandé. Merci de nous le retourner au plus tard le 20/11/2026.
À défaut, vos indemnités seront suspendues.`,
    attendu: {
      type: "courrier_administratif", dossier: "sante", organisme: "cpam", date_limite: "2026-11-20",
      intention: "relance", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "mutuelle-decompte",
    texte: `MUTUELLE DES ARTISANS EXEMPLE
Décompte de remboursement
N° d'adhérent : 00451287
Date : 04/11/2026
Bénéficiaire : Camille EXEMPLE
Pharmacie du 28/10/2026 - Dépense 45,30 € - Remboursé Sécurité sociale 27,18 € - Remboursé mutuelle 18,12 €
Total remboursé par votre complémentaire santé : 18,12 €
Virement effectué le 04/11/2026.`,
    attendu: {
      type: "document_sante", dossier: "sante", emetteur: "Mutuelle des Artisans Exemple", organisme: null,
      date_document: "2026-11-04", montant: 18.12, sens: "a_recevoir", a_traiter: false,
      infos: { "N° d'adhérent": "00451287" },
    },
  },
  {
    id: "francetravail-convocation",
    texte: `France Travail
Agence de Montreuil
Montreuil, le 9 novembre 2026
Identifiant : 1234567A
Objet : convocation
Monsieur,
Vous êtes convoqué à un entretien avec votre conseiller le mercredi 18 novembre 2026 à 14 h 30.
Lieu : agence France Travail, 12 avenue de la République, 93100 Montreuil.
Cet entretien est obligatoire. Si vous ne vous présentez pas sans motif légitime, vous risquez d'être radié de la liste des demandeurs d'emploi.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", emetteur: "France Travail", organisme: "francetravail",
      date_document: "2026-11-09", date_limite: "2026-11-18", intention: "rdv", a_traiter: true, urgence: "moyenne",
      infos: { Identifiant: "1234567A" },
    },
  },
  {
    id: "francetravail-notification-are",
    texte: `France Travail
Notification de décision
Le 20/10/2026
Madame,
Nous avons le plaisir de vous informer que votre demande d'allocation d'aide au retour à l'emploi (ARE) est acceptée.
Vos droits sont ouverts à compter du 15/10/2026 pour une durée de 548 jours.
Montant journalier brut de votre allocation : 38,52 €.
Votre allocation sera versée chaque mois après votre actualisation.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", organisme: "francetravail", date_document: "2026-10-20",
      date_limite: null, montant: 38.52, sens: "a_recevoir", intention: "droits", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "francetravail-actualisation-entre-le",
    texte: `France Travail
Rappel : actualisation
Bonjour,
Votre actualisation pour le mois d'octobre est ouverte.
Pensez à vous actualiser entre le 28/10/2026 et le 15/11/2026 sur francetravail.fr ou sur l'application.
Sans actualisation, votre inscription sera annulée et vos allocations ne seront pas versées.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", organisme: "francetravail",
      date_limite: "2026-11-15", a_traiter: true, urgence: "moyenne",
    },
  },
  {
    id: "francetravail-trop-percu",
    texte: `France Travail
Le 02/11/2026
Objet : trop-perçu d'allocations
Madame,
Après examen de votre dossier, il apparaît que vous avez perçu à tort des allocations pour la période du 01/08/2026 au 31/08/2026, suite à une reprise d'activité non déclarée.
Le montant du trop-perçu s'élève à 1 156,20 €.
Vous pouvez rembourser cette somme en une fois ou demander un échéancier. Vous pouvez aussi contester cette décision dans un délai de 2 mois à compter de sa notification.`,
    attendu: {
      type: "courrier_administratif", dossier: "travail", organisme: "francetravail", date_document: "2026-11-02",
      date_limite: "2027-01-02", montant: 1156.2, sens: "a_payer", intention: "indu", a_traiter: true,
    },
  },
  {
    id: "urssaf-declaration-ca",
    texte: `Urssaf
Votre déclaration de chiffre d'affaires
Le 01/11/2026
N° SIRET : 123 456 789 00012
Madame, Monsieur,
Votre déclaration de chiffre d'affaires du mois d'octobre 2026 est à effectuer au plus tard le 30/11/2026 sur autoentrepreneur.urssaf.fr.
Les cotisations correspondantes seront prélevées sur votre compte.
Même en l'absence de chiffre d'affaires, vous devez déclarer un montant de 0 €.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "Urssaf", organisme: "urssaf",
      date_document: "2026-11-01", date_limite: "2026-11-30", a_traiter: true, urgence: "faible",
      infos: { SIRET: "12345678900012" },
    },
  },
  {
    id: "urssaf-mise-en-demeure",
    texte: `URSSAF Île-de-France
MISE EN DEMEURE
Lettre recommandée avec accusé de réception
Montreuil, le 3 novembre 2026
Madame, Monsieur,
Malgré nos précédents courriers, nous n'avons pas reçu le paiement de vos cotisations du 2e trimestre 2026.
Nous vous mettons en demeure de régler la somme de 1 874,00 €, majorations comprises, dans un délai d'un mois à compter de la réception de la présente.
À défaut, nous engagerons des poursuites sans nouvel avis.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", organisme: "urssaf", date_document: "2026-11-03",
      date_limite: "2026-12-03", montant: 1874, sens: "a_payer", intention: "relance", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "msa-appel-cotisations",
    texte: `MSA Auvergne
Mutualité Sociale Agricole
Appel de cotisations 2026
Date d'émission : 15/10/2026
Montant total à payer : 2 340,00 €
Date limite de paiement : 01/12/2026
Paiement en ligne sur msa.fr`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "MSA", organisme: "msa",
      date_document: "2026-10-15", date_limite: "2026-12-01", montant: 2340, sens: "a_payer",
      intention: "payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "retraite-releve-carriere",
    texte: `L'Assurance retraite
Île-de-France
Le 15 octobre 2026
Votre relevé de situation individuelle
Madame,
Vous trouverez ci-joint votre relevé de carrière, qui récapitule les trimestres et les salaires enregistrés à votre compte.
Vérifiez-le attentivement. Si une période manque, vous pouvez demander sa régularisation en ligne sur lassuranceretraite.fr.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "Assurance retraite", organisme: "retraite",
      date_document: "2026-10-15", date_limite: null, intention: "info", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "prefecture-recepisse",
    texte: `PRÉFECTURE DE POLICE
RÉCÉPISSÉ DE DEMANDE DE CARTE DE SÉJOUR
Délivré le : 18/08/2026
Nom : EXEMPLE
Prénoms : Samir
Nationalité : marocaine
Ce récépissé autorise son titulaire à séjourner en France.
Valable jusqu'au : 17/02/2027
Il autorise son titulaire à travailler.`,
    attendu: {
      type: "titre_de_sejour", dossier: "identite", organisme: "prefecture", date_document: "2026-08-18",
      date_expiration: "2027-02-17", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "prefecture-titre-a-retirer",
    texte: `Préfecture du Val-d'Oise
Direction des migrations et de l'intégration
Cergy, le 30 octobre 2026
Madame, Monsieur,
Nous vous informons que votre titre de séjour est disponible.
Vous pouvez venir le retirer au guichet de la préfecture, sur rendez-vous, avant le 10 décembre 2026.
Merci de vous munir de votre récépissé, de votre passeport et du timbre fiscal de 225 €.
Passé ce délai, votre titre pourra être détruit.`,
    attendu: {
      type: "courrier_administratif", dossier: "identite", emetteur: "Préfecture", organisme: "prefecture",
      date_document: "2026-10-30", date_limite: "2026-12-10", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "mairie-passeport-disponible",
    texte: `Mairie de Montreuil
Service Population - Titres d'identité
Le 27/10/2026
Madame,
Votre passeport est disponible à l'accueil de l'Hôtel de Ville.
Vous devez venir le retirer en personne dans un délai de 3 mois. Passé ce délai, il sera détruit.
Horaires : du lundi au vendredi de 8 h 30 à 17 h.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "Mairie", organisme: "mairie",
      date_document: "2026-10-27", date_limite: "2027-01-27", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "commissaire-justice-commandement",
    texte: `SELARL EXEMPLE & ASSOCIÉS
Commissaires de justice associés
12 rue des Lilas 69003 Lyon
COMMANDEMENT DE PAYER
Lyon, le 5 novembre 2026
À la requête de la SA HLM Exemple Habitat,
Je vous fais commandement de payer dans un délai de huit jours la somme de 2 345,67 € correspondant aux loyers impayés, frais en sus.
À défaut de paiement dans ce délai, vous pourrez y être contraint par toutes voies de droit, et notamment par la saisie de vos biens.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "Commissaire de justice", organisme: "justice",
      date_document: "2026-11-05", date_limite: "2026-11-13", montant: 2345.67, sens: "a_payer",
      a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "tribunal-convocation-audience",
    texte: `TRIBUNAL JUDICIAIRE DE BOBIGNY
Greffe - Pôle civil de proximité
CONVOCATION À L'AUDIENCE
Bobigny, le 2 novembre 2026
Madame,
Vous êtes convoquée à l'audience du jeudi 3 décembre 2026 à 9 h 00, salle 4, au tribunal judiciaire de Bobigny, 173 avenue Paul Vaillant-Couturier.
Affaire : SA Exemple Crédit contre Madame EXEMPLE - injonction de payer.
Vous pouvez vous faire assister par un avocat.
En cas d'absence, une décision pourra être rendue sur les seuls éléments fournis par l'autre partie.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "Tribunal", organisme: "tribunal",
      date_document: "2026-11-02", date_limite: "2026-12-03", intention: "rdv", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "laposte-avis-de-passage",
    texte: `La Poste
AVIS DE PASSAGE
Nous sommes passés le 07/11/2026 à 11 h 20 pour vous remettre une lettre recommandée.
Vous étiez absent(e).
Votre lettre est disponible dans votre bureau de poste à partir du 09/11/2026 et jusqu'au 23/11/2026.
Munissez-vous de cet avis et d'une pièce d'identité.
Passé ce délai, le courrier sera renvoyé à l'expéditeur.`,
    attendu: {
      type: "courrier_administratif", dossier: "administratif", emetteur: "La Poste", organisme: "laposte",
      date_document: "2026-11-07", date_limite: "2026-11-23", a_traiter: true, urgence: "faible",
    },
  },
];
