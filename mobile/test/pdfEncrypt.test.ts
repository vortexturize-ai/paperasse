// Chiffrement PDF (révision 6, AES-256) vérifié par une seconde mise en œuvre, écrite ici avec node:crypto :
// le mot de passe ouvre la clé, la clé ouvre chaque chaîne et chaque flux.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFString, StandardFonts } from "pdf-lib";
import { buildPagesPdf } from "../src/engine/dossierPdf.ts";
import { extractPdfText } from "../src/engine/pdf.ts";
import { encryptPdf, hash2B, newPdfPassword, passwordBytes, pdfPasswordProblem } from "../src/engine/pdfEncrypt.ts";

const rnd = (n: number) => new Uint8Array(randomBytes(n));

/** Algorithme 2.B réécrit avec node:crypto (seconde mise en œuvre, pour comparer). */
function hash2BNode(pw: Uint8Array, salt: Uint8Array, udata: Uint8Array = new Uint8Array(0)): Buffer {
  let k = createHash("sha256").update(pw).update(salt).update(udata).digest();
  let e = Buffer.alloc(1);
  let round = 0;
  while (round < 64 || e[e.length - 1] > round - 32) {
    const block = Buffer.concat([pw, k, udata]);
    const c = createCipheriv("aes-128-cbc", k.subarray(0, 16), k.subarray(16, 32));
    c.setAutoPadding(false);
    e = Buffer.concat([c.update(Buffer.concat(Array(64).fill(block))), c.final()]);
    const mod = e.subarray(0, 16).reduce((a, b) => a + b, 0) % 3;
    k = createHash(mod === 0 ? "sha256" : mod === 1 ? "sha384" : "sha512").update(e).digest();
    round++;
  }
  return k.subarray(0, 32);
}

function aesCbcOpen(key: Uint8Array, data: Uint8Array, padding = true, iv?: Uint8Array): Buffer {
  const d = createDecipheriv(key.length === 32 ? "aes-256-cbc" : "aes-128-cbc", key, iv ?? data.subarray(0, 16));
  d.setAutoPadding(padding);
  return Buffer.concat([d.update(iv ? data : data.subarray(16)), d.final()]);
}

/** Ouvre la clé du fichier avec le mot de passe, comme un lecteur PDF ; null si le mot de passe est faux. */
function openFileKey(encrypt: PDFDict, password: string): Buffer | null {
  const bytes = (name: string) => (encrypt.get(PDFName.of(name)) as PDFHexString).asBytes();
  const U = bytes("U");
  const pw = passwordBytes(password);
  if (!hash2BNode(pw, U.subarray(32, 40)).equals(Buffer.from(U.subarray(0, 32)))) return null;
  return aesCbcOpen(hash2BNode(pw, U.subarray(40, 48)), bytes("UE"), false, new Uint8Array(16));
}

async function sample(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  d.addPage([595, 842]).drawText("Bulletin de paie : salaire net 1 642,18 euros", { x: 50, y: 700, size: 14, font: f });
  d.addPage([595, 842]).drawText("Page deux : conges restants 12,5 jours", { x: 50, y: 700, size: 14, font: f });
  return (await buildPagesPdf({ title: "Fiche de paie – Octobre", pages: [{ kind: "pdf", bytes: await d.save() }] })).bytes;
}

test("empreinte du mot de passe : deux mises en œuvre indépendantes donnent la même chose", () => {
  for (const pw of ["ABCD-EFGH-JKMN", "mot de passe été", "x".repeat(127)]) {
    const salt = rnd(8);
    const udata = rnd(48);
    assert.deepEqual(Buffer.from(hash2B(passwordBytes(pw), salt)), hash2BNode(passwordBytes(pw), salt));
    assert.deepEqual(Buffer.from(hash2B(passwordBytes(pw), salt, udata)), hash2BNode(passwordBytes(pw), salt, udata));
  }
});

