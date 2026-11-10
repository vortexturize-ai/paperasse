import type { Papier } from "../outils/fiche.ts";
import { td1, td3 } from "../outils/mrz.ts";

const cni2021 = td1({
  code: "ID", pays: "FRA", numero: "X4RTBPFW4", naissance: "1992-06-14", sexe: "F", expiration: "2031-03-02",
  nationalite: "FRA", nom: "MARTIN", prenoms: ["CAMILLE", "LOUISE"],
});
const passeportBientot = td3({
  code: "P<", pays: "FRA", numero: "19AB12345", naissance: "1988-01-30", sexe: "M", expiration: "2027-03-15",
  nationalite: "FRA", nom: "EXEMPLE", prenoms: ["KARIM"],
});
const titreSejour = td1({
  code: "IR", pays: "FRA", numero: "AB1234567", naissance: "1990-09-05", sexe: "M", expiration: "2026-12-19",
  nationalite: "MAR", nom: "EXEMPLE", prenoms: ["SAMIR"],
});

export const IDENTITE_ETUDES_SANTE: Papier[] = [
  {
    id: "cni-2021-mrz",
    texte: `RÉPUBLIQUE FRANÇAISE
CARTE NATIONALE D'IDENTITÉ / IDENTITY CARD
Nom / Surname : MARTIN
Prénoms / Given names : Camille, Louise
Sexe : F Nationalité : FRA
Date de naissance : 14 06 1992
Date d'expiration : 02 03 2031
${cni2021.join("\n")}`,
    attendu: {
      type: "piece_identite", dossier: "identite", date_expiration: "2031-03-02", a_traiter: false, urgence: "aucune",
      infos: { "N° du document": "X4RTBPFW4", Nom: "MARTIN CAMILLE LOUISE" },
    },
  },
  {
    id: "passeport-expire-bientot",
    texte: `PASSEPORT
RÉPUBLIQUE FRANÇAISE
Type P Code FRA
Nom : EXEMPLE
Prénoms : Karim
${passeportBientot.join("\n")}`,
    attendu: {
      type: "piece_identite", dossier: "identite", date_expiration: "2027-03-15", a_traiter: true, urgence: "faible",
      resume: /Passeport/, infos: { "N° du document": "19AB12345" },
    },
  },
  {
    id: "titre-sejour-expire-dans-40-jours",
    texte: `TITRE DE SÉJOUR
RÉPUBLIQUE FRANÇAISE
Carte de séjour temporaire - salarié
${titreSejour.join("\n")}`,
    attendu: { type: "titre_de_sejour", dossier: "identite", date_expiration: "2026-12-19", a_traiter: true, urgence: "moyenne" },
  },
  {
    id: "cni-norme-oaci",
    texte: `CARTE NATIONALE D'IDENTITÉ
I<UTOD231458907<<<<<<<<<<<<<<<
7408122F1204159UTO<<<<<<<<<<<6
ERIKSSON<<ANNA<MARIA<<<<<<<<<<`,
    attendu: { type: "piece_identite", dossier: "identite", date_expiration: "2012-04-15", a_traiter: true, urgence: "haute", resume: /expiré/ },
  },
  {
    id: "permis-de-conduire-europeen",
    texte: `PERMIS DE CONDUIRE
RÉPUBLIQUE FRANÇAISE
1. EXEMPLE
2. CAMILLE
3. 14.06.1992 LYON
4a. 20.09.2023 4c. PRÉFET DU RHÔNE
4b. 19.09.2038
5. 23AB12345
9. B`,
    attendu: {
      type: "permis_de_conduire", dossier: "identite", date_document: "2023-09-20", date_expiration: "2038-09-19",
      a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "carte-grise",
    texte: `CERTIFICAT D'IMMATRICULATION
A AB-123-CD
B 12/03/2019
I 05/06/2024
C.1 EXEMPLE CAMILLE
C.3 25 RUE DES FLEURS 31000 TOULOUSE
D.1 PEUGEOT
D.3 208
E VF3ABCDEF12345678
J.1 VP`,
    attendu: { type: "carte_grise", dossier: "vehicule", a_traiter: false, urgence: "aucune", infos: { Immatriculation: "AB-123-CD" } },
  },
  {
    id: "certificat-scolarite-lycee",
    texte: `ACADÉMIE DE LYON
Lycée Exemple - 12 rue de l'École 69007 Lyon
CERTIFICAT DE SCOLARITÉ
Année scolaire 2026-2027
Je soussigné, proviseur du lycée Exemple, certifie que l'élève Léo EXEMPLE, né le 03/02/2010, est inscrit en classe de première générale pour l'année scolaire 2026-2027.
Fait à Lyon, le 07/09/2026`,
    attendu: {
      type: "certificat_scolarite", dossier: "etudes", organisme: "education", date_document: "2026-09-07",
      a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "diplome-baccalaureat",
    texte: `RÉPUBLIQUE FRANÇAISE
MINISTÈRE DE L'ÉDUCATION NATIONALE
DIPLÔME DU BACCALAURÉAT GÉNÉRAL
Le diplôme du baccalauréat général est décerné à
Madame Inès EXEMPLE, née le 12/05/1998 à Marseille
au titre de la session 2016, avec la mention Assez bien.
Fait à Aix-Marseille, le 08/07/2016`,
    attendu: { type: "diplome", dossier: "etudes", date_document: "2016-07-08", a_traiter: false, urgence: "aucune" },
  },
  {
    id: "releve-de-notes-universite",
    texte: `UNIVERSITÉ EXEMPLE
Faculté des sciences
RELEVÉ DE NOTES
Année universitaire 2025-2026
Étudiant : Camille EXEMPLE - N° étudiant 21901234
Licence 2 Informatique
Semestre 3 : 13,42 / 20 - Admis
Semestre 4 : 12,10 / 20 - Admis
Résultat de l'année : Admis - Mention Assez bien
Crédits ECTS obtenus : 60`,
    attendu: { type: "diplome", dossier: "etudes", montant: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "crous-notification-bourse",
    texte: `Crous de Lyon
Notification définitive de bourse
Année universitaire 2026-2027
Le 15/09/2026
N° de dossier social étudiant : 2026-123456
Madame,
Vous bénéficiez d'une bourse sur critères sociaux, échelon 4.
Montant annuel : 3 978,00 €, versé en 10 mensualités de 397,80 €.
Les versements sont conditionnés à votre assiduité aux cours et aux examens.`,
    attendu: {
      type: "courrier_administratif", dossier: "etudes", emetteur: "Crous", organisme: "crous", date_document: "2026-09-15",
      intention: "droits", a_traiter: false, urgence: "aucune", infos: { "N° de dossier": "2026-123456" },
    },
  },
  {
    id: "ordonnance-medecin",
    texte: `Docteur Claire EXEMPLE
Médecin généraliste
RPPS 10101234567
12 avenue Jean Jaurès 69007 Lyon
Lyon, le 05/11/2026
Madame Camille EXEMPLE
Amoxicilline 1 g : 1 comprimé matin et soir pendant 6 jours
Paracétamol 1 g : 1 comprimé jusqu'à 3 fois par jour si douleur
Ordonnance à renouveler 0 fois.`,
    attendu: { type: "ordonnance", dossier: "sante", date_document: "2026-11-05", date_limite: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "compte-rendu-analyses-labo",
    texte: `LABORATOIRE DE BIOLOGIE MÉDICALE EXEMPLE
Compte rendu d'analyses
Prélevé le 02/11/2026 à 08 h 15
Patient : Camille EXEMPLE, née le 14/06/1992
Prescripteur : Dr Claire EXEMPLE
HÉMATOLOGIE
Hémoglobine 13,8 g/dL (12,0 - 16,0)
Leucocytes 6,2 G/L (4,0 - 10,0)
BIOCHIMIE
Glycémie à jeun 0,92 g/L (0,70 - 1,10)
Résultats validés le 03/11/2026 par le biologiste.`,
    attendu: { type: "document_sante", dossier: "sante", date_limite: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "publicite-magasin",
    texte: `OFFRE EXCLUSIVE
Profitez de -30 % sur toute la collection hiver
Du 10/11/2026 au 30/11/2026 dans votre magasin Exemple Mode
Sur présentation de ce bon.`,
    attendu: { type: "autre", dossier: "autre", montant: null, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "texte-presque-vide",
    texte: "x 12 ##",
    attendu: { type: "autre", dossier: "autre", a_traiter: false, urgence: "aucune" },
  },
];
