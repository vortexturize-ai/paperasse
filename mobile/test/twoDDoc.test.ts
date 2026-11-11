// Exemples officiels de la spécification 2D-DOC (ANTS, V 3.3.9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { X509Certificate, verify } from "node:crypto";
import { base32Decode, codeFacts, crossCheck, hexDate, parse2DDoc, parseMessage } from "../src/engine/twoDDoc.ts";
import { CERTIFICAT_TEST, EXEMPLES_OFFICIELS } from "./outils/deuxdoc-officiels.ts";

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
  // Section 7.13 (tests virologiques) : pas décodée.
  const d = parse2DDoc(`DC04FR000001125E125BB201FR60JEAN/MARTIN${GS}6925121969F0CORRINE${GS}F1BERTHIER${US}JEW7ZPEPOE5CK4BZ4PE36L2HUB`)!;
  assert.equal(d.docTypeLabel, "Test COVID");
  assert.equal(d.issued, "2012-11-15", "125E – 15 novembre 2012");
  assert.equal(d.signed, "2012-11-12", "125B – 12 novembre 2012");
  assert.deepEqual(pairs(d), [["60", "JEAN/MARTIN"], ["69", "25121969"]]);
  assert.equal(d.fields[1].value, "25/12/1969");
  assert.equal(d.undecoded, `F0CORRINE${GS}F1BERTHIER`);
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

// ---- Les 67 exemples officiels de la spécification (identité, santé, véhicules, diplômes, permis, asile…) ----

const officiel = (type: string, i = 0) => EXEMPLES_OFFICIELS.filter((e) => e.type === type)[i]!;
const field = (d: NonNullable<ReturnType<typeof parse2DDoc>>, id: string) => d.fields.find((f) => f.id === id);

test("exemples officiels : chaque signature est valide avec le certificat de test (fixtures exactes, découpage juste)", () => {
  const key = new X509Certificate(CERTIFICAT_TEST).publicKey;
  assert.equal(EXEMPLES_OFFICIELS.length, 67);
  for (const e of EXEMPLES_OFFICIELS) {
    const d = parse2DDoc(e.code);
    assert.ok(d, `${e.type} : pas lu`);
    assert.equal(d.version, e.version);
    assert.equal(d.docType, e.type);
    assert.ok(d.signature && d.signature.length === 64, `${e.type} : signature P-256 de 64 octets`);
    const ok = verify("sha256", Buffer.from(d.signedData, "latin1"), { key, dsaEncoding: "ieee-p1363" }, d.signature);
    assert.ok(ok, `${e.type} (v${e.version}) : signature invalide`);
  }
});

test("exemples officiels : tout est décodé, sauf les sections 7.13 (tests virologiques) et 7.18 (sûreté aéroportuaire)", () => {
  const notYet = new Set(["B2", "26"]);
  for (const e of EXEMPLES_OFFICIELS) {
    const d = parse2DDoc(e.code)!;
    if (notYet.has(e.type)) assert.ok(d.undecoded, e.type);
    else assert.equal(d.undecoded, null, `${e.type} : reste ${JSON.stringify(d.undecoded?.slice(0, 20))}`);
  }
});

test("titre d'identité et document étranger (exemples officiels 07 et 13)", () => {
  const id = parse2DDoc(officiel("07").code)!;
  assert.deepEqual(pairs(id), [["60", "NATACHA"], ["62", "SPECIMEN"], ["65", "P "], ["66", "07CD12304"], ["67", "FR"], ["68", "F"], ["6C", "FR"]]);
  assert.equal(field(id, "65")!.value, "passeport", "2 caractères fixes : « P » suivi d'une espace");
  assert.equal(field(id, "68")!.value, "féminin");
  const etr = parse2DDoc(officiel("13").code)!;
  assert.equal(field(etr, "6K")!.raw, "9201202004012359123");
  assert.equal(field(etr, "6Q")!.raw, "7503120521", "10 caractères (maximum) : pas de séparateur après");
  assert.equal(field(etr, "6N")!.value, "01/05/2020");
  assert.equal(field(etr, "6O")!.value, "30/06/2020");
  assert.equal(field(etr, "6M")!.raw, "ENFANT ENTRE PAR REGROUPEMENT FAMILIAL");
});

test("véhicules : certificat qualité de l'air, cession, courrier de points (exemples officiels A0, A7, A8, A1)", () => {
  const air = parse2DDoc(officiel("A0").code)!;
  assert.equal(field(air, "A1")!.raw, "BH-999-VX");
  assert.equal(field(air, "A5")!.raw, "M1 ", "3 caractères fixes, espace compris");
  assert.equal(field(air, "A7")!.value, "130 g/km", "082 en hexadécimal");
  assert.equal(field(air, "A9")!.value, "classe 5");
  assert.equal(field(air, "AA")!.value, "01/01/1999");
  assert.equal(field(parse2DDoc(officiel("A7").code)!, "AM")!.raw, "FAP");
  const cession = parse2DDoc(officiel("A8").code)!;
  assert.equal(field(cession, "AN")!.value, "1 337");
  assert.equal(field(cession, "C3")!.value, "02/03/2020 à 14 h 00");
  assert.equal(field(cession, "CB")!.value, "123 456");
  assert.equal(field(cession, "C0")!.value, "masculin");
  const points = parse2DDoc(officiel("A1").code)!;
  assert.equal(field(points, "AD")!.value, "01/01/2016", "16D4 en jours depuis 2000");
  assert.equal(field(points, "AE")!.value, "01 h 32");
  assert.equal(field(points, "AF")!.value, "4");
  assert.equal(field(points, "AG")!.value, "8");
});

