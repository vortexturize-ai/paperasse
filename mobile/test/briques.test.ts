import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import { findAmounts, mainAmount, parseAmount } from "../src/engine/amounts.ts";
import { addDuration, findDates, findDurations, isValidDate } from "../src/engine/dates.ts";
import { detectIssuer, guessSender, ISSUERS, titleCase } from "../src/engine/issuers.ts";
import { parseMrz } from "../src/engine/mrz.ts";
import { cleanText, fold, hasAny, sentenceAt } from "../src/engine/normalize.ts";
import { findReferences } from "../src/engine/references.ts";
import { ENTETES, FORMATS_DATE } from "./corpus/familles.ts";
import { TODAY } from "./outils/fiche.ts";
import { td1, td3 } from "./outils/mrz.ts";

const fr = { today: TODAY, language: "fr" as const };
const dates = (s: string) => findDates(fold(cleanText(s))).map((d) => d.iso);

describe("dates", () => {
  const MOIS = [
    ["janvier", "janv.", "jan"], ["février", "févr.", "fev"], ["mars", "mars", "mar"], ["avril", "avr.", "avr"],
    ["mai", "mai", "mai"], ["juin", "juin", "juin"], ["juillet", "juil.", "juil"], ["août", "août", "aout"],
    ["septembre", "sept.", "sep"], ["octobre", "oct.", "oct"], ["novembre", "nov.", "nov"], ["décembre", "déc.", "dec"],
  ];
  for (const [i, [long, abr, court]] of MOIS.entries()) {
    test(`mois ${i + 1} : « ${long} », « ${abr} », « ${court} », majuscules`, () => {
      const iso = `2026-${String(i + 1).padStart(2, "0")}-12`;
      for (const m of [long, abr, court, long.toUpperCase()]) assert.deepEqual(dates(`le 12 ${m} 2026`), [iso], m);
    });
  }
  for (const [nom, f] of FORMATS_DATE) {
    test(`format ${nom}`, () => {
      for (const iso of ["2026-01-01", "2026-02-28", "2027-12-31", "2026-07-14"]) assert.deepEqual(dates(`Avant le ${f(iso)}, merci.`), [iso], f(iso));
    });
  }
  test("années bissextiles", () => {
    assert.deepEqual(dates("29/02/2028"), ["2028-02-29"]);
    assert.deepEqual(dates("29/02/2027"), []);
    assert.deepEqual(dates("29/02/2000"), ["2000-02-29"]);
    assert.deepEqual(dates("29/02/2100"), []);
    assert.equal(isValidDate(2024, 2, 29), true);
  });
  test("dates impossibles refusées", () => {
    for (const s of ["31/04/2026", "00/12/2026", "12/13/2026", "32/01/2026", "31 juin 2026", "0 mai 2026", "15/12/1850", "15/12/2150"]) assert.deepEqual(dates(s), [], s);
  });
  test("le 1er du mois", () => {
    assert.deepEqual(dates("le 1er mars 2027 et le 1 er avril 2027"), ["2027-03-01", "2027-04-01"]);
  });
  test("pas de date dans les numéros de téléphone, montants, références, heures", () => {
    for (const s of ["01 23 45 67 89", "0 811 10 10 10", "12,10 €", "N° 2026-10-48213", "à 14h30", "13,42 / 20", "IDCC 1518", "2026-2027", "v1.2.3"]) {
      assert.deepEqual(dates(s), [], s);
    }
  });
  test("date coupée par une fin de ligne", () => {
    assert.deepEqual(dates("avant le 15\ndécembre 2026"), ["2026-12-15"]);
  });
});

