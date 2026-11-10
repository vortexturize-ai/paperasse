// Exemples officiels de la spécification 2D-DOC (ANTS, V 3.3.9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, crossCheck, hexDate, parse2DDoc, parseMessage } from "../src/engine/twoDDoc.ts";

const GS = "\x1d";
const RS = "\x1e";
const US = "\x1f";

const hex = (s: string) => Uint8Array.from(s.trim().split(/\s+/), (h) => parseInt(h, 16));
const pairs = (d: ReturnType<typeof parse2DDoc>) => d!.fields.map((f) => [f.id, f.raw]);

// Spécification, exemple « 04 – Avis d'impôt sur les revenus ».
const AVIS =
  `DC04FR000001FFFF1FB60401FR432,75${GS}44227801234567845202146RETI PATRICK${GS}4A310720224163198${GS}47300112345678948RETI SOPHIE${GS}490701987765432` +
  `${US}QHA4A6QOV6AZJEBTIUNR7QOBXINNTMZTD5COQH6VN24NCZTXA7MYXB6SNSNTWAQRYK3ZFP4ZWBGLTJ6SDSPMURF7YFILKQFIAJY7NTI`;
const AVIS_SIG =
  "81 C1 C0 7A 0E AF 81 94 90 33 45 1B 1F C1 C1 BA 1A D9 B3 33 1F 44 E8 1F D5 6E B8 D1 66 77 07 D9 8B 87 D2 6C 9B 3B 02 11 C2 B7 92 BF 99 B0 4C B9 A7 D2 1C 9E CA 44 BF C1 50 B5 40 A8 02 71 F6 CD";

test("avis d'impôt (exemple officiel) : en-tête, 9 données, signature Base32", () => {
  const d = parse2DDoc(AVIS)!;
  assert.equal(d.version, 4);
  assert.equal(d.authority, "FR00");
  assert.equal(d.certificate, "0001");
  assert.equal(d.issued, null, "FFFF = pas de date d'émission");
  assert.equal(d.signed, "2022-03-24", "1FB6 – 24 mars 2022");
  assert.equal(d.docType, "04");
  assert.equal(d.docTypeLabel, "Avis d'impôt sur les revenus");
  assert.equal(d.perimeter, "01");
  assert.equal(d.country, "FR");
  assert.deepEqual(pairs(d), [
    ["43", "2,75"],
    ["44", "2278012345678"],
    ["45", "2021"],
    ["46", "RETI PATRICK"],
    ["4A", "31072022"],
    ["41", "63198"],
    ["47", "3001123456789"],
    ["48", "RETI SOPHIE"],
    ["49", "0701987765432"],
  ]);
  assert.equal(d.undecoded, null);
  assert.deepEqual(d.signature, hex(AVIS_SIG), "signature P-256 : 64 octets, comme dans la spécification");
  assert.equal(d.signedData, AVIS.slice(0, AVIS.indexOf(US)));
  assert.equal(d.fields.find((f) => f.id === "41")!.value, "63 198 €");
  assert.equal(d.fields.find((f) => f.id === "4A")!.value, "31/07/2022");
});

test("avis de situation déclarative (exemple officiel 18)", () => {
  const d = parse2DDoc(
    `DC04FR000001FFFF20971801FR432,75${GS}44227801234567845202146RETI PATRICK${GS}4B300420224163198${GS}47300112345678948RETI SOPHIE${GS}490701987765432` +
      `${US}2VFZBZ3HMHQQHMG74A2IF6VC6OSP675IQGBCYTPDTGI532KD773O2TNDSS7ML3CR3YGE5VIFNACOL2MIEVI54IULFYKKMRZZFSXF5MY`,
  )!;
  assert.equal(d.signed, "2022-11-04", "2097 – 4 novembre 2022");
  assert.equal(d.fields.find((f) => f.id === "4B")!.value, "30/04/2022");
  assert.deepEqual(d.signature!.subarray(0, 4), hex("D5 4B 90 E7"));
  assert.equal(d.signature!.length, 64);
});

