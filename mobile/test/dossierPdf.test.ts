import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildDossierPdf, watermarkText } from "../src/engine/dossierPdf.ts";
import { DOSSIERS } from "../src/engine/dossiers.ts";
import { extractPdfText } from "../src/engine/pdf.ts";

/** En-tête JPEG minimal (pdf-lib lit seulement les dimensions). */
function jpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
  ]);
}

function png(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const td = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height, 200);
  for (let y = 0; y < height; y++) raw[y * (width * 3 + 1)] = 0;
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))]),
  );
}

async function letterPdf(pages: number, text: string): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) d.addPage([595, 842]).drawText(`${text} ${i + 1}`, { x: 50, y: 700, size: 12, font: f });
  return d.save();
}

const MARK = watermarkText("Uniquement pour la location d’un logement", "  Agence   Martin ", "2026-11-10");

test("filigrane : motif, destinataire et date", () => {
  assert.equal(MARK, "Uniquement pour la location d’un logement — Agence Martin — 10/11/2026");
  assert.equal(watermarkText("Uniquement pour une embauche", "", "2026-01-05"), "Uniquement pour une embauche — 05/01/2026");
  for (const d of DOSSIERS) assert.match(d.purpose, /^Uniquement pour /, d.id);
});

test("un seul PDF : garde, photos, PDF copié, texte ; filigrane et numéro sur chaque page", async () => {
  const r = await buildDossierPdf({
    title: "Dossier location",
    watermark: MARK,
    date: "2026-11-10",
    pieces: [
      { label: "Pièce d’identité", title: "Carte d’identité", pages: [{ kind: "jpeg", bytes: jpeg(1200, 800) }, { kind: "png", bytes: png(30, 40) }] },
      { label: "Avis d’imposition", title: "Avis d’impôt 2026", pages: [{ kind: "pdf", bytes: await letterPdf(2, "Revenu fiscal") }] },
      { label: "Justificatif de domicile", title: "Quittance", pages: [{ kind: "text", text: "Quittance de loyer\nOctobre 2026 : 650,00 €" }] },
    ],
    missing: ["3 dernières fiches de paie"],
  });
  assert.equal(r.skipped.length, 0);
  assert.equal(r.pages, 1 + 2 + 2 + 1);
  const loaded = await PDFDocument.load(r.bytes);
  assert.equal(loaded.getPageCount(), 6);
  const sizes = loaded.getPages().map((p) => p.getSize());
  assert.ok(sizes[1].width > sizes[1].height, "photo en largeur : page à l’italienne");
  const text = extractPdfText(r.bytes).text.replace(/\s+/g, " ");
  for (let n = 1; n <= 6; n++) assert.ok(text.includes(`page ${n}/6`), `bandeau page ${n}`);
  assert.ok(text.includes("Agence Martin — 10/11/2026"));
  assert.ok(text.includes("Revenu fiscal 1") && text.includes("Revenu fiscal 2"));
  assert.ok(text.includes("650,00 €"));
  assert.ok(text.includes("Pièces fournies à part") && text.includes("3 dernières fiches de paie"));
});

test("pièce illisible ou protégée : signalée, le reste du dossier est fait", async () => {
  const r = await buildDossierPdf({
    title: "Dossier",
    watermark: MARK,
    date: "2026-11-10",
    pieces: [
      { label: "A", title: "PDF cassé", pages: [{ kind: "pdf", bytes: new TextEncoder().encode("%PDF-1.4 n'importe quoi") }] },
      { label: "B", title: "Photo cassée", pages: [{ kind: "jpeg", bytes: Uint8Array.from([1, 2, 3]) }] },
      { label: "C", title: "Bon", pages: [{ kind: "text", text: "ok" }] },
    ],
    missing: [],
  });
  assert.deepEqual(r.skipped.map((s) => s.title), ["PDF cassé", "Photo cassée"]);
  assert.equal(r.pages, 2);
});

test("long PDF : 40 pages au plus par pièce", async () => {
  const r = await buildDossierPdf({
    title: "Dossier",
    watermark: MARK,
    date: "2026-11-10",
    pieces: [{ label: "A", title: "Très long", pages: [{ kind: "pdf", bytes: await letterPdf(45, "p") }] }],
    missing: [],
  });
  assert.equal(r.pages, 41);
  assert.match(r.skipped[0].reason, /40 premières pages/);
});

test("raison affichée quand un papier ne convient pas : périmé, trop ancien, ou pas le bon contenu", async () => {
  const { whyNot } = await import("../src/engine/dossiers.ts");
  const req = DOSSIERS[0].requirements.find((r) => r.id === "impots")!;
  const base = { id: "x", title: "Avis", type: "avis_imposition" as const, category: "impots", issuer: null, organisme: null, deadline: null, amount: null, amountDirection: null, done: false, added: "2026-11-01" };
  assert.equal(whyNot({ ...base, docDate: "2026-08-01", expiry: null, text: "avis de taxe fonciere" }, req, "2026-11-10"), "contenu");
  assert.equal(whyNot({ ...base, docDate: "2023-08-01", expiry: null, text: "impot sur le revenu" }, req, "2026-11-10"), "ancien");
  assert.equal(whyNot({ ...base, docDate: "2026-08-01", expiry: "2026-10-01", text: "impot sur le revenu" }, req, "2026-11-10"), "perime");
  assert.equal(whyNot({ ...base, docDate: "2026-08-01", expiry: null, text: "Impôt sur le revenu" }, req, "2026-11-10"), null);
});

