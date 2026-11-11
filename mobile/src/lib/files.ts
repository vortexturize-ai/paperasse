import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
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

/** Fichier temporaire de l'app (dossier cache : appareil photo, galerie, PDF choisi, image réduite). */
export function isTempUri(uri: string): boolean {
  try {
    return uri.startsWith(Paths.cache.uri);
  } catch {
    return false;
  }
}

/** Efface une copie temporaire une fois qu'elle ne sert plus. Ne touche jamais aux photos de la galerie. */
export function discardTemp(uri: string | null | undefined): void {
  if (!uri || !isTempUri(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // déjà parti
  }
}

/** Image rendue → JPEG réduit dans le cache. La mémoire native est libérée tout de suite. */
async function saveJpeg(ctx: ReturnType<typeof ImageManipulator.manipulate>): Promise<PendingPage> {
  const image: ImageRef = await ctx.renderAsync();
  try {
    const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return { uri: saved.uri, mime: "image/jpeg", name: "photo.jpg" };
  } finally {
    image.release();
  }
}

/** Réduit et compresse une photo en JPEG (dimensions connues). Renvoie un fichier temporaire. */
export async function prepareImage(uri: string, width: number, height: number): Promise<PendingPage> {
  let ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    ctx = width >= height ? ctx.resize({ width: MAX_EDGE }) : ctx.resize({ height: MAX_EDGE });
  }
  return saveJpeg(ctx);
}

/**
 * Photo de n'importe quelle taille → JPEG réduit (sans agrandir une petite image).
 * L'image n'est décodée qu'une fois : la copie réduite part de l'image déjà en mémoire.
 */
export async function prepareImageAuto(uri: string): Promise<PendingPage> {
  const full = await ImageManipulator.manipulate(uri).renderAsync();
  try {
    let ctx = ImageManipulator.manipulate(full);
    if (Math.max(full.width, full.height) > MAX_EDGE) {
      ctx = full.width >= full.height ? ctx.resize({ width: MAX_EDGE }) : ctx.resize({ height: MAX_EDGE });
    }
    return await saveJpeg(ctx);
  } finally {
    full.release();
  }
}

/** Recadre (si un cadre est donné), réduit et compresse en JPEG, en une seule lecture de l'image. */
export async function prepareCropped(uri: string, crop: ((width: number, height: number) => { originX: number; originY: number; width: number; height: number }) | null): Promise<PendingPage> {
  const full = await ImageManipulator.manipulate(uri).renderAsync(); // dimensions une fois l'image redressée
  try {
    let ctx = ImageManipulator.manipulate(full);
    let w = full.width;
    let h = full.height;
    if (crop) {
      const r = crop(w, h);
      ctx = ctx.crop(r);
      w = r.width;
      h = r.height;
    }
    if (Math.max(w, h) > MAX_EDGE) ctx = w >= h ? ctx.resize({ width: MAX_EDGE }) : ctx.resize({ height: MAX_EDGE });
    return await saveJpeg(ctx);
  } finally {
    full.release();
  }
}

export function preparePdf(uri: string, name: string, size: number | undefined): PendingPage {
  const bytes = size ?? new File(uri).size;
  if (bytes > MAX_PDF_BYTES) throw new Error("Ce PDF est trop lourd (15 Mo maximum).");
  return { uri, mime: "application/pdf", name };
}

/**
 * Copie les pages dans le dossier du document, puis efface les copies temporaires du cache.
 * Renvoie les chemins relatifs à enregistrer.
 */
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
  for (const page of pages) discardTemp(page.uri);
  return stored;
}

/** Pages prises puis abandonnées : rien ne doit traîner dans le cache. */
export function discardPages(pages: PendingPage[]): void {
  for (const page of pages) discardTemp(page.uri);
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
  try {
    const dir = new Directory(Paths.document, ROOT, docId);
    if (dir.exists) dir.delete();
  } catch {
    // rien à effacer
  }
}

/** Dossiers temporaires de l'app (imports, PDF, restaurations, sauvegardes) : vidés à l'ouverture du coffre. */
const TEMP_DIRS = ["import", "pdf", "sauvegardes", "dossiers"];

/** Efface ce qu'une session interrompue a pu laisser dans le cache (pages déchiffrées d'une restauration, copies). */
export function sweepTempDirs(): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (!(entry instanceof Directory)) continue;
      const name = entry.name;
      if (TEMP_DIRS.includes(name) || name.startsWith("restauration-")) {
        try {
          entry.delete();
        } catch {
          // dossier encore utilisé
        }
      }
    }
  } catch {
    // cache illisible : rien à faire
  }
}

/** Ouvre le fichier dans l'aperçu du téléphone (Quick Look sur iOS, appli PDF sur Android). */
export async function openPreview(path: string): Promise<void> {
  await fileFor(path).preview();
}