test("attestation 2041-ASK, dons, cession (exemples officiels 21, 19, 20)", () => {
  const ask = parse2DDoc(
    `DC04FR000001FFFF21A42101FR4NRETI PATRICK${GS}4O2 RUE DES CHAMPS ELYSEES${GS}4P741004QANEMASSE${GS}4RSIP HAUTE SAVOIE${GS}4S20234TGENEVE${GS}4USPECIMEN 74 INC${GS}5523052017` +
      `${US}BCI4V6TBCZW5MWXGCWLKO6T6AXEKDPFPULFN3FXXJDASYC4JTX63UECQMMPRJ3OS5MO27XYOAJ4ZB246DAR5FVXLUW65HS6U223WK7A`,
  )!;
  assert.equal(ask.signed, "2023-07-31", "21A4 – 31 juillet 2023");
  assert.deepEqual(pairs(ask), [
    ["4N", "RETI PATRICK"],
    ["4O", "2 RUE DES CHAMPS ELYSEES"],
    ["4P", "74100"],
    ["4Q", "ANEMASSE"],
    ["4R", "SIP HAUTE SAVOIE"],
    ["4S", "2023"],
    ["4T", "GENEVE"],
    ["4U", "SPECIMEN 74 INC"],
    ["55", "23052017"],
  ]);
  assert.deepEqual(ask.signature!.subarray(0, 3), hex("08 91 CA"));

  const dons = parse2DDoc(
    `DC04FR000001FFFF21BB1901FR4C070620234D10000000${GS}4E100000${GS}4FENREGISTR1234564GRETI SOPHIE${GS}4HRETI PATRICK/L'ESPECIMEN JEAN-RENE${GS}4I2500${GS}` +
      `${US}S6VGH6V5KMLA4XBSBA6Q5HQA3OE6HIPT2AFXLWG2DJPGE6PP3SBMPE3DCFGNZNUBNEZHIX5CLQTF4HE7SAWBKNL3DVW4M3WZI53XV5Q`,
  )!;
  assert.equal(dons.signed, "2023-08-23", "21BB – 23 août 2023");
  assert.deepEqual(pairs(dons), [
    ["4C", "07062023"],
    ["4D", "10000000"],
    ["4E", "100000"],
    ["4F", "ENREGISTR123456"],
    ["4G", "RETI SOPHIE"],
    ["4H", "RETI PATRICK/L'ESPECIMEN JEAN-RENE"],
    ["4I", "2500"],
  ]);
  assert.equal(dons.fields[1].value, "10 000 000 €");
  assert.deepEqual(dons.signature!.subarray(0, 3), hex("97 AA 63"));

  const cession = parse2DDoc(
    `DC04FR000001FFFF21BB2001FR4C070620234J10000000${GS}4E100000${GS}4FENREGISTR1234564K@SPECIMEN@ INCORPORATED${GS}4LRETI PATRICK${GS}4M2,5` +
      `${US}UXMO63IXZ66K3JECXHZ6USNQNPPI4ZWQSJLGIXEFTRCU5XUJJXYF3FCDVCKSKQELMPMQGIL5CLPG75QBCNVADRLUILT4VEKOAVMMM5Y`,
  )!;
  assert.deepEqual(pairs(cession).map((p) => p[0]), ["4C", "4J", "4E", "4F", "4K", "4L", "4M"]);
  assert.equal(cession.fields.at(-1)!.raw, "2,5");
  assert.deepEqual(cession.signature!.subarray(0, 3), hex("A5 D8 EF"));
});

test("identifiant que Paperasse ne connaît pas encore : rien d'inventé, la suite est gardée telle quelle", () => {
  const d = parse2DDoc(`DC04FR000001125E125B1701FR60JEAN/MARTIN${GS}6925121969${US}JEW7ZPEPOE5CK4BZ4PE36L2HUB`)!;
  assert.equal(d.docTypeLabel, "Attestation de fin de droit à l'ADA");
  assert.equal(d.issued, "2012-11-15", "125E – 15 novembre 2012");
  assert.equal(d.signed, "2012-11-12", "125B – 12 novembre 2012");
  assert.deepEqual(d.fields, []);
  assert.equal(d.undecoded, `60JEAN/MARTIN${GS}6925121969`);
});

