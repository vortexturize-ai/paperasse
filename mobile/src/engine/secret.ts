import { pbkdf2, pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export interface PinRecord {
  v: 1;
  salt: string;
  hash: string;
  iter: number;
}

// Un code de 4 à 8 chiffres ne résiste pas à un essai hors ligne, quel que soit le nombre de tours :
// la vraie protection, c'est le coffre matériel du téléphone (l'empreinte y est rangée) et l'attente croissante
// après des erreurs. Les tours ne sont qu'une ceinture en plus, réglés pour rester rapides sur un téléphone.
export const PIN_ITERATIONS = 4_000;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/.test(hex)) throw new Error("hexadécimal invalide");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

/** Un code de 4 à 8 chiffres, pas trop facile à deviner. Renvoie la raison du refus, ou null. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "Le code doit avoir de 4 à 8 chiffres.";
  if (/^(\d)\1+$/.test(pin)) return "Évite un code avec le même chiffre partout.";
  const asc = "0123456789012345";
  const desc = "9876543210987654";
  if (asc.includes(pin) || desc.includes(pin)) return "Évite une suite de chiffres (1234, 9876…).";
  if (/^(19|20)\d{2}$/.test(pin)) return "Évite une année : c'est la première chose qu'on essaie.";
  return null;
}

export function hashPin(pin: string, salt: Uint8Array, iter = PIN_ITERATIONS): PinRecord {
  const hash = pbkdf2(sha256, pin, salt, { c: iter, dkLen: 32 });
  return { v: 1, salt: toHex(salt), hash: toHex(hash), iter };
}

/** Comparaison en temps constant (ne révèle pas où la différence se trouve). */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function verifyPin(pin: string, rec: PinRecord | null): boolean {
  if (!rec || rec.v !== 1 || !/^\d{4,8}$/.test(pin)) return false;
  try {
    const h = pbkdf2(sha256, pin, fromHex(rec.salt), { c: rec.iter, dkLen: 32 });
    return sameBytes(h, fromHex(rec.hash));
  } catch {
    return false;
  }
}

/** Versions qui laissent respirer l'écran pendant le calcul (téléphone). */
export async function hashPinAsync(pin: string, salt: Uint8Array, iter = PIN_ITERATIONS): Promise<PinRecord> {
  const hash = await pbkdf2Async(sha256, pin, salt, { c: iter, dkLen: 32, asyncTick: 16 });
  return { v: 1, salt: toHex(salt), hash: toHex(hash), iter };
}

export async function verifyPinAsync(pin: string, rec: PinRecord | null): Promise<boolean> {
  if (!rec || rec.v !== 1 || !/^\d{4,8}$/.test(pin)) return false;
  try {
    const h = await pbkdf2Async(sha256, pin, fromHex(rec.salt), { c: rec.iter, dkLen: 32, asyncTick: 16 });
    return sameBytes(h, fromHex(rec.hash));
  } catch {
    return false;
  }
}

/**
 * Vérifie un code contre plusieurs empreintes (code secret, code panique) : un seul calcul quand elles
 * partagent le même sel et le même nombre de tours. La durée ne dépend donc pas du nombre de codes.
 */
export async function checkPinAgainst(pin: string, recs: (PinRecord | null)[]): Promise<boolean[]> {
  const derived = new Map<string, Uint8Array | null>();
  const out: boolean[] = [];
  for (const rec of recs) {
    if (!rec || rec.v !== 1 || !/^\d{4,8}$/.test(pin)) {
      out.push(false);
      continue;
    }
    const k = `${rec.salt}:${rec.iter}`;
    if (!derived.has(k)) {
      try {
        derived.set(k, await pbkdf2Async(sha256, pin, fromHex(rec.salt), { c: rec.iter, dkLen: 32, asyncTick: 16 }));
      } catch {
        derived.set(k, null);
      }
    }
    const h = derived.get(k) ?? null;
    let ok = false;
    try {
      ok = h !== null && sameBytes(h, fromHex(rec.hash));
    } catch {
      ok = false;
    }
    out.push(ok);
  }
  return out;
}

/** Lit un enregistrement gardé (JSON) ; null s'il est absent ou abîmé. */
export function parsePinRecord(json: string | null): PinRecord | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Partial<PinRecord>;
    if (r.v !== 1 || typeof r.salt !== "string" || typeof r.hash !== "string" || typeof r.iter !== "number") return null;
    if (!/^[0-9a-f]{32,}$/.test(r.salt) || !/^[0-9a-f]{64}$/.test(r.hash) || r.iter < 1000 || r.iter > 10_000_000) return null;
    return r as PinRecord;
  } catch {
    return null;
  }
}

/** Attente imposée après des erreurs : 0 jusqu'à 4 erreurs, puis 30 s, 1 min, 5 min, 15 min, 1 h. */
export function lockoutMs(failures: number): number {
  const steps = [0, 0, 0, 0, 0, 30_000, 60_000, 300_000, 900_000];
  return failures < steps.length ? steps[failures] : 3_600_000;
}
