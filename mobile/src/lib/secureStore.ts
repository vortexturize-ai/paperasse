import * as Native from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Coffre matériel du téléphone (Keychain iOS, Keystore Android), mêmes fonctions qu'expo-secure-store.
 * Le navigateur (aperçu de développement, jamais distribué) n'en a pas : les valeurs vont dans le stockage
 * local du navigateur, en clair. Rien de vrai n'y est rangé ; sur téléphone, rien ne change.
 */
export type SecureStoreOptions = Native.SecureStoreOptions;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = Native.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

const WEB_PREFIX = "paperasse.apercu.";
const web = Platform.OS === "web";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null> {
  if (!web) return Native.getItemAsync(key, options);
  return storage()?.getItem(WEB_PREFIX + key) ?? null;
}

export async function setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void> {
  if (!web) return Native.setItemAsync(key, value, options);
  storage()?.setItem(WEB_PREFIX + key, value);
}

export async function deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void> {
  if (!web) return Native.deleteItemAsync(key, options);
  storage()?.removeItem(WEB_PREFIX + key);
}
