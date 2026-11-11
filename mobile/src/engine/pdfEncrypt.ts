// Chiffrement d'un PDF par mot de passe, gestionnaire de sécurité standard, révision 6 (AES-256) :
// ISO 32000-2:2020, § 7.6.4 (algorithmes 2.A, 2.B, 8, 9, 10) et § 7.6.3 (chaînes et flux, AESV3).
// Le PDF est d'abord écrit sans flux d'objets, relu, puis chaque chaîne et chaque flux est chiffré.
import { cbc, ecb } from "@noble/ciphers/aes.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFStream, PDFString, type PDFObject } from "pdf-lib";

export type RandomBytes = (n: number) => Uint8Array;

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // sans 0/O, 1/I/L, U : rien à confondre en le dictant

/** Mot de passe à transmettre à part (SMS, appel) : 12 caractères faciles à dicter, environ 59 bits. */
export function newPdfPassword(random: Uint8Array): string {
  if (random.length < 12) throw new Error("pas assez d'aléa");
  let s = "";
  for (let i = 0; i < 12; i++) s += ALPHABET[random[i] % ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** Ce qui ne va pas dans un mot de passe choisi, ou null. */
export function pdfPasswordProblem(p: string): string | null {
  if (p.length < 8) return "Au moins 8 caractères.";
  if (p.length > 64) return "64 caractères au plus.";
  if (/[\u0000-\u001f\u007f]/.test(p)) return "Caractère invisible interdit.";
  return null;
}

/** Mot de passe tel que les lecteurs PDF le transforment (normalisation, UTF-8, 127 octets au plus). */
export function passwordBytes(p: string): Uint8Array {
  return new TextEncoder().encode(p.normalize("NFKC")).subarray(0, 127);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Algorithme 2.B : empreinte du mot de passe (révision 6). `udata` : la clé U (48 octets) pour le mot de passe propriétaire. */
export function hash2B(password: Uint8Array, salt: Uint8Array, udata: Uint8Array = new Uint8Array(0)): Uint8Array {
  let k: Uint8Array = sha256(concat(password, salt, udata));
  let e: Uint8Array = new Uint8Array(1);
  for (let round = 0; round < 64 || e[e.length - 1] > round - 32; round++) {
    const block = concat(password, k, udata);
    const k1 = new Uint8Array(block.length * 64);
    for (let i = 0; i < 64; i++) k1.set(block, i * block.length);
    e = cbc(k.subarray(0, 16), k.subarray(16, 32), { disablePadding: true }).encrypt(k1);
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += e[i];
    const mod = sum % 3; // les 16 premiers octets vus comme un entier, modulo 3 (256 ≡ 1 mod 3)
    k = mod === 0 ? sha256(e) : mod === 1 ? sha384(e) : sha512(e);
  }
  return k.subarray(0, 32);
}

const ZERO_IV = new Uint8Array(16);

export interface SecurityEntries {
  O: Uint8Array;
  U: Uint8Array;
  OE: Uint8Array;
  UE: Uint8Array;
  Perms: Uint8Array;
  P: number;
}

/** Algorithmes 8, 9 et 10 : entrées du dictionnaire de chiffrement pour une clé de fichier donnée. */
export function securityEntries(fileKey: Uint8Array, user: string, owner: string, random: RandomBytes, P = -4): SecurityEntries {
  if (fileKey.length !== 32) throw new Error("clé de fichier de 32 octets attendue");
  const u = passwordBytes(user);
  const o = passwordBytes(owner);
  const uSalts = random(16);
  const U = concat(hash2B(u, uSalts.subarray(0, 8)), uSalts);
  const UE = cbc(hash2B(u, uSalts.subarray(8, 16)), ZERO_IV, { disablePadding: true }).encrypt(fileKey);
  const oSalts = random(16);
  const O = concat(hash2B(o, oSalts.subarray(0, 8), U), oSalts);
  const OE = cbc(hash2B(o, oSalts.subarray(8, 16), U), ZERO_IV, { disablePadding: true }).encrypt(fileKey);
  const perms = new Uint8Array(16);
  new DataView(perms.buffer).setInt32(0, P, true);
  perms.set([0xff, 0xff, 0xff, 0xff], 4);
  perms.set(new TextEncoder().encode("Tadb"), 8); // T : métadonnées chiffrées aussi
  perms.set(random(4), 12);
  const Perms = ecb(fileKey, { disablePadding: true }).encrypt(perms);
  return { O, U, OE, UE, Perms, P };
}

/** Chaîne ou flux chiffré (AESV3) : vecteur d'initialisation aléatoire en tête, bourrage PKCS#7. */
function seal(fileKey: Uint8Array, data: Uint8Array, random: RandomBytes): Uint8Array {
  const iv = random(16);
  return concat(iv, cbc(fileKey, iv).encrypt(data));
}

function hex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Chiffre les chaînes d'un objet direct (dictionnaires et tableaux imbriqués) ; renvoie l'objet à garder. */
function sealStrings(obj: PDFObject, fileKey: Uint8Array, random: RandomBytes): PDFObject {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return PDFHexString.of(hex(seal(fileKey, obj.asBytes(), random)));
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) obj.set(key, sealStrings(value, fileKey, random));
    return obj;
  }
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) obj.set(i, sealStrings(obj.get(i), fileKey, random));
    return obj;
  }
  return obj;
}

