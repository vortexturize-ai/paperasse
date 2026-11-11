import { CameraView } from "expo-camera";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { cropRect, decodePngGray, findPage, fromBase64, photoQuality, type CropBox, type PhotoProblem } from "../engine/scan";
import { prepareCropped } from "./files";
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
    let saved;
    try {
      saved = await small.saveAsync({ format: SaveFormat.PNG, base64: true });
    } finally {
      small.release();
    }
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
  return prepareCropped(uri, box ? (w, h) => cropRect(box, w, h) : null);
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
