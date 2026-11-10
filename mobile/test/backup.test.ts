import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  BackupError,
  BackupWriter,
  CHUNK_SIZE,
  ENTRY_DATA,
  backupKey,
  fileEntry,
  formatRecoveryCode,
  newHeader,
  newRecoveryCode,
  normalizeRecoveryCode,
  planRestore,
  readBackupBytes,
  readU32,
  recoveryCodeProblem,
  validateBackupData,
  type Aead,
  type BackupErrorCode,
} from "../src/engine/backup.ts";
import { hasard } from "./outils/bruit.ts";

const subtle = webcrypto.subtle;
/** Copie sur un ArrayBuffer simple (ce que demandent les types de WebCrypto). */
const buf = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);
const aead: Aead = {
  async seal(key, iv, plain, aad) {
    const k = await subtle.importKey("raw", buf(key), "AES-GCM", false, ["encrypt"]);
    return new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(aad) }, k, buf(plain)));
  },
  async open(key, iv, sealed, aad) {
    const k = await subtle.importKey("raw", buf(key), "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(aad) }, k, buf(sealed)));
  },
};

function bytes(n: number, seed: number): Uint8Array {
  const r = hasard(seed);
  return Uint8Array.from({ length: n }, () => Math.floor(r() * 256));
}

const CODE = newRecoveryCode(bytes(28, 1));

function doc(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: "2026-11-01T10:00:00.000Z",
    title: `Papier ${id}`,
    doc_type: "courrier",
    category: "administratif",
    urgency: "aucune",
    analysis_status: "done",
    actions: "[]",
    key_facts: "[]",
    keywords: "[]",
    search_text: "papier",
    issuer: "CAF",
    doc_date: "2026-11-01",
    summary: null,
    deadline: null,
    deadline_label: null,
    deadline_quote: null,
    expiry_date: null,
    amount_direction: null,
    full_text: "Bonjour",
    warning: null,
    analysis_lang: "fr",
    to_do: 0,
    is_done: 0,
    is_favorite: 1,
    amount: 12.5,
    notification_ids: '["rappel-1"]',
    ...extra,
  };
}

const DATA = {
  v: 1,
  schema: 1,
  people: [{ id: "p1", name: "Maman", relation: "parent" }],
  documents: [doc("d1", { person_id: "p1" }), doc("d2")],
  files: [
    { id: "f1", document_id: "d1", position: 0, mime: "image/jpeg" },
    { id: "f2", document_id: "d1", position: 1, mime: "image/jpeg" },
    { id: "f3", document_id: "d2", position: 0, mime: "application/pdf" },
  ],
  settings: [
    ["language", "français"],
    ["lock_enabled", "1"],
  ],
};

const FILES: Record<string, Uint8Array> = { f1: bytes(2_500_000, 2), f2: bytes(10, 3), f3: bytes(CHUNK_SIZE - 7, 4) };

async function build(code = CODE): Promise<{ file: Uint8Array; chunks: Uint8Array[]; header: Uint8Array }> {
  const w = new BackupWriter(backupKey(code), newHeader("sauvegarde", "2026-11-10T01:00:00.000Z", bytes(8, 5)), aead);
  const chunks: Uint8Array[] = [];
  chunks.push(...(await w.add(ENTRY_DATA, new TextEncoder().encode(JSON.stringify(DATA)))));
  for (const [id, b] of Object.entries(FILES)) chunks.push(...(await w.add(fileEntry(id), b)));
  chunks.push(...(await w.finish()));
  const file = new Uint8Array(w.headerBytes.length + chunks.reduce((n, c) => n + c.length, 0));
  file.set(w.headerBytes);
  let at = w.headerBytes.length;
  for (const c of chunks) {
    file.set(c, at);
    at += c.length;
  }
  return { file, chunks, header: w.headerBytes };
}

async function rejects(p: Promise<unknown>, code: BackupErrorCode | BackupErrorCode[]): Promise<void> {
  const codes = Array.isArray(code) ? code : [code];
  await assert.rejects(p, (e: unknown) => e instanceof BackupError && codes.includes(e.code) && e.message.length > 10);
}

test("clé de secours : 6 groupes de 5, relue malgré minuscules, espaces, O/0 et I/L/1", () => {
  assert.match(CODE, /^([0-9A-HJKMNP-TV-Z]{5}-){5}[0-9A-HJKMNP-TV-Z]{5}$/);
  assert.equal(recoveryCodeProblem(CODE), null);
  const plain = CODE.replace(/-/g, "");
  assert.equal(normalizeRecoveryCode(` ${CODE.toLowerCase().replace(/-/g, " ")} `), plain);
  const withO = plain.replace(/0/g, "O").replace(/1/g, "l");
  assert.equal(normalizeRecoveryCode(withO), plain);
  assert.equal(formatRecoveryCode(plain), CODE);
  assert.notEqual(newRecoveryCode(bytes(28, 9)), CODE);
});