describe("délais relatifs", () => {
  const cas: [string, number, string][] = [
    ["dans un délai de 15 jours", 15, "jour"], ["sous deux mois", 2, "mois"], ["dans les 8 jours", 8, "jour"],
    ["sous huitaine", 8, "jour"], ["sous quinzaine", 15, "jour"], ["dans un délai d'un mois", 1, "mois"],
    ["dans un délai d'une semaine", 1, "semaine"], ["sous 3 semaines", 3, "semaine"], ["d'ici 10 jours", 10, "jour"],
    ["dans un délai de trente jours", 30, "jour"], ["sous 48 heures", 2, "jour"], ["sous 72 h", 3, "jour"],
    ["dans un délai de 1 an", 1, "an"], ["dans un délai de quarante-cinq jours", 45, "jour"],
  ];
  for (const [s, n, u] of cas) {
    test(`« ${s} »`, () => {
      const d = findDurations(fold(s));
      assert.deepEqual(d.map((x) => [x.amount, x.unit]), [[n, u]]);
    });
  }
  test("pas un délai : durée du contrat, posologie, ancienneté", () => {
    for (const s of ["pendant 6 jours", "pour une durée de 548 jours", "depuis 3 mois", "il y a 2 ans", "contrat de 12 mois", "valable 30 jours"]) {
      assert.deepEqual(findDurations(fold(s)), [], s);
    }
  });
  test("calendrier : fins de mois et changements d'année", () => {
    assert.equal(addDuration("2026-01-31", 1, "mois"), "2026-03-03");
    assert.equal(addDuration("2026-12-20", 15, "jour"), "2027-01-04");
    assert.equal(addDuration("2028-02-29", 1, "an"), "2029-03-01");
    assert.equal(addDuration("2026-11-02", 3, "semaine"), "2026-11-23");
  });
});

describe("montants", () => {
  test("écritures françaises et étrangères", () => {
    const cas: [string, number][] = [
      ["1 234,56", 1234.56], ["1.234,56", 1234.56], ["1234,56", 1234.56], ["1234.56", 1234.56], ["612", 612],
      ["0,99", 0.99], ["12 500", 12500], ["12.500", 12500], ["1 000 000,00", 1000000], ["35,5", 35.5],
    ];
    for (const [s, v] of cas) assert.equal(parseAmount(s), v, s);
  });
  test("chaque écriture est trouvée dans une phrase", () => {
    const cas: [string, number][] = [
      ["Total : 1 234,56 €", 1234.56], ["Total : 1234,56€", 1234.56], ["Total : EUR 35,00", 35], ["Total : € 12,50", 12.5],
      ["Total : 35 euros", 35], ["Total : 35,- €", 35], ["Total : 12 500 EUR", 12500], ["Total : 1 234,56 €", 1234.56],
    ];
    for (const [s, v] of cas) assert.deepEqual(findAmounts(fold(cleanText(s))).map((a) => a.value), [v], s);
  });
  test("l'année devant un montant ne s'y colle pas", () => {
    assert.deepEqual(findAmounts(fold("année 2026 612 €")).map((a) => a.value), [612]);
    assert.deepEqual(findAmounts(fold("en 2025 : 1 200 €")).map((a) => a.value), [1200]);
  });
  test("le capital social et les « dont TVA » ne sont jamais le montant principal", () => {
    assert.equal(mainAmount(fold("Société au capital de 1 000 000 €\nMontant TTC : 84,60 €"))?.value, 84.6);
    assert.equal(mainAmount(fold("Exemple SAS au capital de 50 000 €")), null);
  });
  test("sens du montant", () => {
    assert.equal(mainAmount(fold("Montant à payer : 120,00 €"))?.direction, "a_payer");
    assert.equal(mainAmount(fold("Vous allez recevoir 250,00 €"))?.direction, "a_recevoir");
    assert.equal(mainAmount(fold("Net à payer : 1 500,00 €"), true)?.direction, "a_recevoir");
    assert.equal(mainAmount(fold("Solde en votre faveur : 48,20 €"))?.direction, "a_recevoir");
    assert.equal(mainAmount(fold("Solde en notre faveur : 112,40 €"))?.direction, "a_payer");
    assert.equal(mainAmount(fold("Total remboursé par votre mutuelle : 18,12 €"))?.direction, "a_recevoir");
  });
});

