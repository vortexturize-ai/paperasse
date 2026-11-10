import { CameraView } from "expo-camera";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { cropRect, decodePngGray, findPage, fromBase64, photoQuality, type CropBox, type PhotoProblem } from "../engine/scan";
import { MAX_EDGE } from "./files";
import { withLockSuspended } from "./suspend";
import type { PendingPage } from "./types";

export interface Inspection {
  problems: PhotoProblem[];
  box: CropBox | null;
}

/** Regarde la photo (copie de 320 px). Renvoie null si on ne peut pas juger : on ne bloque jamais l'ajout. */
export async function inspectPhoto(uri: string): Promise<Inspection | null> {
  try {
    const small = await ImageManipulator.manipulate(uri).resize({ width: 320 }).renderAsync();
    const saved = await small.saveAsync({ format: SaveFormat.PNG, base64: true });
    try {
      new File(saved.uri).delete();
    } catch {
      // copie temporaire
    }
    if (!saved.base64) return null;
    const img = decodePngGray(fromBase64(saved.base64));
    const quality = photoQuality(img);
    const box = findPage(img);
    return { problems: quality.problems, box };
  } catch {
    return null;
  }
}

/** Recadre sur la feuille (si on l'a trouvée), réduit et compresse en JPEG. */
export async function prepareScan(uri: string, box: CropBox | null): Promise<PendingPage> {
  const full = await ImageManipulator.manipulate(uri).renderAsync(); // dimensions une fois l'image redressée
  let ctx = ImageManipulator.manipulate(uri);
  let w = full.width;
  let h = full.height;
  if (box) {
    const r = cropRect(box, w, h);
    ctx = ctx.crop(r);
    w = r.width;
    h = r.height;
  }
  if (Math.max(w, h) > MAX_EDGE) ctx = w >= h ? ctx.resize({ width: MAX_EDGE }) : ctx.resize({ height: MAX_EDGE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return { uri: saved.uri, mime: "image/jpeg", name: "photo.jpg" };
}

/**
 * Scanner du téléphone (ML Kit sur Android, VisionKit sur iOS) : bords trouvés, page redressée, plusieurs pages.
 * `unavailable` : il a répondu « rien » tout de suite (pas de services Google…) ; sinon la personne a annulé.
 */
export async function systemScan(): Promise<{ pages: string[]; unavailable: boolean }> {
  const started = Date.now();
  try {
    const scan = await withLockSuspended(() => CameraView.scanDocumentAsync({ quality: 0.9 }));
    if (scan?.pages.length) return { pages: scan.pages, unavailable: false };
  } catch {
    // pas de scanner
  }
  return { pages: [], unavailable: Date.now() - started < 1500 };
}

/** Page du scanner du téléphone : réduite et compressée comme les autres photos. */
export async function prepareSystemScanPage(uri: string): Promise<PendingPage> {
  return prepareScan(uri, null);
}