test("clé de secours : faute de frappe repérée avant même d'ouvrir le fichier", () => {
  const plain = CODE.replace(/-/g, "");
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let tried = 0;
  let caught = 0;
  for (let i = 0; i < plain.length; i++)
    for (const c of alphabet) {
      if (c === plain[i]) continue;
      tried++;
      if (recoveryCodeProblem(plain.slice(0, i) + c + plain.slice(i + 1))) caught++;
    }
  assert.ok(caught / tried > 0.99, `${caught}/${tried}`);
  assert.match(recoveryCodeProblem(plain.slice(0, 25)) ?? "", /Il manque 5 caractères/);
  assert.match(recoveryCodeProblem(plain + "A") ?? "", /trop/);
  assert.match(recoveryCodeProblem(plain.slice(0, 29) + "U") ?? "", /n’existe pas/);
  assert.throws(() => backupKey("ABC"), BackupError);
});

test("aller-retour : tout revient à l'identique, morceaux de 1 Mo au plus", async () => {
  const { file, chunks } = await build();
  for (const c of chunks) assert.ok(readU32(c) <= CHUNK_SIZE + 16);
  assert.ok(chunks.length >= 4);
  const { header, entries } = await readBackupBytes(file, CODE.toLowerCase(), aead);
  assert.equal(header.type, "sauvegarde");
  assert.deepEqual(entries.map((e) => e.name), [ENTRY_DATA, "fichier/f1", "fichier/f2", "fichier/f3"]);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(entries[0].data)), DATA);
  for (const [id, b] of Object.entries(FILES)) assert.deepEqual(entries.find((e) => e.name === `fichier/${id}`)?.data, b);
  // Le contenu n'apparaît nulle part en clair.
  const asText = new TextDecoder("latin1").decode(file);
  assert.ok(!asText.includes("Papier d1") && !asText.includes("français"));
});

test("mauvaise clé : refusée clairement", async () => {
  const { file } = await build();
  await rejects(readBackupBytes(file, newRecoveryCode(bytes(28, 77)), aead), "cle");
});

test("fichier trafiqué, coupé, mélangé ou rallongé : refusé", async () => {
  const { file, chunks, header } = await build();
  const flip = (at: number) => {
    const f = file.slice();
    f[at] ^= 1;
    return f;
  };
  await rejects(readBackupBytes(flip(header.length - 3), CODE, aead), ["cle", "format"]); // en-tête
  await rejects(readBackupBytes(flip(header.length + 4 + 100), CODE, aead), "cle"); // 1er morceau
  await rejects(readBackupBytes(flip(header.length + chunks[0].length + chunks[1].length + 50), CODE, aead), "abime");
  await rejects(readBackupBytes(flip(file.length - 1), CODE, aead), "abime"); // dernier morceau
  await rejects(readBackupBytes(file.subarray(0, file.length - chunks.at(-1)!.length), CODE, aead), "abime"); // fin retirée
  await rejects(readBackupBytes(file.subarray(0, file.length - 10), CODE, aead), "abime"); // coupé au milieu
  const swapped = new Uint8Array([...header, ...chunks[1], ...chunks[0], ...chunks.slice(2).flatMap((c) => [...c])]);
  await rejects(readBackupBytes(swapped, CODE, aead), ["cle", "abime"]);
  const longer = new Uint8Array([...file, ...chunks.at(-1)!]);
  await rejects(readBackupBytes(longer, CODE, aead), "abime");
});

