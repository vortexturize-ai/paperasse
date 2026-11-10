import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { PendingPage } from "./types";

// Les documents vivent dans <Documents de l'app>/docs/<id du document>/.
// iOS et Android chiffrent ce dossier avec le verrouillage du téléphone.
const ROOT = "docs";
/** Côté le plus long des photos envoyées : assez pour lire un petit texte, léger à envoyer. */
export const MAX_EDGE = 2000;
export const MAX_PDF_BYTES = 15_000_000;

export function fileFor(path: string): File {
  return new File(Paths.document, path);
}

export function uriFor(path: string): string {
  return fileFor(path).uri;
}

/** Réduit et compresse une photo en JPEG. Renvoie un fichier temporaire. */
export async function prepareImage(uri: string, width: number, height: number): Promise<PendingPage> {
  let ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    ctx = width >= height ? ctx.resize({ width: MAX_EDGE }) : ctx.resize({ height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return { uri: saved.uri, mime: "image/jpeg", name: "photo.jpg" };
}

export function preparePdf(uri: string, name: string, size: number | undefined): PendingPage {
  const bytes = size ?? new File(uri).size;
  if (bytes > MAX_PDF_BYTES) throw new Error("Ce PDF est trop lourd (15 Mo maximum).");
  return { uri, mime: "application/pdf", name };
}

/** Copie les pages dans le dossier du document. Renvoie les chemins relatifs à enregistrer. */
export async function storePages(docId: string, pages: PendingPage[]): Promise<{ path: string; mime: string }[]> {
  const dir = new Directory(Paths.document, ROOT, docId);
  dir.create({ intermediates: true, idempotent: true });
  const stored: { path: string; mime: string }[] = [];
  for (const [i, page] of pages.entries()) {
    const ext = page.mime === "application/pdf" ? "pdf" : "jpg";
    const name = `page-${String(i + 1).padStart(2, "0")}.${ext}`;
    await new File(page.uri).copy(new File(dir, name));
    stored.push({ path: `${ROOT}/${docId}/${name}`, mime: page.mime });
  }
  return stored;
}

export async function readBase64(path: string): Promise<string> {
  return fileFor(path).base64();
}

/**
 * Efface seulement les pages données, puis le dossier s'il est vide. Le coffre leurre et le vrai coffre
 * partagent le dossier docs/ : un même papier restauré dans les deux ne doit jamais perdre les pages de l'autre.
 */
export function deletePages(docId: string, paths: string[]): void {
  for (const p of paths) {
    if (!p.startsWith(`${ROOT}/${docId}/`) || p.includes("..")) continue;
    try {
      const f = fileFor(p);
      if (f.exists) f.delete();
    } catch {
      // déjà effacé
    }
  }
  try {
    const dir = new Directory(Paths.document, ROOT, docId);
    if (dir.exists && dir.list().length === 0) dir.delete();
  } catch {
    // dossier occupé ou déjà parti
  }
}

/** Pour un papier tout neuf (identifiant tiré à l'instant) dont l'enregistrement a échoué. */
export function deleteDocumentFiles(docId: string): void {
  const dir = new Directory(Paths.document, ROOT, docId);
  if (dir.exists) dir.delete();
}

/** Ouvre le fichier dans l'aperçu du téléphone (Quick Look sur iOS, appli PDF sur Android). */
export async function openPreview(path: string): Promise<void> {
  await fileFor(path).preview();
}