test("facture (règles de la section 3.4.1) : fixe sans séparateur, variable avec <GS>, longueur maximale, troncature <RS>", () => {
  const name38 = "MME DURAND MARIE CHRISTINE ELISABETH A"; // 38 caractères : pas de <GS>
  assert.equal(name38.length, 38);
  const msg = `10${name38}2212 RUE DES LILAS${GS}24750122CMARSE${RS}18134985638${GS}1D84,60${GS}1E33177935210`;
  const { fields, undecoded } = parseMessage(msg);
  assert.equal(undecoded, null);
  assert.deepEqual(
    fields.map((f) => [f.id, f.raw, f.truncated]),
    [
      ["10", name38, false],
      ["22", "12 RUE DES LILAS", false],
      ["24", "75012", false],
      ["2C", "MARSE", true],
      ["18", "134985638", false],
      ["1D", "84,60", false],
      ["1E", "33177935210", false],
    ],
  );
  assert.equal(fields[5].value, "84,60 €");
  assert.equal(fields[6].value, "01 77 93 52 10");
});

test("versions 02 et 03 ; codes abîmés ou qui n'en sont pas", () => {
  const v2 = parse2DDoc(`DC02FR0AXT4A0E840E8A0124750${US}AAAA`)!;
  assert.equal(v2.version, 2);
  assert.equal(v2.perimeter, null);
  assert.equal(v2.issued, hexDate("0E84"));
  assert.deepEqual(v2.fields, [], "code postal de 3 chiffres au lieu de 5 : pas inventé");
  assert.equal(v2.undecoded, "24750");
  const v3 = parse2DDoc(`DC03FR0AXT4A0E840E8A0101182024${GS}`)!;
  assert.equal(v3.perimeter, "01");
  assert.equal(v3.country, null);
  assert.deepEqual(pairs(v3), [["18", "2024"]]);
  for (const bad of ["", "HELLO", "DC05FR0AXT4A0E840E8A0101FR", "DC04FR0A", "DC04fr0axt4a0e840e8a0101FR", "DC04FR0AXT4AZZZZ0E8A0101FR"])
    assert.equal(parse2DDoc(bad), null, JSON.stringify(bad));
  // Champ fixe coupé : on s'arrête sans planter.
  assert.equal(parse2DDoc(`DC04FR0AXT4A0E840E8A0101FR4422780`)!.undecoded, "4422780");
  assert.equal(hexDate("111E"), "2011-12-31", "exemple de la spécification : 31 décembre 2011 = 111E");
  assert.equal(hexDate("FFFF"), null);
});

test("annexe (version 04) : après la signature et un <GS>, lue à part (non signée)", () => {
  const d = parse2DDoc(`DC04FR0AXT4A0E840E8A0101FR18A1${US}MFRGG${GS}19C42`)!;
  assert.deepEqual(pairs(d), [["18", "A1"]]);
  assert.deepEqual(d.annex.map((f) => [f.id, f.raw]), [["19", "C42"]]);
  assert.deepEqual(d.signature, base32Decode("MFRGG"));
  assert.equal(new TextDecoder().decode(base32Decode("MFRGG")!), "abc");
});

test("comparaison avec le papier : le code dit une chose, le papier une autre", () => {
  const d = parse2DDoc(AVIS)!;
  const ok = crossCheck(
    d,
    "Avis d'impôt 2022 sur les revenus 2021. M. RETI Patrick, Mme RETI Sophie. Référence de l'avis : 22 78 012 345 678. " +
      "Nombre de parts : 2,75. Revenu fiscal de référence : 63 198 €. N° fiscal : 30 01 123 456 789 et 07 01 987 765 432.",
  );
  assert.equal(ok.missing.length, 0, JSON.stringify(ok.missing.map((m) => m.id)));
  assert.ok(ok.checked >= 6);
  const forged = crossCheck(
    d,
    "Avis d'impôt. M. RETI Patrick, Mme RETI Sophie. Référence 2278012345678. Revenu fiscal de référence : 13 198 €. N° fiscal 3001123456789 0701987765432.",
  );
  assert.deepEqual(forged.missing.map((m) => m.id), ["41"], "revenu modifié à la main : repéré");
});
