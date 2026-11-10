import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { zlibSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { analyzeText } from "../src/engine/analyze.ts";
import { extractPdfText } from "../src/engine/pdf.ts";
import { entier, hasard } from "./outils/bruit.ts";

const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

/** PDF écrit à la main, objets dans l'ordre, avec une table de références approximative (le lecteur n'en a pas besoin). */
function handMade(objects: (string | { dict: string; stream: Uint8Array })[], trailerExtra = ""): Uint8Array {
  const parts: Uint8Array[] = [enc("%PDF-1.7\n")];
  objects.forEach((o, i) => {
    if (typeof o === "string") parts.push(enc(`${i + 1} 0 obj\n${o}\nendobj\n`));
    else parts.push(enc(`${i + 1} 0 obj\n${o.dict.replace(">>", ` /Length ${o.stream.length} >>`)}\nstream\n`), o.stream, enc("\nendstream\nendobj\n"));
  });
  parts.push(enc(`trailer\n<< /Root 1 0 R /Size ${objects.length + 1} ${trailerExtra}>>\n%%EOF\n`));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function letterPdf(lines: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const pageLines of lines) {
    const page = doc.addPage([595, 842]);
    pageLines.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 18, size: 11, font }));
  }
  return doc.save();
}

describe("PDF numériques (texte)", () => {
  test("avis d'impôt : accents, €, lignes, puis la fiche du moteur", async () => {
    const pdf = await letterPdf([[
      "DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES",
      "AVIS DE TAXE FONCIÈRE 2026",
      "Numéro fiscal : 12 34 567 890 123",
      "Date d’établissement : 31/08/2026",
      "Montant à payer : 612,00 €",
      "Date limite de paiement : 15/12/2026",
    ]]);
    const r = extractPdfText(pdf);
    assert.equal(r.pages, 1);
    assert.equal(r.encrypted, false);
    assert.match(r.text, /AVIS DE TAXE FONCIÈRE 2026/);
    assert.match(r.text, /Montant à payer : 612,00 €/);
    assert.equal(r.text.split("\n").length, 6, r.text);
    const a = analyzeText(r.text, { today: "2026-11-09", language: "fr" });
    assert.equal(a.type_document, "avis_imposition");
    assert.equal(a.montant, 612);
    assert.equal(a.date_limite, "2026-12-15");
  });

  test("plusieurs pages, flux compressés et objets compressés (PDF 1.5+)", async () => {
    const pdf = await letterPdf([["Page un : bonjour"], ["Page deux : au revoir"], ["Page trois : fin"]]);
    const r = extractPdfText(pdf);
    assert.equal(r.pages, 3);
    assert.deepEqual(r.text.split("\n\n"), ["Page un : bonjour", "Page deux : au revoir", "Page trois : fin"]);
  });

  test("mots posés un par un sur la même ligne : les espaces sont remis", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    let x = 50;
    for (const w of ["Date", "limite", ":", "20/11/2026"]) {
      page.drawText(w, { x, y: 700, size: 12, font });
      x += font.widthOfTextAtSize(w, 12) + 4;
    }
    const r = extractPdfText(await doc.save());
    assert.equal(r.text, "Date limite : 20/11/2026");
  });

  test("police à table Unicode (codes sur 2 octets, bfchar et bfrange)", () => {
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <00E9> <0002> <20AC> endbfchar
1 beginbfrange <0010> <0019> <0030> endbfrange
1 beginbfrange <0020> <0022> [<0043> <0041> <0046>] endbfrange
endcmap CMapName currentdict /CMap defineresource pop end end`;
    // « CAF : 12 € é » encodé avec les codes de la table.
    const content = "BT /F1 12 Tf 50 700 Td [<002000210022> -300 <0011> -50 <0012>] TJ 0 -20 Td <0002> Tj <0001> Tj ET";
    const pdf = handMade([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type0 /BaseFont /Arial /Encoding /Identity-H /ToUnicode 6 0 R >>",
      { dict: "<< >>", stream: enc(content) },
      { dict: "<< >>", stream: enc(cmap) },
    ]);
    const r = extractPdfText(pdf);
    assert.equal(r.text, "CAF 12\n€é");
  });

  test("encodage avec /Differences", () => {
    const content = "BT /F1 12 Tf 50 700 Td (\\001t\\002 \\003) Tj ET";
    const pdf = handMade([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Differences [1 /Eacute 2 /eacute 3 /Euro] >> >>",
      { dict: "<< /Filter /FlateDecode >>", stream: zlibSync(enc(content)) },
    ]);
    assert.equal(extractPdfText(pdf).text, "Été €");
  });
});

describe("PDF scanné, chiffré, abîmé", () => {
  test("PDF scanné : pas de texte, mais l'image JPEG de la page est rendue pour être lue comme une photo", () => {
    const fakeJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const pdf = handMade([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
      { dict: "<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>", stream: fakeJpeg },
      { dict: "<< >>", stream: enc("q 595 0 0 842 0 0 cm /Im0 Do Q") },
    ]);
    const r = extractPdfText(pdf);
    assert.equal(r.text, "");
    assert.equal(r.scans.length, 1);
    assert.deepEqual([...r.scans[0]], [...fakeJpeg]);
  });
  test("PDF protégé par mot de passe : signalé, pas lu", () => {
    const pdf = handMade(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [] /Count 0 >>", "<< /Filter /Standard /V 2 >>"], "/Encrypt 3 0 R ");
    assert.equal(extractPdfText(pdf).encrypted, true);
  });
  test("bombe de décompression : arrêtée, pas de blocage", () => {
    const bomb = zlibSync(new Uint8Array(80 * 1024 * 1024), { level: 9 });
    const pdf = handMade([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
      { dict: "<< /Filter /FlateDecode >>", stream: bomb },
    ]);
    const start = performance.now();
    const r = extractPdfText(pdf);
    assert.equal(r.text, "");
    assert.ok(performance.now() - start < 5000);
  });
  test("pas un PDF, PDF tronqué, octets au hasard : jamais de plantage", async () => {
    assert.equal(extractPdfText(new Uint8Array(0)).text, "");
    assert.equal(extractPdfText(enc("bonjour")).text, "");
    const good = await letterPdf([["Texte de test"]]);
    for (const cut of [10, 100, 500, good.length - 20]) extractPdfText(good.subarray(0, cut));
    const rnd = hasard(31);
    for (let i = 0; i < 300; i++) {
      const b = Uint8Array.from(good);
      for (let j = 0; j < entier(rnd, 1, 40); j++) b[entier(rnd, 0, b.length - 1)] = entier(rnd, 0, 255);
      extractPdfText(b);
    }
    for (let i = 0; i < 100; i++) {
      const junk = Uint8Array.from({ length: entier(rnd, 64, 5000) }, () => entier(rnd, 0, 255));
      junk.set(enc("%PDF-1.4 1 0 obj << /Type /Catalog >>"), 0);
      extractPdfText(junk);
    }
  });
});