test("PDF protégé : le bon mot de passe ouvre tout, un autre rien ; chaque flux et chaque chaîne est chiffré", async () => {
  const plain = await sample();
  const enc = await encryptPdf(plain, "ABCD-EFGH-JKMN", rnd);
  assert.equal(extractPdfText(enc).encrypted, true, "notre lecteur le voit protégé");
  assert.ok(!Buffer.from(enc).includes("Bulletin de paie"), "aucun texte en clair");

  // updateMetadata: false, sinon pdf-lib réécrit Producer et ModDate en clair dans la copie en mémoire.
  const doc = await PDFDocument.load(enc, { ignoreEncryption: true, updateMetadata: false });
  const encrypt = doc.context.lookup(doc.context.trailerInfo.Encrypt) as PDFDict;
  assert.equal((encrypt.get(PDFName.of("V")) as PDFNumber).asNumber(), 5);
  assert.equal((encrypt.get(PDFName.of("R")) as PDFNumber).asNumber(), 6);
  assert.ok(doc.context.trailerInfo.ID instanceof PDFArray, "identifiant du fichier dans le trailer");
  assert.equal(openFileKey(encrypt, "ABCD-EFGH-JKMN-X"), null);
  assert.equal(openFileKey(encrypt, "abcd-efgh-jkmn"), null, "majuscules : ce n'est pas le même mot de passe");
  const key = openFileKey(encrypt, "ABCD-EFGH-JKMN")!;
  assert.equal(key.length, 32);

  // Perms : P et « adb » une fois déchiffré avec la clé du fichier.
  const d = createDecipheriv("aes-256-ecb", key, null);
  d.setAutoPadding(false);
  const perms = Buffer.concat([d.update((encrypt.get(PDFName.of("Perms")) as PDFHexString).asBytes()), d.final()]);
  assert.equal(perms.readInt32LE(0), -4);
  assert.equal(perms.subarray(8, 12).toString("latin1"), "Tadb");

  // Chaque flux s'ouvre avec la clé ; les pages contiennent le texte d'origine.
  let text = "";
  let strings = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (ref === doc.context.trailerInfo.Encrypt) continue; // le dictionnaire de chiffrement reste en clair
    if (obj instanceof PDFRawStream) {
      const opened = aesCbcOpen(key, obj.contents);
      const filter = obj.dict.get(PDFName.of("Filter"));
      text += (filter === PDFName.of("FlateDecode") ? inflateSync(opened) : opened).toString("latin1");
    } else if (obj instanceof PDFDict) {
      for (const [, v] of obj.entries()) {
        if (v instanceof PDFString) assert.fail("chaîne restée en clair");
        if (v instanceof PDFHexString) {
          strings++;
          const s = aesCbcOpen(key, v.asBytes());
          if (s[0] === 0xfe && s[1] === 0xff) text += s.subarray(2).swap16().toString("utf16le");
        }
      }
    }
  }
  // pdf-lib écrit le texte des pages en hexadécimal (<42756C6C…> Tj).
  const glyphs = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();
  assert.ok(text.includes(glyphs("Bulletin de paie")), "page 1 rouverte");
  assert.ok(text.includes(glyphs("conges restants")), "page 2 rouverte");
  assert.match(text, /Fiche de paie – Octobre/, "titre du document (Info) chiffré puis rouvert");
  assert.ok(strings >= 1);
});

test("deux protections du même PDF ne se ressemblent pas ; un PDF déjà protégé est refusé", async () => {
  const plain = await sample();
  const a = await encryptPdf(plain, "ABCD-EFGH-JKMN", rnd);
  const b = await encryptPdf(plain, "ABCD-EFGH-JKMN", rnd);
  assert.notDeepEqual(Buffer.from(a), Buffer.from(b));
  await assert.rejects(encryptPdf(a, "ABCD-EFGH-JKMN", rnd), /déjà protégé|encrypt/i);
  await assert.rejects(encryptPdf(plain, "court", rnd), /8 caractères/);
});

test("mot de passe proposé : 12 caractères faciles à dicter ; règles du mot de passe choisi", () => {
  const p = newPdfPassword(rnd(12));
  assert.match(p, /^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(pdfPasswordProblem(p), null);
  assert.match(pdfPasswordProblem("1234567")!, /8 caractères/);
  assert.match(pdfPasswordProblem("a".repeat(65))!, /64/);
  assert.match(pdfPasswordProblem("abcd\nefgh")!, /invisible/);
  assert.throws(() => newPdfPassword(rnd(4)));
});