test("permis de conduire : arrêté et relevé d'information (exemples officiels AA, AB)", () => {
  const arrete = parse2DDoc(officiel("AA").code)!;
  assert.equal(field(arrete, "E0")!.value, "suspension provisoire du permis");
  assert.equal(field(arrete, "E2")!.value, "09/05/2013");
  assert.equal(field(arrete, "AC")!.raw, "0123456789ABCDEF");
  const releve = parse2DDoc(officiel("AB").code)!;
  assert.equal(field(releve, "E4")!.value, "attestation de permis de conduire");
  assert.equal(field(releve, "E5")!.value, "valide", "annexe 13 : 50 = VALIDE");
  assert.equal(field(releve, "E8")!.value, "02/02/2021 à 15 h 22");
  assert.equal(field(releve, "09")!.raw, "0003");
  assert.match(field(releve, "E6")!.raw, /^A B C D B1 .* AM$/);
});

test("santé, retraite, études, asile, vaccin, caducée (exemples officiels AE, 23, B0, B1, 16, L1, C9)", () => {
  const deces = parse2DDoc(officiel("AE").code)!;
  assert.equal(field(deces, "71")!.value, "20/04/2017 à 00 h 00");
  assert.equal(field(deces, "72")!.raw, "SPECIMEN");
  const vie = parse2DDoc(officiel("23").code)!;
  assert.equal(field(vie, "8D")!.value, "02/01/2024 à 07 h 16 min 53 s");
  assert.equal(field(vie, "8C")!.raw, "0123456789", "10 caractères (maximum) : pas de séparateur après");
  assert.equal(field(vie, "8G")!.value, "oui");
  const diplome = parse2DDoc(officiel("B0").code)!;
  assert.equal(field(diplome, "BG")!.value, "master");
  assert.equal(field(diplome, "BF")!.value, "2014-2015", "7DF = 2015");
  assert.equal(field(diplome, "BD")!.raw, "7");
  const cvec = parse2DDoc(officiel("B1").code)!;
  assert.equal(field(cvec, "BK")!.raw, "18-ROSWFTHR-35");
  assert.equal(field(cvec, "B3")!.raw, "", "champ vide suivi d'un <GS>");
  const asile = parse2DDoc(officiel("16").code)!;
  assert.equal(field(asile, "G0")!.value, "procédure normale");
  assert.equal(field(asile, "G1")!.value, "Bretagne");
  assert.equal(field(asile, "6O")!.value, "30/07/2021");
  const vaccin = parse2DDoc(officiel("L1").code)!;
  assert.equal(field(vaccin, "L3")!.raw, "COVID-19");
  assert.equal(field(vaccin, "LA")!.value, "terminé");
  const caducee = parse2DDoc(officiel("C9").code)!;
  assert.equal(field(caducee, "I0")!.raw, "2023");
});

test("huissier : adresse du document en ligne en Base32 (exemple officiel 12)", () => {
  const d = parse2DDoc(officiel("12").code)!;
  assert.equal(field(d, "96")!.value, "21/11/2017");
  assert.equal(field(d, "0C")!.value, "huissier-justice.fr/1896547853AB");
});

test("EORI des autorisations douanières : 17 caractères sans séparateur (exemples officiels C2, C3, C5, C6)", () => {
  for (const type of ["C2", "C3", "C5", "C6"]) {
    const d = parse2DDoc(officiel(type).code)!;
    assert.equal(d.undecoded, null, type);
    for (const f of d.fields.filter((x) => ["D2", "DH", "DP", "DW"].includes(x.id))) assert.match(f.raw, /^FR\d{15}$/, `${type}/${f.id}`);
  }
});

test("fiche du papier : fin de validité et type lus dans le code, jamais de numéro personnel", () => {
  const etr = codeFacts(parse2DDoc(officiel("13").code)!);
  assert.equal(etr.expiry, "2020-06-30");
  assert.deepEqual(etr.facts.map((f) => f.label), ["Code 2D-Doc", "Fin de validité (code 2D-Doc)"]);
  assert.equal(etr.facts[1].valeur, "30/06/2020");
  assert.equal(codeFacts(parse2DDoc(officiel("AC").code)!).expiry, "2031-07-07", "AI : date d'expiration initiale");
  assert.equal(codeFacts(parse2DDoc(officiel("04").code)!).expiry, null);
  for (const e of EXEMPLES_OFFICIELS) {
    const shown = JSON.stringify(codeFacts(parse2DDoc(e.code)!).facts);
    assert.doesNotMatch(shown, /SPECIMEN|NATACHA|7503120521|07CD12304|\d{13}/, e.type);
  }
  // Date impossible : ignorée plutôt qu'inventée.
  assert.equal(codeFacts(parse2DDoc(`DC04FR000001125E125B1301FR6O31022020${US}AAAA`)!).expiry, null);
});