describe("numéros et références", () => {
  const facts = (t: string) => Object.fromEntries(findReferences(cleanText(t), fold(cleanText(t))).map((f) => [f.label, f.valeur]));
  test("chaque numéro reconnu, valeur propre", () => {
    const f = facts(`N° allocataire : 1234567 X
Numéro fiscal : 12 34 567 890 123
Numéro de télépaiement : 1234 5678 9012 3456
N° de dossier : AB-2026-0042
Contrat n° 0123456789
Facture n° 1A2B3C4D5E du 05/11/2026
Référence client : 6 012 345 678
N° de sociétaire : 1234567 A
N° d'adhérent : 00451287
Identifiant : 1234567A
SIRET : 812 345 678 00027
Immatriculation : AB-123-CD`);
    assert.deepEqual(f, {
      "N° allocataire": "1234567 X",
      "Numéro fiscal": "12 34 567 890 123",
      "N° de télépaiement": "1234 5678 9012 3456",
      "N° de dossier": "AB-2026-0042",
      "N° de contrat": "0123456789",
      "N° client": "6 012 345 678",
      "N° de facture": "1A2B3C4D5E",
      "N° de sociétaire": "1234567 A",
      "N° d'adhérent": "00451287",
      Identifiant: "1234567A",
      SIRET: "81234567800027",
      Immatriculation: "AB-123-CD",
    });
  });
  test("un libellé sans numéro ne donne pas de fausse valeur", () => {
    const f = facts("Votre numéro de dossier vous sera communiqué prochainement.\nN° client : voir au dos");
    assert.equal(f["N° de dossier"], undefined);
    assert.equal(f["N° client"], undefined);
  });
  test("IBAN masqué, même lu en minuscules ou sans espaces", () => {
    for (const s of ["IBAN FR76 3000 6000 0112 3456 7890 189", "iban fr7630006000011234567890189"]) {
      assert.equal(facts(s).IBAN, "FR76 •••• •••• 0189", s);
    }
  });
});

describe("organismes", () => {
  test("chaque organisme connu a un en-tête de test", () => {
    for (const i of ISSUERS) assert.ok(ENTETES[i.id], i.id);
  });
  test("pièges : mots qui contiennent le nom d'un organisme", () => {
    const pieges = [
      "Nous avons pris un café ensemble.", "Amélie Exemple, 12 rue des Lilas", "travailleur transfrontalier",
      "Croissant croustillant", "Né au Liban", "Contact : jean.exemple@free.fr", "Mail : camille@orange.fr",
      "Edfa Exemple", "Les enfants de la classe", "Un antaillon", "La maison Gmfx", "Monsieur Axavier",
      "Voir notre agenda : semaine 12", "Le cafard du quartier",
    ];
    for (const s of pieges) assert.equal(detectIssuer(fold(s))?.issuer.id ?? null, null, s);
  });
  test("un organisme seulement cité comme destinataire n'est pas l'expéditeur", () => {
    assert.equal(detectIssuer(fold("Attestation destinée à France Travail"))?.issuer.id ?? null, null);
    assert.equal(detectIssuer(fold("Document à adresser à la CAF de Paris"))?.issuer.id ?? null, null);
  });
  test("l'en-tête compte plus que les mentions dans le corps", () => {
    const t = "Crédit Agricole Centre-Est\nRELEVÉ DE COMPTE\nCompte de dépôt n° 12345678901\nVIR CAF DE PARIS 245,32\nVIR CAF DE PARIS 37,00\nVIR CAF DE PARIS 12,00\nPRLV EDF 84,60";
    assert.equal(detectIssuer(fold(t))?.issuer.id, "ca");
  });
});

describe("nom de l'expéditeur", () => {
  test("casse soignée : petits mots, formes juridiques", () => {
    assert.equal(titleCase("BOULANGERIE DE LA GARE"), "Boulangerie de la Gare");
    assert.equal(titleCase("SAS EXEMPLE LOGISTIQUE"), "SAS Exemple Logistique");
    assert.equal(titleCase("EXEMPLE PLOMBERIE SARL"), "Exemple Plomberie SARL");
    assert.equal(titleCase("L'ATELIER D'ANNE"), "L'Atelier d'Anne");
    assert.equal(titleCase("Déjà En Casse Mixte"), "Déjà En Casse Mixte");
  });
  test("jamais un titre de document, une puce ou un bout de logo", () => {
    assert.equal(guessSender(["BULLETIN DE PAIE", "BOULANGERIE MARTIN"]), "Boulangerie Martin");
    assert.equal(guessSender(["AVIS DE TAXE FONCIÈRE", "2026"]), null);
    assert.equal(guessSender(["l l l", "@#%", "EXEMPLE SHOP"]), "Exemple Shop");
    assert.equal(guessSender(["Facture", "Madame, Monsieur,"]), null);
  });
  test("le libellé « Employeur : » ou « Bailleur : » donne le nom", () => {
    assert.equal(guessSender(["Bulletin de paie", "Employeur : Association Les Petits Pas"]), "Association Les Petits Pas");
  });
});

