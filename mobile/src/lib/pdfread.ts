import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { extractPdfText } from "../engine/pdf";
import { readImages } from "./ocr";

function tmpDir(): Directory {
  const d = new Directory(Paths.cache, "pdf");
  d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Texte d'un PDF : son texte s'il en a, sinon ses pages scannées lues comme des photos. */
export async function readPdf(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const pdf = extractPdfText(bytes);
  if (pdf.encrypted) throw new Error("Ce PDF est protégé par un mot de passe : ouvre-le, puis fais une capture ou une photo.");
  if (pdf.text.replace(/\s/g, "").length >= 30) return pdf.text;
  if (pdf.scans.length > 0) {
    const dir = tmpDir();
    const uris: string[] = [];
    for (const scan of pdf.scans) {
      const f = new File(dir, `${randomUUID()}.jpg`);
      await f.write(scan);
      uris.push(f.uri);
    }
    try {
      return await readImages(uris);
    } finally {
      for (const u of uris) new File(u).delete();
    }
  }
  if (pdf.text.trim()) return pdf.text;
  throw new Error("Je n'ai pas trouvé de texte dans ce PDF : prends le papier en photo.");
}