test("pas une sauvegarde, ou version plus récente : message adapté", async () => {
  await rejects(readBackupBytes(bytes(5000, 8), CODE, aead), "format");
  await rejects(readBackupBytes(new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj"), CODE, aead), "format");
  const { file, header } = await build();
  const json = JSON.parse(new TextDecoder().decode(header.subarray(21)));
  const future = new TextEncoder().encode(JSON.stringify({ ...json, v: 9 }));
  const h = new Uint8Array([...header.subarray(0, 17), 0, 0, 0, future.length, ...future]);
  await rejects(readBackupBytes(new Uint8Array([...h, ...file.subarray(header.length)]), CODE, aead), "version");
});

test("limites : trop d'éléments refusés", async () => {
  const { file } = await build();
  await rejects(readBackupBytes(file, CODE, aead, { maxEntries: 2, maxEntryBytes: 1e9, maxTotalBytes: 1e10 }), "trop_gros");
  await rejects(readBackupBytes(file, CODE, aead, { maxEntries: 100, maxEntryBytes: 1000, maxTotalBytes: 1e10 }), "trop_gros");
});

test("contenu vérifié : rappels remis à zéro, réglages filtrés, pièges refusés", () => {
  const d = validateBackupData(DATA);
  assert.equal(d.documents.length, 2);
  assert.equal(d.documents[0].notification_ids, "[]");
  assert.deepEqual(d.settings, [["language", "français"]]);
  assert.equal(d.documents[0].person_id, "p1");
  assert.equal(d.documents[1].person_id, null);
  // Ancienne sauvegarde sans proches : acceptée ; personne inconnue : papier remis à « moi ».
  const old = validateBackupData({ ...DATA, people: undefined, documents: [doc("d1", { person_id: "inconnu" })], files: [] });
  assert.deepEqual(old.people, []);
  assert.equal(old.documents[0].person_id, null);
  assert.throws(() => validateBackupData({ ...DATA, people: [{ id: "../x", name: "A", relation: "parent" }] }), BackupError);
  const traps: unknown[] = [
    null,
    "texte",
    { ...DATA, documents: "x" },
    { ...DATA, documents: [doc("../../etc")] },
    { ...DATA, documents: [doc("d1"), doc("d1")] },
    { ...DATA, documents: [doc("d1", { title: 42 })] },
    { ...DATA, documents: [doc("d1", { full_text: "x".repeat(600_000) })] },
    { ...DATA, files: [{ id: "f1", document_id: "inconnu", position: 0, mime: "image/jpeg" }] },
    { ...DATA, files: [{ id: "f1", document_id: "d1", position: 0, mime: "application/x-sh" }] },
    { ...DATA, files: [{ id: "a/b", document_id: "d1", position: 0, mime: "image/jpeg" }] },
    { ...DATA, files: [{ id: "f1", document_id: "d1", position: -1, mime: "image/jpeg" }] },
  ];
  for (const t of traps) assert.throws(() => validateBackupData(t), BackupError, JSON.stringify(t)?.slice(0, 80));
  assert.throws(() => validateBackupData({ ...DATA, v: 5 }), (e: unknown) => e instanceof BackupError && e.code === "version");
});

test("restauration : on ajoute ce qui manque, sans rien écraser", () => {
  const d = validateBackupData(DATA);
  const all = planRestore(d, new Set(), new Set(["f1", "f2", "f3"]));
  assert.equal(all.documents.length, 2);
  assert.deepEqual(all.people.map((p) => p.name), ["Maman"]);
  assert.deepEqual(planRestore(d, new Set(["d1"]), new Set()).people, [], "Maman seulement si un de ses papiers arrive");
  assert.equal(all.files.length, 3);
  const part = planRestore(d, new Set(["d1"]), new Set(["f1", "f2", "f3"]));
  assert.deepEqual(part.documents.map((x) => x.id), ["d2"]);
  assert.deepEqual(part.files.map((x) => x.id), ["f3"]);
  assert.equal(part.skipped, 1);
  assert.deepEqual(planRestore(d, new Set(), new Set(["f1"])).files.map((x) => x.id), ["f1"]);
});

test("fiche de secours et kit d'urgence : PDF lisible, clé et contenu dedans", async () => {
  const { recoverySheet, winAnsi } = await import("../src/engine/sheet.ts");
  const { extractPdfText } = await import("../src/engine/pdf.ts");
  const kit = await recoverySheet({
    type: "kit",
    code: CODE,
    date: "2026-11-10",
    fileName: "Paperasse-kit-urgence-2026-11-10.paperasse",
    papers: ["Carte d’identité", "Attestation Ameli", "بطاقة", ...Array.from({ length: 130 }, (_, i) => `Papier ${i + 1}`)],
    forName: "Leïla",
    message: "Tout est là, maman.",
  });
  assert.equal(new TextDecoder().decode(kit.subarray(0, 5)), "%PDF-");
  const text = extractPdfText(kit).text.replace(/\s+/g, " ");
  assert.ok(text.includes(CODE), "clé présente");
  assert.ok(text.includes("Kit d’urgence Paperasse") && text.includes("pour Leïla"));
  assert.ok(text.includes("Carte d’identité") && text.includes("… et 13 autres"));
  const sheet = await recoverySheet({ type: "sauvegarde", code: CODE, date: "2026-11-10", fileName: "x.paperasse" });
  assert.ok(extractPdfText(sheet).text.includes("Fiche de secours"));
  assert.equal(winAnsi("بطاقة  Été\n€ 😀"), "????? Été € ?");
});
