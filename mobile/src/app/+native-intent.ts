export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (new URL(path).hostname === "expo-sharing") return "/recevoir";
  } catch {
    // Chemin relatif (« /document/… ») : pas une URL complète, on le garde.
  }
  return path;
}
