import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { ARCHIVE_LIMITS, baseName, unpackArchive } from "../src/engine/archive.ts";

test("export type Digiposte : dossiers, PDF, photos, texte ; fichiers cachés et inconnus écartés", () => {
  const zip = zipSync({
    "Mes documents/Impots/avis-2026.pdf": strToU8("%PDF-1.7 faux pdf"),
    "Mes documents/Logement/quittance.JPG": new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    "Mes documents/note.txt": strToU8("Rappel : payer la cantine"),
    "Mes documents/scan.png": new Uint8Array([137, 80, 78, 71]),
    "__MACOSX/._avis-2026.pdf": strToU8("junk"),
    "Mes documents/.DS_Store": strToU8("junk"),
    "Mes documents/virus.exe": strToU8("MZ"),
    "Mes documents/Vide/": new Uint8Array(0),
  });
  const r = unpackArchive(zip);
  assert.deepEqual(r.entries.map((e) => [e.name, e.kind]), [["avis-2026.pdf", "pdf"], ["note.txt", "text"], ["quittance.JPG", "image"], ["scan.png", "image"]]);
  assert.deepEqual(r.skipped, [{ name: "virus.exe", reason: "type de fichier non pris en charge" }]);
});

test("bombe ZIP : un fichier qui se décompresse énormément est refusé", () => {
  const zip = zipSync({ "piege.pdf": new Uint8Array(30 * 1024 * 1024) }, { level: 9 });
  const r = unpackArchive(zip);
  assert.equal(r.entries.length, 0);
  assert.equal(r.skipped[0].name, "piege.pdf");
});

test("trop de fichiers : la suite est écartée, rien ne plante", () => {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < 20; i++) files[`page-${i}.jpg`] = new Uint8Array([1, 2, 3, i]);
  const r = unpackArchive(zipSync(files), { ...ARCHIVE_LIMITS, maxFiles: 5 });
  assert.equal(r.entries.length, 5);
  assert.equal(r.skipped.length, 15);
  assert.deepEqual(r.entries.map((e) => e.name), ["page-0.jpg", "page-1.jpg", "page-2.jpg", "page-3.jpg", "page-4.jpg"], "ordre naturel");
});

test("archive abîmée ou pas une archive : message clair", () => {
  for (const b of [new Uint8Array(0), strToU8("PK pas vraiment"), new Uint8Array(1000).fill(7)]) {
    const r = unpackArchive(b);
    assert.equal(r.entries.length, 0);
  }
});

test("les noms ne servent jamais de chemin", () => {
  assert.equal(baseName("../../etc/passwd.txt"), "passwd.txt");
  assert.equal(baseName("C:\\Users\\x\\avis.pdf"), "avis.pdf");
  const r = unpackArchive(zipSync({ "../../sortie.txt": strToU8("x") }));
  assert.equal(r.entries[0].name, "sortie.txt");
});