test("un papier de plusieurs pages partagé en un seul PDF : sans garde ni filigrane, pages dans l'ordre", async () => {
  const { buildPagesPdf, safeFileName } = await import("../src/engine/dossierPdf.ts");
  const r = await buildPagesPdf({
    title: "Fiche de paie – Octobre",
    pages: [{ kind: "jpeg", bytes: jpeg(800, 1200) }, { kind: "pdf", bytes: await letterPdf(2, "Bulletin") }, { kind: "png", bytes: png(20, 20) }],
  });
  assert.equal(r.pages, 4);
  assert.equal(r.skipped.length, 0);
  const loaded = await PDFDocument.load(r.bytes);
  assert.equal(loaded.getPageCount(), 4);
  assert.ok((loaded.getTitle() ?? "").startsWith("Fiche de paie"));
  const text = extractPdfText(r.bytes).text;
  assert.doesNotMatch(text, /page \d\/\d|Uniquement pour|Préparé le/);
  assert.ok(text.includes("Bulletin 1") && text.includes("Bulletin 2"));
  const partial = await buildPagesPdf({ title: "Mixte", pages: [{ kind: "jpeg", bytes: Uint8Array.from([1]) }, { kind: "png", bytes: png(10, 10) }] });
  assert.equal(partial.pages, 1);
  assert.equal(partial.skipped.length, 1);
  await assert.rejects(buildPagesPdf({ title: "Vide", pages: [{ kind: "jpeg", bytes: Uint8Array.from([1]) }] }), /Aucune page/);
  assert.equal(safeFileName('  Avis: "impôt" 2026 / CAF?  '), "Avis impôt 2026 CAF");
  assert.equal(safeFileName("..."), "Papier");
  assert.equal(safeFileName("x".repeat(100)).length, 60);
});

test("dossier pour un accompagnant : résumé « En bref » sur la garde, motifs filigranés, ligne de résumé par papier", async () => {
  const { COMPANION_PURPOSES, summaryLine } = await import("../src/engine/dossierPdf.ts");
  for (const p of COMPANION_PURPOSES) assert.match(p, /^Uniquement pour /);
  assert.equal(
    summaryLine({ title: "Avis de taxe foncière", issuer: "DGFiP", docDate: "2026-08-15", deadline: "2026-12-15", deadlineLabel: "payer", expiry: null, amount: 1612.5, amountDirection: "a_payer" }),
    "Avis de taxe foncière — DGFiP, du 15/08/2026 ; 1 612,50 € à payer avant le 15/12/2026",
  );
  assert.equal(
    summaryLine({ title: "Carte d’identité", issuer: null, docDate: null, deadline: null, expiry: "2031-01-10", amount: null, amountDirection: null }),
    "Carte d’identité ; valable jusqu’au 10/01/2031",
  );
  assert.equal(
    summaryLine({ title: "Courrier CAF", issuer: "CAF", docDate: "2026-11-03", deadline: "2026-11-18", deadlineLabel: "envoyer l’attestation", expiry: null, amount: null, amountDirection: null }),
    "Courrier CAF — CAF, du 03/11/2026 ; envoyer l’attestation avant le 18/11/2026",
  );
  assert.equal(
    summaryLine({ title: "Courrier CAF", issuer: "CAF", docDate: "2026-11-03", deadline: "2026-11-18", expiry: null, amount: null, amountDirection: null, done: true }),
    "Courrier CAF — CAF, du 03/11/2026 ; traité",
  );
  assert.equal(summaryLine({ title: "Remboursement", issuer: "CPAM", docDate: null, deadline: null, expiry: null, amount: 23.4, amountDirection: "a_recevoir" }), "Remboursement — CPAM ; 23,40 € à recevoir");
  const r = await buildDossierPdf({
    title: "Dossier — papiers de Maman",
    watermark: watermarkText(COMPANION_PURPOSES[0], "Mme Martin", "2026-11-11"),
    date: "2026-11-11",
    pieces: [{ label: "Avis d’impôt", title: "Avis 2026", pages: [{ kind: "text", text: "Revenu fiscal de référence : 12 000 €" }] }],
    missing: [],
    notes: ["Avis 2026 — DGFiP, du 15/08/2026 ; 612,00 € à payer avant le 15/12/2026"],
  });
  const text = extractPdfText(r.bytes).text.replace(/\s+/g, " ");
  assert.ok(text.includes("En bref"));
  assert.ok(text.includes("612,00 € à payer avant le 15/12/2026"));
  assert.ok(text.includes("Uniquement pour un accompagnement social — Mme Martin — 11/11/2026"));
  assert.ok(!text.includes("Pièces fournies à part"));
});
