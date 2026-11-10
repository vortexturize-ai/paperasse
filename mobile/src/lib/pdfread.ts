import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { extractPdfText } from "../engine/pdf";
import { readImages } from "./ocr";

function tmpDir(): Directory {
  const d = new Directory(Paths.cache, "pdf");
  d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Texte d'un PDF : le texte de ses pages, plus ses pages scannées (ou à texte illisible) lues comme des photos. */
export async function readPdf(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const pdf = extractPdfText(bytes);
  if (pdf.encrypted) throw new Error("Ce PDF est protégé par un mot de passe : ouvre-le, puis fais une capture ou une photo.");
  let scanned = "";
  if (pdf.scans.length > 0) {
    const dir = tmpDir();
    const uris: string[] = [];
    for (const scan of pdf.scans) {
      const f = new File(dir, `${randomUUID()}.jpg`);
      await f.write(scan);
      uris.push(f.uri);
    }
    try {
      scanned = await readImages(uris);
    } catch (e) {
      // Les pages à texte suffisent si la lecture des images n'est pas possible ici.
      if (!pdf.text.trim()) throw e;
    } finally {
      for (const u of uris) new File(u).delete();
    }
  }
  const text = [pdf.text.trim(), scanned.trim()].filter(Boolean).join("\n\n");
  if (text) return text;
  throw new Error("Je n'ai pas trouvé de texte dans ce PDF : prends le papier en photo.");
}
