import { ISSUERS } from "../../src/engine/issuers.ts";
import type { Papier } from "../outils/fiche.ts";
import { TODAY } from "../outils/fiche.ts";
import { choisir, entier, hasard } from "../outils/bruit.ts";
import { td1, td3, type Identite } from "../outils/mrz.ts";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ABR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const p2 = (n: number) => String(n).padStart(2, "0");

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

export function plusJours(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function plusMois(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
}

export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Toutes les façons courantes d'écrire une date sur un courrier français. */
export const FORMATS_DATE: [string, (iso: string) => string][] = [
  ["jj/mm/aaaa", (iso) => { const [y, m, d] = parts(iso); return `${p2(d)}/${p2(m)}/${y}`; }],
  ["jj.mm.aaaa", (iso) => { const [y, m, d] = parts(iso); return `${p2(d)}.${p2(m)}.${y}`; }],
  ["jj-mm-aaaa", (iso) => { const [y, m, d] = parts(iso); return `${p2(d)}-${p2(m)}-${y}`; }],
  ["jj/mm/aa", (iso) => { const [y, m, d] = parts(iso); return `${p2(d)}/${p2(m)}/${String(y).slice(2)}`; }],
  ["j/m/aaaa", (iso) => { const [y, m, d] = parts(iso); return `${d}/${m}/${y}`; }],
  ["en lettres", (iso) => { const [y, m, d] = parts(iso); return `${d === 1 ? "1er" : d} ${MOIS[m - 1]} ${y}`; }],
  ["abrégé", (iso) => { const [y, m, d] = parts(iso); return `${d} ${ABR[m - 1]} ${y}`; }],
  ["avec le jour", (iso) => { const [y, m, d] = parts(iso); return `${JOURS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MOIS[m - 1]} ${y}`; }],
  ["majuscules", (iso) => { const [y, m, d] = parts(iso); return `${d} ${MOIS[m - 1].toUpperCase()} ${y}`; }],
  ["iso", (iso) => iso],
];

const PHRASES_LIMITE: ((d: string) => string)[] = [
  (d) => `Merci de régler cette somme avant le ${d}.`,
  (d) => `Date limite de paiement : ${d}`,
  (d) => `À payer au plus tard le ${d}.`,
  (d) => `Montant à régler avant le ${d}`,
  (d) => `Document à retourner avant le ${d}.`,
  (d) => `Somme exigible le ${d}.`,
  (d) => `Date d'échéance : ${d}`,
  (d) => `Vous devez nous répondre au plus tard le ${d}.`,
  (d) => `Merci de nous répondre le ${d} au plus tard.`,
];

/** Date limite écrite : 4 dates × 10 formats × 9 formulations, avec des dates pièges autour. */
export function familleDatesLimites(): Papier[] {
  const out: Papier[] = [];
  const limites = ["2026-12-15", "2026-12-01", "2027-01-08", "2026-11-20"];
  for (const limite of limites) {
    for (const [nomFormat, f] of FORMATS_DATE) {
      PHRASES_LIMITE.forEach((phrase, i) => {
        out.push({
          id: `limite ${limite} · ${nomFormat} · formulation ${i + 1}`,
          texte: `SOCIÉTÉ EXEMPLE SERVICES
Paris, le 2 novembre 2026
Client n° 123456
Madame, Monsieur,
Notre facture n° 2026-118 du 15/10/2026 concerne votre contrat souscrit par M. Exemple, né le 03/04/1985.
Montant à payer : 120,00 €
${phrase(f(limite))}
Votre prochaine facture sera établie le 20/01/2027.`,
          attendu: { type: "facture", dossier: "factures", date_limite: limite, date_document: "2026-11-02" },
        });
      });
    }
  }
  return out;
}

const DELAIS: [string, (base: string) => string][] = [
  ["dans un délai de 15 jours", (b) => plusJours(b, 15)],
  ["sous 8 jours", (b) => plusJours(b, 8)],
  ["dans les 30 jours", (b) => plusJours(b, 30)],
  ["sous huitaine", (b) => plusJours(b, 8)],
  ["sous quinzaine", (b) => plusJours(b, 15)],
  ["dans un délai de deux mois", (b) => plusMois(b, 2)],
  ["dans un délai d'un mois", (b) => plusMois(b, 1)],
  ["sous 3 semaines", (b) => plusJours(b, 21)],
  ["dans un délai de quinze jours", (b) => plusJours(b, 15)],
  ["d'ici 10 jours", (b) => plusJours(b, 10)],
  ["dans un délai de 45 jours", (b) => plusJours(b, 45)],
  ["sous 48 heures", (b) => plusJours(b, 2)],
  ["dans un délai de trente jours", (b) => plusJours(b, 30)],
];

const LIGNES_DATE: [string, string | null][] = [
  ["Paris, le 2 novembre 2026", "2026-11-02"],
  ["Le 02/11/2026", "2026-11-02"],
  ["Date : 02/11/2026", "2026-11-02"],
  ["Date d'envoi : 02/11/2026", "2026-11-02"],
  ["Courrier du 2 novembre 2026", "2026-11-02"],
  ["", null], // pas de date : le délai court à partir d'aujourd'hui
];

/** Délai relatif : 13 formulations × 6 façons de dater le courrier. */
export function familleDelais(): Papier[] {
  const out: Papier[] = [];
  for (const [delai, calc] of DELAIS) {
    for (const [ligne, iso] of LIGNES_DATE) {
      out.push({
        id: `« ${delai} » · ${ligne || "sans date"}`,
        texte: `EXEMPLE ASSURANCES
${ligne}
Madame,
Votre dossier est incomplet. Merci de nous adresser votre relevé d'identité bancaire ${delai}.
Nous vous prions d'agréer nos salutations distinguées.`.replace("\n\n", "\n"),
        attendu: {
          type: "courrier_administratif", dossier: "administratif", date_document: iso,
          date_limite: calc(iso ?? TODAY), intention: "envoyer_document", a_traiter: true,
        },
      });
    }
  }
  return out;
}

const NBSP = " ";
const NNBSP = " ";

/** Montants : valeur → écritures possibles. */
export const FORMATS_MONTANT: [number, string[]][] = [
  [1234.56, ["1 234,56 €", "1234,56 €", "1 234,56€", "1.234,56 €", "1 234,56 EUR", "EUR 1 234,56", "€ 1 234,56", "1 234,56 euros", "1234.56 €", `1${NBSP}234,56 €`, `1${NNBSP}234,56${NNBSP}€`, "€1 234,56"]],
  [35, ["35 €", "35,00 €", "35€", "35 euros", "35,00 EUR", "EUR 35,00", "35,- €"]],
  [12500, ["12 500,00 €", "12.500,00 €", "12 500 €", "12500 EUR"]],
  [0.99, ["0,99 €"]],
];

const CUES_PAYER = [
  (a: string) => `Montant à payer : ${a}`,
  (a: string) => `Total à payer : ${a}`,
  (a: string) => `Reste à payer : ${a}`,
  (a: string) => `Somme à régler : ${a}`,
  (a: string) => `Montant dû : ${a}`,
  (a: string) => `Vous devez la somme de ${a}.`,
  (a: string) => `Solde à régler : ${a}`,
  (a: string) => `Montant restant dû : ${a}`,
];
const CUES_RECEVOIR = [
  (a: string) => `Vous allez recevoir ${a}.`,
  (a: string) => `Montant de votre aide : ${a}`,
  (a: string) => `Somme qui vous sera remboursée : ${a}`,
  (a: string) => `Montant versé : ${a}`,
  (a: string) => `Solde en votre faveur : ${a}`,
  (a: string) => `Nous vous versons ${a} chaque mois.`,
];

/** Montant principal et sens : écritures × formulations, avec des montants pièges autour. */
export function familleMontants(): Papier[] {
  const out: Papier[] = [];
  for (const [valeur, ecritures] of FORMATS_MONTANT) {
    for (const ecriture of ecritures) {
      for (const [sens, cues] of [["a_payer", CUES_PAYER], ["a_recevoir", CUES_RECEVOIR]] as const) {
        cues.forEach((cue, i) => {
          out.push({
            id: `${ecriture} · ${sens} ${i + 1}`,
            texte: `EXEMPLE SERVICES
Le 02/11/2026
Ancien solde : 12,00 €
${cue(ecriture)}
Frais de dossier offerts (valeur 25 €).
Exemple SAS au capital de 50 000 € - RCS Lyon 123 456 789`,
            attendu: { montant: valeur, sens }, // le type n'est pas l'objet de cette famille
          });
        });
      }
    }
  }
  return out;
}

/** En-tête réaliste de chaque organisme connu. Ajouter un organisme au moteur oblige à l'ajouter ici. */
export const ENTETES: Record<string, string> = {
  caf: "Caisse d'Allocations Familiales du Rhône",
  cpam: "Caisse primaire d'assurance maladie de Paris",
  dgfip: "Direction générale des Finances publiques",
  antai: "Agence nationale de traitement automatisé des infractions",
  amendes: "Centre d'encaissement des amendes",
  francetravail: "France Travail - Agence de Lyon",
  urssaf: "Urssaf Rhône-Alpes",
  msa: "MSA - Mutualité Sociale Agricole",
  retraite: "L'Assurance retraite",
  ants: "Agence nationale des titres sécurisés",
  prefecture: "Préfecture du Rhône",
  mairie: "Mairie de Villeurbanne",
  laposte: "La Poste",
  edf: "EDF",
  engie: "ENGIE",
  totalenergies: "TotalEnergies",
  orange: "Orange SA",
  sfr: "SFR",
  bouygues: "Bouygues Telecom",
  free: "Free Mobile",
  veolia: "Veolia Eau",
  suez: "SUEZ Eau France",
  banquepostale: "La Banque Postale",
  ca: "Crédit Agricole Centre-Est",
  bnp: "BNP Paribas",
  sg: "Société Générale",
  ce: "Caisse d'Épargne Rhône Alpes",
  lcl: "LCL - Le Crédit Lyonnais",
  cm: "Crédit Mutuel",
  bp: "Banque Populaire Auvergne Rhône Alpes",
  axa: "AXA France",
  maif: "MAIF",
  macif: "MACIF",
  matmut: "Matmut",
  allianz: "Allianz",
  groupama: "Groupama Rhône-Alpes Auvergne",
  gmf: "GMF Assurances",
  justice: "Étude de Maître Exemple, commissaire de justice",
  tribunal: "Tribunal judiciaire de Lyon",
  education: "Académie de Lyon",
  crous: "Crous de Lyon",
  mdph: "Maison départementale des personnes handicapées du Rhône",
};

/** Chaque organisme connu, en en-tête d'un courrier d'information, en casse normale et en majuscules. */
export function familleOrganismes(): Papier[] {
  const out: Papier[] = [];
  for (const issuer of ISSUERS) {
    const entete = ENTETES[issuer.id];
    if (!entete) throw new Error(`En-tête de test manquant pour l'organisme « ${issuer.id} » (test/corpus/familles.ts)`);
    for (const casse of ["normale", "majuscules"] as const) {
      const head = casse === "majuscules" ? entete.toUpperCase() : entete;
      out.push({
        id: `${issuer.id} · ${casse}`,
        texte: `${head}
Le 02/11/2026
Madame, Monsieur,
Nous vous informons que votre dossier a bien été mis à jour.
Aucune démarche n'est nécessaire de votre part.`,
        attendu: {
          type: "courrier_administratif", dossier: issuer.category, organisme: issuer.id, emetteur: issuer.name,
          a_traiter: false, urgence: "aucune",
        },
      });
    }
  }
  return out;
}

const EMPLOYEURS: [string, string][] = [
  ["BOULANGERIE MARTIN", "Boulangerie Martin"],
  ["SAS EXEMPLE LOGISTIQUE", "SAS Exemple Logistique"],
  ["Association Les Petits Pas", "Association Les Petits Pas"],
  ["SARL LE BON GOÛT", "SARL Le Bon Goût"],
  ["EXEMPLE INTERIM SAS", "Exemple Interim SAS"],
  ["CLINIQUE DU PARC", "Clinique du Parc"],
];

/** Fiches de paie : 6 employeurs × 3 mises en page × 10 mois. */
export function famillePaie(): Papier[] {
  const out: Papier[] = [];
  const rnd = hasard(42);
  for (const [brut, nom] of EMPLOYEURS) {
    for (let mois = 1; mois <= 10; mois++) {
      const fin = new Date(Date.UTC(2026, mois, 0)).getUTCDate();
      const net = Math.round((1400 + rnd() * 1800) * 100) / 100;
      const brutSal = Math.round(net * 1.29 * 100) / 100;
      const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const layouts = [
        `${brut}\nBULLETIN DE PAIE\nPériode du 01/${p2(mois)}/2026 au ${fin}/${p2(mois)}/2026\nSalaire brut ${fr(brutSal)}\nCotisations salariales ${fr(brutSal - net)}\nNet à payer avant impôt sur le revenu ${fr(net)}\nNet payé ${fr(net)} €`,
        `${brut}\n12 rue Exemple 69001 Lyon\nBULLETIN DE SALAIRE\nPériode : 01/${p2(mois)}/2026 - ${fin}/${p2(mois)}/2026\nSALAIRE BRUT ${fr(brutSal)}\nTotal des cotisations -${fr(brutSal - net)}\nNET À PAYER AU SALARIÉ ${fr(net)} €`,
        `Bulletin de paie\nEmployeur : ${brut}\nMois : ${MOIS[mois - 1]} 2026\nSalaire brut : ${fr(brutSal)}\nNet à payer avant impôt sur le revenu : ${fr(net)}\nNet payé : ${fr(net)}\nPayé le ${fin}/${p2(mois)}/2026 par virement`,
      ];
      layouts.forEach((texte, i) => {
        out.push({
          id: `${nom} · ${MOIS[mois - 1]} · mise en page ${i + 1}`,
          texte,
          attendu: {
            type: "fiche_de_paie", dossier: "travail", emetteur: nom, montant: net, sens: "a_recevoir",
            a_traiter: false, urgence: "aucune", resume: new RegExp(`${ABR[mois - 1].replace(".", "\\.")} 2026`),
          },
        });
      });
    }
  }
  return out;
}

const NOMS = ["MARTIN", "BERNARD", "DUBOIS", "THOMAS", "ROBERT", "N'DIAYE", "BEN AMAR", "NGUYEN", "DA SILVA", "MULLER"];
const PRENOMS = ["CAMILLE", "LEA", "KARIM", "SAMIR", "AMINATA", "JULIEN", "INES", "LUCAS", "MAI", "JOAO"];

/** Pièces d'identité : 60 bandes MRZ valides fabriquées au hasard (passeports, cartes, titres de séjour). */
export function familleMrz(): Papier[] {
  const out: Papier[] = [];
  const rnd = hasard(9303);
  const alnum = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  for (let i = 0; i < 60; i++) {
    const kind = choisir(rnd, ["passeport", "cni", "titre"] as const);
    const naissance = plusJours("1950-01-01", entier(rnd, 0, 365 * 55));
    const expiration = plusJours(TODAY, entier(rnd, -400, 3650));
    const identite: Identite = {
      code: kind === "passeport" ? "P<" : kind === "cni" ? "ID" : "IR",
      pays: "FRA",
      numero: Array.from({ length: 9 }, () => choisir(rnd, alnum.split(""))).join(""),
      naissance,
      sexe: choisir(rnd, ["M", "F"] as const),
      expiration,
      nationalite: kind === "titre" ? choisir(rnd, ["MAR", "DZA", "SEN", "TUN", "VNM"]) : "FRA",
      nom: choisir(rnd, NOMS).replace(/[ ']/g, "<"),
      prenoms: [choisir(rnd, PRENOMS)],
    };
    const lignes = kind === "passeport" ? td3(identite) : td1(identite);
    const jours = joursEntre(TODAY, expiration);
    const aFaire = jours <= 180;
    out.push({
      id: `${kind} n° ${identite.numero} · expire dans ${jours} j`,
      texte: `${kind === "passeport" ? "PASSEPORT" : kind === "cni" ? "CARTE NATIONALE D'IDENTITÉ" : "TITRE DE SÉJOUR"}\nRÉPUBLIQUE FRANÇAISE\n${lignes.join("\n")}`,
      attendu: {
        type: kind === "titre" ? "titre_de_sejour" : "piece_identite", dossier: "identite", date_expiration: expiration,
        a_traiter: aFaire, urgence: !aFaire ? "aucune" : jours < 0 ? "haute" : jours <= 60 ? "moyenne" : "faible",
        infos: { "N° du document": identite.numero },
      },
    });
  }
  return out;
}

export const FAMILLES: Record<string, () => Papier[]> = {
  "dates limites écrites": familleDatesLimites,
  "délais relatifs": familleDelais,
  "montants et sens": familleMontants,
  "organismes connus": familleOrganismes,
  "fiches de paie": famillePaie,
  "bandes MRZ": familleMrz,
};
