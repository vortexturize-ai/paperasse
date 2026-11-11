import { scanFromURLAsync } from "expo-camera";
import { Platform } from "react-native";
import { parse2DDoc, type TwoDDoc } from "../engine/twoDDoc";

/**
 * Chercher un code 2D-Doc dans une photo déjà prise : Android seulement (sur iOS, la lecture d'un DataMatrix
 * dans une image n'est pas fournie ; on vise alors le code avec l'appareil photo).
 */
export const canFindTwoDDocInPhotos = Platform.OS === "android";

/** Premier code 2D-Doc trouvé dans les photos données, ou null. Ne plante jamais : une image illisible est sautée. */
export async function findTwoDDoc(uris: string[]): Promise<TwoDDoc | null> {
  if (!canFindTwoDDocInPhotos) return null;
  for (const uri of uris) {
    try {
      for (const r of await scanFromURLAsync(uri, ["datamatrix"])) {
        const found = parse2DDoc(r.raw ?? r.data) ?? parse2DDoc(r.data);
        if (found) return found;
      }
    } catch {
      // image illisible : on essaie la suivante
    }
  }
  return null;
}
