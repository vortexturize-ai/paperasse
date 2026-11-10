import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPinAgainst, fromHex, hashPin, hashPinAsync, lockoutMs, parsePinRecord, pinProblem, sameBytes, toHex, verifyPin, verifyPinAsync } from "../src/engine/secret.ts";

const salt = Uint8Array.from({ length: 16 }, (_, i) => i * 7);

test("le code n'est jamais gardé en clair, seul le bon code ouvre", () => {
  const rec = hashPin("482913", salt);
  assert.ok(!JSON.stringify(rec).includes("482913"));
  assert.equal(rec.hash.length, 64);
  assert.equal(verifyPin("482913", rec), true);
  for (const wrong of ["482914", "48291", "4829130", "", "abcdef", "482913 "]) assert.equal(verifyPin(wrong, rec), false, wrong);
  assert.equal(verifyPin("482913", null), false);
});

test("deux sels différents donnent deux empreintes différentes pour le même code", () => {
  const other = Uint8Array.from({ length: 16 }, (_, i) => 255 - i);
  assert.notEqual(hashPin("482913", salt).hash, hashPin("482913", other).hash);
});

test("empreinte abîmée : refusée sans planter", () => {
  const rec = hashPin("482913", salt);
  assert.equal(verifyPin("482913", { ...rec, hash: "zz" }), false);
  assert.equal(verifyPin("482913", { ...rec, salt: "abc" }), false);
  assert.equal(verifyPin("482913", { ...rec, hash: rec.hash.slice(0, 62) }), false);
});

test("codes trop faciles refusés", () => {
  for (const bad of ["1234", "0000", "9876", "123456", "1111", "2026", "1999", "12", "abcd", "123456789"]) assert.ok(pinProblem(bad), bad);
  for (const ok of ["4829", "482913", "73915", "20481357"]) assert.equal(pinProblem(ok), null, ok);
});

test("attente croissante après des erreurs", () => {
  assert.equal(lockoutMs(3), 0);
  assert.equal(lockoutMs(5), 30_000);
  assert.ok(lockoutMs(8) > lockoutMs(6));
  assert.equal(lockoutMs(50), 3_600_000);
});

test("versions asynchrones identiques aux synchrones", async () => {
  const rec = await hashPinAsync("482913", salt);
  assert.deepEqual(rec, hashPin("482913", salt));
  assert.equal(await verifyPinAsync("482913", rec), true);
  assert.equal(await verifyPinAsync("482914", rec), false);
  assert.equal(await verifyPinAsync("482913", { ...rec, salt: "zz" }), false);
});

test("un seul calcul pour le code secret et le code panique (même sel)", async () => {
  const secret = hashPin("482913", salt);
  const panic = hashPin("730154", salt);
  assert.deepEqual(await checkPinAgainst("482913", [secret, panic]), [true, false]);
  assert.deepEqual(await checkPinAgainst("730154", [secret, panic]), [false, true]);
  assert.deepEqual(await checkPinAgainst("000000", [secret, panic]), [false, false]);
  assert.deepEqual(await checkPinAgainst("482913", [secret, null]), [true, false]);
  assert.deepEqual(await checkPinAgainst("12", [secret, panic]), [false, false]);
  // Empreintes faites avec des sels différents (anciens réglages) : toujours justes.
  const other = hashPin("730154", Uint8Array.from({ length: 16 }, (_, i) => 200 - i), 2_000);
  assert.deepEqual(await checkPinAgainst("730154", [secret, other]), [false, true]);
  assert.deepEqual(await checkPinAgainst("730154", [secret, { ...other, hash: "zz" }]), [false, false]);
});

test("enregistrement gardé : relu, ou refusé s'il est abîmé", () => {
  const rec = hashPin("482913", salt);
  assert.deepEqual(parsePinRecord(JSON.stringify(rec)), rec);
  for (const bad of [null, "", "{", "[]", "null", JSON.stringify({ ...rec, v: 2 }), JSON.stringify({ ...rec, iter: 1 }), JSON.stringify({ ...rec, hash: "00" }), JSON.stringify({ ...rec, salt: "" })])
    assert.equal(parsePinRecord(bad), null, String(bad));
});

test("outils : hexadécimal et comparaison", () => {
  assert.equal(toHex(fromHex("00ff10")), "00ff10");
  assert.throws(() => fromHex("xyz"));
  assert.equal(sameBytes(fromHex("0102"), fromHex("0102")), true);
  assert.equal(sameBytes(fromHex("0102"), fromHex("0103")), false);
  assert.equal(sameBytes(fromHex("0102"), fromHex("010200")), false);
});

test("pièce sensible : identité, banque, santé, ou numéro très personnel dans le texte", async () => {
  const { isSensitivePaper } = await import("../src/engine/sensitive.ts");
  assert.equal(isSensitivePaper({ category: "identite" }), true);
  assert.equal(isSensitivePaper({ category: "factures", docType: "releve_bancaire" }), true);
  assert.equal(isSensitivePaper({ category: "factures", fullText: "Votre IBAN : FR76 3000 6000 0112 3456 7890 189" }), true);
  assert.equal(isSensitivePaper({ category: "factures", fullText: "Facture EDF, 84,60 € à payer avant le 12 décembre." }), false);
  assert.equal(isSensitivePaper({ category: "autre", fullText: null }), false);
});
