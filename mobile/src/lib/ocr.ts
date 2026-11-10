import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface TextExtractorModule {
  isSupported: boolean;
  extractTextFromImage(uri: string): Promise<string[]>;
}

const native = requireOptionalNativeModule<TextExtractorModule>("ExpoTextExtractor");

export const canReadImages: boolean = Boolean(native?.isSupported);

export class OcrUnavailableError extends Error {
  constructor() {
    super("La lecture des photos marche dans l'app installée, pas dans Expo Go. Pour essayer ici, utilise « Coller un texte ».");
  }
}

/** La lecture a échoué (photo floue, trop sombre, module natif en panne) : message pour l'utilisateur. */
export class OcrFailedError extends Error {
  constructor(cause: unknown) {
    super("Je n'arrive pas à lire cette photo. Reprends-la bien à plat, sans reflet, avec plus de lumière.", { cause });
  }
}

/** Android attend un chemin de fichier (ou un content://), iOS une URL : on donne à chacun le sien. */
function nativePath(uri: string): string {
  if (Platform.OS !== "android" || !uri.startsWith("file://")) return uri;
  return decodeURI(uri.slice("file://".length));
}

/** Lit toutes les pages dans l'ordre et renvoie le texte complet. */
export async function readImages(uris: string[]): Promise<string> {
  if (!native || !native.isSupported) throw new OcrUnavailableError();
  const pages: string[] = [];
  for (const uri of uris) {
    let blocks: string[];
    try {
      blocks = await native.extractTextFromImage(nativePath(uri));
    } catch (e) {
      if (__DEV__) console.warn("Lecture de la photo impossible :", e);
      throw new OcrFailedError(e);
    }
    pages.push(blocks.join("\n"));
  }
  return pages.join("\n\n");
}
