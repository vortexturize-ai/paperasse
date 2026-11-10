import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import { findAmounts, mainAmount, parseAmount } from "../src/engine/amounts.ts";
import { addDuration, findDates, findDurations } from "../src/engine/dates.ts";
import { checkDigit, parseMrz } from "../src/engine/mrz.ts";
import { cleanText, fold } from "../src/engine/normalize.ts";
import { findReferences, maskMiddle } from "../src/engine/references.ts";
import { writeReply } from "../src/engine/reply.ts";

const TODAY = "2026-11-09";
const fr = { today: TODAY, language: "fr" as const };

const CAF = `Caisse d'Allocations Familiales de Paris
N° allocataire : 1234567 X
Paris, le 6 novembre 2026
Madame, Monsieur,
Afin de poursuivre l'étude de vos droits à l'aide au logement, merci de nous faire parvenir votre attestation de loyer dans un délai de 15 jours.
Sans réponse de votre part, le versement de votre aide pourra être suspendu.
Vous pouvez envoyer ce document depuis votre espace Mon Compte sur caf.fr.`;

const TAXE = `DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES
AVIS DE TAXE FONCIÈRE 2026
Numéro fiscal : 12 34 567 890 123
Référence de l'avis : 26 75 123 456 789
Date d'établissement : 31/08/2026
Montant à payer : 612,00 €
Date limite de paiement : 15/12/2026
Vous pouvez payer en ligne sur impots.gouv.fr`;

const AMENDE = `ANTAI
AVIS DE CONTRAVENTION
Date d'envoi : 25/09/2026
Infraction : stationnement gênant
Montant de l'amende forfaitaire : 35 €
Numéro de télépaiement : 1234 5678 9012 3456
Paiement dans un délai de 45 jours à compter de la date d'envoi.`;

const PAIE = `BOULANGERIE MARTIN
BULLETIN DE PAIE
Période du 01/10/2026 au 31/10/2026
Salaire de base 1 801,80
Salaire brut 2 105,00
Cotisations salariales 462,82
Net à payer avant impôt sur le revenu 1 642,18
Net imposable 1 690,40
Net payé 1 642,18 €`;

const CONTRAT = `CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE
Entre la société Boulangerie Martin, ci-après l'employeur, et Madame Camille Exemple, ci-après le salarié.
La période d'essai est de deux mois.
Fait à Lyon, le 1er septembre 2025, en deux exemplaires.`;

// Exemples officiels de la norme OACI 9303 (chiffres de contrôle valides).
const CNI_TD1 = `CARTE NATIONALE D'IDENTITÉ
I<UTOD231458907<<<<<<<<<<<<<<<
7408122F1204159UTO<<<<<<<<<<<6
ERIKSSON<<ANNA<MARIA<<<<<<<<<<`;

const PASSPORT_TD3 = [
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
];

const EDF = `EDF
Facture du 02/11/2026
Montant TTC : 84,60 €
Ce montant sera prélevé le 20/11/2026 sur votre compte.`;

const RELANCE = `Assurance Maladie
Dernier rappel
Nous n'avons pas reçu le formulaire demandé. Merci de nous le retourner au plus tard le 20/11/2026.
À défaut, vos indemnités seront suspendues.`;

describe("dates", () => {
  test("formats numériques et en toutes lettres", () => {
    const f = fold("le 14/11/2026, le 1er décembre 2026, le 3 fevrier 2027, le 14 nov. 2026 et le 05.01.27");
    assert.deepEqual(findDates(f).map((d) => d.iso), ["2026-11-14", "2026-12-01", "2027-02-03", "2026-11-14", "2027-01-05"]);
  });
  test("date en fin de phrase", () => {
    assert.deepEqual(findDates(fold("au plus tard le 20/11/2026. Merci")).map((d) => d.iso), ["2026-11-20"]);
  });
  test("dates impossibles ignorées", () => {
    assert.deepEqual(findDates(fold("31/02/2026 et 32 janvier 2026")), []);
  });
  test("délais relatifs", () => {
    const d = findDurations(fold("dans un délai de 15 jours, sous deux mois, dans les 8 jours"));
    assert.deepEqual(d.map((x) => [x.amount, x.unit]), [[15, "jour"], [2, "mois"], [8, "jour"]]);
    assert.equal(addDuration("2026-01-31", 1, "mois"), "2026-03-03");
    assert.equal(addDuration("2026-09-25", 45, "jour"), "2026-11-09");
  });
});

