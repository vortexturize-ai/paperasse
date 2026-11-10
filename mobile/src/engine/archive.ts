import { unzipSync, type UnzipFileInfo } from "fflate";

export type EntryKind = "image" | "pdf" | "text";

export interface ArchiveEntry {
  name: string;
  kind: EntryKind;
  mime: string;
  data: Uint8Array;
}

export interface ArchiveResult {
  entries: ArchiveEntry[];
  /** Fichiers ignorés et pourquoi (affiché à l'utilisateur). */
  skipped: { name: string; reason: string }[];
}

export const ARCHIVE_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 300 * 1024 * 1024,
  /** Un fichier qui se décompresse plus de 200 fois sa taille est suspect. */
  maxRatio: 200,
};

const KINDS: [RegExp, EntryKind, string][] = [
  [/\.(jpe?g)$/i, "image", "image/jpeg"],
  [/\.png$/i, "image", "image/png"],
  [/\.webp$/i, "image", "image/webp"],
  [/\.(heic|heif)$/i, "image", "image/heic"],
  [/\.pdf$/i, "pdf", "application/pdf"],
  [/\.txt$/i, "text", "text/plain"],
];

export function kindOfName(name: string): { kind: EntryKind; mime: string } | null {
  for (const [re, kind, mime] of KINDS) if (re.test(name)) return { kind, mime };
  return null;
}

/** Nom affichable, sans dossiers : « Impots/2025/avis.pdf » → « avis.pdf ». */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function unpackArchive(bytes: Uint8Array, limits = ARCHIVE_LIMITS): ArchiveResult {
  const skipped: { name: string; reason: string }[] = [];
  let total = 0;
  let count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f: UnzipFileInfo) => {
        const name = f.name;
        if (name.endsWith("/")) return false; // dossier
        if (/(^|\/)__MACOSX\//.test(name) || baseName(name).startsWith(".")) return false; // fichiers cachés et métadonnées Mac
        if (!kindOfName(name)) {
          skipped.push({ name: baseName(name), reason: "type de fichier non pris en charge" });
          return false;
        }
        if (f.originalSize > limits.maxFileBytes) {
          skipped.push({ name: baseName(name), reason: "trop gros" });
          return false;
        }
        if (f.size > 0 && f.originalSize / f.size > limits.maxRatio && f.originalSize > 1024 * 1024) {
          skipped.push({ name: baseName(name), reason: "compression suspecte" });
          return false;
        }
        if (count >= limits.maxFiles || total + f.originalSize > limits.maxTotalBytes) {
          skipped.push({ name: baseName(name), reason: "archive trop grande" });
          return false;
        }
        count++;
        total += f.originalSize;
        return true;
      },
    });
  } catch {
    return { entries: [], skipped: [{ name: "archive", reason: "fichier ZIP abîmé ou protégé par mot de passe" }] };
  }
  const entries: ArchiveEntry[] = [];
  for (const [name, data] of Object.entries(files)) {
    const k = kindOfName(name);
    if (!k) continue;
    // La taille réelle doit correspondre à la taille annoncée (une archive qui ment est rejetée).
    if (data.length > limits.maxFileBytes) {
      skipped.push({ name: baseName(name), reason: "trop gros" });
      continue;
    }
    entries.push({ name: baseName(name), kind: k.kind, mime: k.mime, data });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  return { entries, skipped };
}