/**
 * Protège un PDF (écrit par pdf-lib) par un mot de passe d'ouverture. Le mot de passe propriétaire est tiré au hasard
 * et jeté : personne ne peut retirer la protection sans le mot de passe d'ouverture.
 */
export async function encryptPdf(bytes: Uint8Array, userPassword: string, random: RandomBytes): Promise<Uint8Array> {
  const problem = pdfPasswordProblem(userPassword);
  if (problem) throw new Error(problem);
  // Relu tel quel : chaque objet devient une chaîne, un dictionnaire ou un flux brut (les flux d'objets et de
  // références sont défaits à la lecture), faciles à chiffrer un par un ; réécrit ensuite sans flux d'objets.
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  if (context.trailerInfo.Encrypt) throw new Error("Ce PDF est déjà protégé.");
  const fileKey = random(32);

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const dict = sealStrings(obj.dict, fileKey, random) as PDFDict;
      context.assign(ref, PDFRawStream.of(dict, seal(fileKey, obj.contents, random)));
    } else if (obj instanceof PDFStream) {
      throw new Error("Objet PDF inattendu : chiffrement impossible.");
    } else {
      context.assign(ref, sealStrings(obj, fileKey, random));
    }
  }

  const s = securityEntries(fileKey, userPassword, hex(random(32)), random);
  const stdCF = context.obj({ CFM: "AESV3", AuthEvent: "DocOpen", Length: 32 });
  const encrypt = context.obj({
    Filter: "Standard",
    V: 5,
    R: 6,
    Length: 256,
    P: PDFNumber.of(s.P),
    CF: context.obj({ StdCF: stdCF }),
    StmF: "StdCF",
    StrF: "StdCF",
    EncryptMetadata: true,
  });
  encrypt.set(PDFName.of("O"), PDFHexString.of(hex(s.O)));
  encrypt.set(PDFName.of("U"), PDFHexString.of(hex(s.U)));
  encrypt.set(PDFName.of("OE"), PDFHexString.of(hex(s.OE)));
  encrypt.set(PDFName.of("UE"), PDFHexString.of(hex(s.UE)));
  encrypt.set(PDFName.of("Perms"), PDFHexString.of(hex(s.Perms)));
  context.trailerInfo.Encrypt = context.register(encrypt);
  const id = PDFHexString.of(hex(random(16)));
  context.trailerInfo.ID = context.obj([id, id]);
  return doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
}