describe("montants", () => {
  test("formats français", () => {
    assert.equal(parseAmount("1 234,56"), 1234.56);
    assert.equal(parseAmount("1.234,56"), 1234.56);
    assert.equal(parseAmount("612"), 612);
    assert.deepEqual(findAmounts(fold("total 1 234,56 € puis 35€ puis 612,00 EUR, € 12,50")).map((a) => a.value), [1234.56, 35, 612, 12.5]);
  });
  test("une année devant un montant n'est pas collée au montant", () => {
    assert.deepEqual(findAmounts(fold("année 2026 612 €")).map((a) => a.value), [612]);
  });
  test("sens du montant", () => {
    assert.equal(mainAmount(fold("Montant à payer : 120,00 €"))?.direction, "a_payer");
    assert.equal(mainAmount(fold("Vous allez recevoir 250,00 €"))?.direction, "a_recevoir");
    assert.equal(mainAmount(fold("Net à payer : 1 500,00 €"), true)?.direction, "a_recevoir");
  });
});

describe("références", () => {
  test("numéros utiles et masquage", () => {
    const text = "N° allocataire : 1234567 X\nIBAN FR76 3000 6000 0112 3456 7890 189\nN° de dossier : AB-2026-0042";
    const facts = findReferences(text, fold(text));
    assert.deepEqual(facts.find((f) => f.label === "N° allocataire")?.valeur, "1234567 X");
    assert.deepEqual(facts.find((f) => f.label === "N° de dossier")?.valeur, "AB-2026-0042");
    assert.equal(facts.find((f) => f.label === "IBAN")?.valeur, "FR76 •••• •••• 0189");
    assert.equal(maskMiddle("1234"), "1234");
  });
});

describe("bande MRZ (OACI 9303)", () => {
  test("chiffres de contrôle", () => {
    assert.equal(checkDigit("L898902C3"), 6);
    assert.equal(checkDigit("740812"), 2);
    assert.equal(checkDigit("120415"), 9);
  });
  test("passeport TD3", () => {
    const m = parseMrz(PASSPORT_TD3, 2026);
    assert.equal(m?.kind, "passeport");
    assert.equal(m?.checksOk, true);
    assert.equal(m?.documentNumber, "L898902C3");
    assert.equal(m?.expiryDate, "2012-04-15");
    assert.equal(m?.birthDate, "1974-08-12");
    assert.equal(m?.surname, "ERIKSSON");
    assert.equal(m?.givenNames, "ANNA MARIA");
  });
  test("carte d'identité TD1", () => {
    const m = parseMrz(cleanText(CNI_TD1).split("\n"), 2026);
    assert.equal(m?.kind, "carte_identite");
    assert.equal(m?.checksOk, true);
    assert.equal(m?.expiryDate, "2012-04-15");
  });
  test("une bande abîmée ne donne pas de fausse date", () => {
    const bad = [PASSPORT_TD3[0], PASSPORT_TD3[1].replace("1204159", "1204169")];
    const m = parseMrz(bad, 2026);
    assert.equal(m?.checksOk, false);
    assert.equal(m?.expiryDate, null);
  });
});

