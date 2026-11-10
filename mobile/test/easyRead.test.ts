import { test } from "node:test";
import assert from "node:assert/strict";
import { essentials, forSpeech, longDate, speechChunks, speechText, type EasyInput } from "../src/engine/easyRead.ts";

const TODAY = "2026-11-10";
const facture: EasyInput = {
  kind: "Facture",
  issuer: "EDF",
  summary: "Facture d'électricité de novembre.",
  actions: ["Vérifie que le compte est approvisionné.", "Garde la facture 5 ans."],
  toDo: true,
  isDone: false,
  amount: 84.6,
  amountDirection: "a_payer",
  deadline: "2026-11-20",
  expiry: null,
  scam: false,
};

test("l'essentiel : quoi, à faire, combien, avant quand — dans cet ordre", () => {
  const l = essentials(facture, "fr", TODAY);
  assert.deepEqual(
    l.map((x) => `${x.label} : ${x.text}`),
    ["C’est : Facture de EDF", "À faire : Vérifie que le compte est approvisionné.", "À payer : 84,60 €", "Avant le : 20 novembre 2026 (dans 10 jours)"],
  );
  assert.equal(l[3].tone, "orange");
});

test("arnaque : l'alerte d'abord, et jamais « à payer » ni de date", () => {
  const l = essentials({ ...facture, scam: true }, "fr", TODAY);
  assert.equal(l[0].tone, "red");
  assert.match(l[0].text, /arnaque/);
  assert.ok(!l.some((x) => x.label === "À payer" || x.label === "Avant le" || x.label === "À faire"));
});

test("date dépassée, fait, rien à faire, pièce périmée", () => {
  assert.match(essentials({ ...facture, deadline: "2026-11-07" }, "fr", TODAY).at(-1)!.text, /dépassé depuis 3 jours/);
  const done = essentials({ ...facture, isDone: true }, "fr", TODAY);
  assert.ok(done.some((x) => x.label === "C’est fait") && !done.some((x) => x.label === "Avant le"));
  const info = essentials({ ...facture, actions: [], toDo: false, amount: null, deadline: null }, "fr", TODAY);
  assert.equal(info[1].text, "Rien. Garde ce papier.");
  const id = essentials({ ...facture, kind: "Carte d'identité", issuer: null, actions: [], toDo: false, amount: null, deadline: null, expiry: "2026-01-02" }, "fr", TODAY);
  assert.equal(id.at(-1)!.text, "Périmé depuis le 2 janvier 2026.");
});

test("rien à faire mais un montant (prélèvement) : pas de « À payer », pas d'alarme", () => {
  const auto = essentials({ ...facture, actions: [], toDo: false }, "fr", TODAY);
  assert.deepEqual(
    auto.map((x) => `${x.label} : ${x.text}`),
    ["C’est : Facture de EDF", "À faire : Rien à faire de ton côté. Garde ce papier.", "Montant : 84,60 €", "Date prévue : 20 novembre 2026 (dans 10 jours)"],
  );
  assert.ok(auto.every((x) => x.tone !== "red" && x.tone !== "orange"));
  const past = essentials({ ...facture, actions: [], toDo: false, deadline: "2026-11-01" }, "fr", TODAY);
  assert.ok(!past.some((x) => x.icon === "calendar"), "date passée sans démarche : rien à signaler");
});

test("4 langues", () => {
  for (const lang of ["fr", "en", "es", "ar"] as const) {
    const l = essentials(facture, lang, TODAY);
    assert.equal(l.length, 4, lang);
    assert.ok(l.every((x) => x.text.length > 0 && x.label.length > 0), lang);
  }
  assert.equal(longDate("en", "2026-11-20"), "20 November 2026");
  assert.equal(longDate("es", "2026-11-01"), "1 de noviembre de 2026");
  assert.equal(longDate("fr", "2026-11-01"), "1er novembre 2026");
});

test("voix : montants et dates en mots, numéros très personnels jamais lus", () => {
  const s = forSpeech("Montant : 1 234,56 € à payer avant le 20/11/2026. Dossier n° 12. IBAN FR76 3000 6000 0112 3456 7890 189 • merci", "fr");
  assert.ok(s.includes("1234 euros 56"), s);
  assert.ok(s.includes("20 novembre 2026"), s);
  assert.ok(s.includes("numéro 12"), s);
  assert.ok(!s.includes("3000 6000"), s);
  assert.ok(s.includes("numéro masqué"), s);
  assert.ok(!s.includes("•"), s);
  assert.equal(forSpeech("Total 84,00 EUR", "fr"), "Total 84 euros");
  assert.equal(forSpeech("Total €84.60", "en"), "Total 84 euros 60");
  // Une date impossible écrite sur le papier est lue telle quelle (pas « corrigée ») ; un mois 13 n'est pas une date.
  assert.equal(forSpeech("Le 31/02/2026 ou le 2026-13-01", "fr"), "Le 31 février 2026 ou le 2026-13-01");
});

test("texte complet à lire : l'essentiel puis l'explication", () => {
  const s = speechText(facture, "fr", TODAY);
  assert.ok(s.startsWith("C’est : Facture de EDF."), s);
  assert.ok(s.includes("84 euros 60") && s.includes("Garde la facture 5 ans."), s);
  const scam = speechText({ ...facture, scam: true }, "fr", TODAY);
  assert.ok(!scam.includes("Garde la facture"), "pas d'étapes pour une arnaque");
});

test("découpage pour la voix : aucune phrase coupée, aucun morceau trop long", () => {
  const long = Array.from({ length: 400 }, (_, i) => `Phrase numéro ${i} assez longue pour remplir.`).join(" ");
  const chunks = speechChunks(long, 1000);
  assert.ok(chunks.length > 5);
  assert.ok(chunks.every((c) => c.length <= 1000 && c.endsWith(".")));
  assert.equal(chunks.join(" "), long);
  assert.ok(speechChunks("x".repeat(2500), 1000).every((c) => c.length <= 1000));
  assert.deepEqual(speechChunks(""), []);
});