describe("indices : mots entiers, pas des bouts de mots", () => {
  test("« relevé » ne contient pas « élève », « devise » n'est pas un devis", () => {
    assert.equal(hasAny(fold("releve de compte"), ["eleve"]), false);
    const r = analyzeText("Opérations en devises\nRelevé de compte\nAncien solde : 100,00 €\nNouveau solde : 80,00 €", fr);
    assert.equal(r.type_document, "releve_bancaire");
  });
  test("une déclaration « saisie en ligne » n'est pas une saisie d'huissier", () => {
    const r = analyzeText("CAF\nVotre déclaration a bien été saisie le 02/11/2026.\nMerci d'envoyer votre justificatif avant le 30/11/2026.", fr);
    assert.notEqual(r.urgence, "haute");
  });
});

describe("phrase citée", () => {
  test("une phrase coupée sur deux lignes est recollée", () => {
    const t = "Madame,\nMerci de nous retourner le formulaire au plus\ntard le 20/11/2026 par courrier.\nCordialement";
    assert.equal(sentenceAt(t, t.indexOf("20/11")), "Merci de nous retourner le formulaire au plus tard le 20/11/2026 par courrier.");
  });
  test("le point d'une adresse web ne coupe pas la phrase (vu sur le téléphone)", () => {
    const t = "Merci de nous les envoyer dans un délai de 15 jours\nà compter de la date de ce courrier, sur caf.fr, rubrique\nMon Compte.\nSans réponse";
    assert.equal(sentenceAt(t, t.indexOf("15 jours")), "Merci de nous les envoyer dans un délai de 15 jours à compter de la date de ce courrier, sur caf.fr, rubrique Mon Compte.");
  });
  test("une ligne « libellé : valeur » reste seule", () => {
    const t = "Montant à payer : 612,00 €\nDate limite de paiement : 15/12/2026\nVous pouvez payer en ligne";
    assert.equal(sentenceAt(t, t.indexOf("15/12")), "Date limite de paiement : 15/12/2026");
  });
});

describe("bandes MRZ", () => {
  test("lettres confondues par la caméra dans les dates (O pour 0)", () => {
    const l = td3({ code: "P<", pays: "FRA", numero: "19AB12345", naissance: "1990-01-30", sexe: "M", expiration: "2030-10-05", nationalite: "FRA", nom: "EXEMPLE", prenoms: ["LEO"] });
    const abime = [l[0], l[1].slice(0, 21) + l[1].slice(21, 27).replace(/0/g, "O") + l[1].slice(27)];
    assert.equal(parseMrz(abime, 2026)?.expiryDate, "2030-10-05");
  });
  test("espaces et guillemets lus dans la bande", () => {
    const l = td1({ code: "ID", pays: "FRA", numero: "X4RTBPFW4", naissance: "1992-06-14", sexe: "F", expiration: "2031-03-02", nationalite: "FRA", nom: "MARTIN", prenoms: ["CAMILLE"] });
    const abime = l.map((x) => x.replace(/<<</, "« <").replace(/(.{10})/, "$1 "));
    assert.equal(parseMrz(abime, 2026)?.expiryDate, "2031-03-02");
  });
  test("un chiffre de contrôle faux : pas de date d'expiration inventée, avertissement", () => {
    const l = td1({ code: "ID", pays: "FRA", numero: "X4RTBPFW4", naissance: "1992-06-14", sexe: "F", expiration: "2031-03-02", nationalite: "FRA", nom: "MARTIN", prenoms: ["CAMILLE"] });
    const abime = [l[0], l[1].replace("310302", "310303"), l[2]];
    const r = analyzeText(abime.join("\n"), fr);
    assert.equal(r.date_expiration, null);
    assert.ok(r.avertissement);
  });
});