describe("analyse complète", () => {
  test("CAF : document à envoyer, délai relatif calculé", () => {
    const a = analyzeText(CAF, fr);
    assert.equal(a.type_document, "courrier_administratif");
    assert.equal(a.categorie, "administratif");
    assert.equal(a.emetteur, "CAF");
    assert.equal(a.intention, "envoyer_document");
    assert.equal(a.date_document, "2026-11-06");
    assert.equal(a.date_limite, "2026-11-21");
    assert.match(a.date_limite_extrait ?? "", /délai de 15 jours/);
    assert.equal(a.a_traiter, true);
    assert.equal(a.urgence, "faible");
    assert.match(a.resume, /CAF te demande d'envoyer un document avant le 21 nov\. 2026/);
    assert.ok(a.actions.some((s) => s.includes("caf.fr")));
    assert.deepEqual(a.infos_cles.find((f) => f.label === "N° allocataire")?.valeur, "1234567 X");
    assert.equal(a.titre, "2026-11 Courrier – CAF");
  });

  test("Taxe foncière : montant, date limite, références", () => {
    const a = analyzeText(TAXE, fr);
    assert.equal(a.type_document, "avis_imposition");
    assert.equal(a.categorie, "impots");
    assert.equal(a.montant, 612);
    assert.equal(a.montant_sens, "a_payer");
    assert.equal(a.date_limite, "2026-12-15");
    assert.equal(a.date_document, "2026-08-31");
    assert.equal(a.a_traiter, true);
    assert.equal(a.infos_cles.find((f) => f.label === "Numéro fiscal")?.valeur, "12 34 567 890 123");
    assert.ok(a.actions[0].includes("impots.gouv.fr"));
  });

  test("Amende : 45 jours après la date d'envoi, urgente aujourd'hui", () => {
    const a = analyzeText(AMENDE, fr);
    assert.equal(a.type_document, "amende");
    assert.equal(a.categorie, "vehicule");
    assert.equal(a.montant, 35);
    assert.equal(a.date_limite, "2026-11-09");
    assert.equal(a.urgence, "haute");
    assert.ok(a.infos_cles.some((f) => f.label === "N° de télépaiement"));
  });

  test("Fiche de paie : net reçu, brut, période, rien à faire", () => {
    const a = analyzeText(PAIE, fr);
    assert.equal(a.type_document, "fiche_de_paie");
    assert.equal(a.categorie, "travail");
    assert.equal(a.emetteur, "Boulangerie Martin");
    assert.equal(a.a_traiter, false);
    assert.equal(a.urgence, "aucune");
    assert.equal(a.montant, 1642.18);
    assert.equal(a.montant_sens, "a_recevoir");
    // Séparateur de milliers : espace fine insécable (typographie française).
    assert.match(a.infos_cles.find((f) => f.label === "Salaire brut")?.valeur ?? "", /^2\s105,00\s€$/u);
    assert.match(a.resume, /oct\. 2026/);
    assert.equal(a.titre, "2026-10 Fiche de paie – Boulangerie Martin");
  });

  test("Contrat de travail : période d'essai", () => {
    const a = analyzeText(CONTRAT, fr);
    assert.equal(a.type_document, "contrat_de_travail");
    assert.equal(a.date_document, "2025-09-01");
    assert.equal(a.infos_cles.find((f) => f.label === "Période d'essai")?.valeur, "2 mois");
    assert.equal(a.a_traiter, false);
  });

  test("Carte d'identité : expiration lue dans la bande, expirée", () => {
    const a = analyzeText(CNI_TD1, fr);
    assert.equal(a.type_document, "piece_identite");
    assert.equal(a.categorie, "identite");
    assert.equal(a.date_expiration, "2012-04-15");
    assert.equal(a.a_traiter, true);
    assert.equal(a.urgence, "haute");
    assert.match(a.resume, /expiré/);
  });

  test("Facture prélevée : rien à faire", () => {
    const a = analyzeText(EDF, fr);
    assert.equal(a.type_document, "facture");
    assert.equal(a.categorie, "factures");
    assert.equal(a.montant, 84.6);
    assert.equal(a.a_traiter, false);
  });

  test("Relance avec suspension : urgent, aide proposée", () => {
    const a = analyzeText(RELANCE, fr);
    assert.equal(a.intention, "relance");
    assert.equal(a.date_limite, "2026-11-20");
    assert.equal(a.a_traiter, true);
    assert.equal(a.categorie, "sante");
  });

  test("Texte illisible : rangé dans Autre avec un avertissement", () => {
    const a = analyzeText("x 12 ##", fr);
    assert.equal(a.type_document, "autre");
    assert.equal(a.a_traiter, false);
    assert.ok(a.avertissement);
  });

  test("Explications dans d'autres langues", () => {
    assert.match(analyzeText(CAF, { today: TODAY, language: "en" }).resume, /^CAF asks you to send a document before 21 Nov 2026/);
    assert.match(analyzeText(CAF, { today: TODAY, language: "es" }).resume, /CAF te pide enviar un documento/);
    assert.match(analyzeText(CAF, { today: TODAY, language: "ar" }).resume, /CAF تطلب منك إرسال وثيقة/);
  });

  test("Le même texte donne toujours la même fiche", () => {
    assert.deepEqual(analyzeText(TAXE, fr), analyzeText(TAXE, fr));
  });

  test("Rapide : 1 000 analyses en moins de 2 secondes", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) analyzeText(i % 2 ? CAF : TAXE, fr);
    assert.ok(performance.now() - start < 2000);
  });
});

describe("courrier de réponse", () => {
  test("références reprises, inconnues entre crochets", () => {
    const letter = writeReply({
      goal: "delai",
      sender: "",
      issuer: "Impôts (DGFiP)",
      docTitle: "Avis",
      docDate: "2026-08-31",
      amount: 612,
      references: [{ label: "Numéro fiscal", valeur: "12 34 567 890 123" }],
      details: "",
      today: TODAY,
    });
    assert.match(letter, /\[Prénom Nom\]/);
    assert.match(letter, /Numéro fiscal : 12 34 567 890 123/);
    assert.match(letter, /votre courrier du 31 août 2026/);
    assert.match(letter, /612,00 €/);
    assert.match(letter, /le 9 novembre 2026/);
  });
});
