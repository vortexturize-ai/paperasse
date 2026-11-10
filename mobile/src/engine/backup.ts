import { sha256 } from "@noble/hashes/sha2.js";

export const BACKUP_VERSION = 1;
export const CHUNK_SIZE = 1 << 20;
const TAG = 16;
const MAGIC = new TextEncoder().encode("PAPERASSE-COFFRE\n");

export type BackupType = "sauvegarde" | "kit";

export interface BackupHeader {
  v: number;
  type: BackupType;
  cree: string;
  /** 8 octets aléatoires (hexadécimal) : début du nonce de chaque morceau. */
  prefixe: string;
}

/** AES-256-GCM : `seal` renvoie chiffré + étiquette ; `open` échoue si quoi que ce soit a bougé. */
export interface Aead {
  seal(key: Uint8Array, iv: Uint8Array, plain: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  open(key: Uint8Array, iv: Uint8Array, sealed: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
}

export type BackupErrorCode = "format" | "version" | "cle" | "abime" | "trop_gros";

export class BackupError extends Error {
  code: BackupErrorCode;
  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const MESSAGES: Record<BackupErrorCode, string> = {
  format: "Ce fichier n’est pas une sauvegarde Paperasse.",
  version: "Cette sauvegarde vient d’une version plus récente de Paperasse : mets l’app à jour.",
  cle: "La clé de secours ne correspond pas à ce fichier (ou le fichier est abîmé).",
  abime: "Ce fichier est abîmé ou incomplet.",
  trop_gros: "Ce fichier est trop gros ou contient trop d’éléments.",
};

function fail(code: BackupErrorCode): never {
  throw new BackupError(code, MESSAGES[code]);
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // base32 de Crockford
const DATA_CHARS = 28;
const CODE_CHARS = 30;

function checkChars(data: string): string {
  const h = sha256(new TextEncoder().encode(`paperasse/controle|${data}`));
  return ALPHABET[h[0] & 31] + ALPHABET[h[1] & 31];
}

/** Nouvelle clé de secours, à partir d'au moins 28 octets aléatoires. */
export function newRecoveryCode(random: Uint8Array): string {
  if (random.length < DATA_CHARS) throw new Error("pas assez d'aléa");
  let data = "";
  for (let i = 0; i < DATA_CHARS; i++) data += ALPHABET[random[i] & 31];
  return formatRecoveryCode(data + checkChars(data));
}

/** « abcde fghjk … » → 30 caractères canoniques, ou null. O → 0, I/L → 1, espaces et tirets ignorés. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s\-_.·]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (s.length !== CODE_CHARS || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return s;
}

/** Ce qui ne va pas dans une clé tapée, ou null si elle est bonne. */
export function recoveryCodeProblem(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s\-_.·]/g, "");
  if (raw.length < CODE_CHARS) return `Il manque ${CODE_CHARS - raw.length} caractère${CODE_CHARS - raw.length > 1 ? "s" : ""}.`;
  if (raw.length > CODE_CHARS) return "Il y a trop de caractères.";
  const s = normalizeRecoveryCode(input);
  if (!s) return "Un caractère n’existe pas dans les clés Paperasse (vérifie U, ou les signes).";
  if (checkChars(s.slice(0, DATA_CHARS)) !== s.slice(DATA_CHARS)) return "Un caractère est mal tapé : relis la clé.";
  return null;
}

export function formatRecoveryCode(code: string): string {
  const s = normalizeRecoveryCode(code) ?? code;
  return s.match(/.{1,5}/g)?.join("-") ?? s;
}

/** Clé AES-256 tirée de la clé de secours (assez d'aléa : pas besoin de calcul lent). */
export function backupKey(code: string): Uint8Array {
  const s = normalizeRecoveryCode(code);
  if (!s || recoveryCodeProblem(s)) throw new BackupError("cle", "Clé de secours invalide.");
  return sha256(new TextEncoder().encode(`paperasse/sauvegarde/v1|${s}`));
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

export function readU32(b: Uint8Array, at = 0): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

function concat(parts: Uint8Array[], total?: number): Uint8Array {
  const out = new Uint8Array(total ?? parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function unhex(s: string): Uint8Array {
  return Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));
}

function nonce(prefix: Uint8Array, counter: number): Uint8Array {
  return concat([prefix, u32(counter)], 12);
}

function aad(header: Uint8Array, counter: number, last: boolean): Uint8Array {
  return concat([header, u32(counter), new Uint8Array([last ? 1 : 0])]);
}

/** Octets d'en-tête : signature + longueur + JSON (en clair, mais authentifié avec chaque morceau). */
export function encodeHeader(h: BackupHeader): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(h));
  return concat([MAGIC, u32(json.length), json]);
}

/** Taille fixe à lire d'abord pour connaître la longueur de l'en-tête. */
export const HEADER_PREFIX = MAGIC.length + 4;

export function headerLength(prefix: Uint8Array): number {
  if (prefix.length < HEADER_PREFIX || MAGIC.some((b, i) => prefix[i] !== b)) fail("format");
  const n = readU32(prefix, MAGIC.length);
  if (n < 2 || n > 4096) fail("format");
  return HEADER_PREFIX + n;
}

export function decodeHeader(bytes: Uint8Array): BackupHeader {
  const total = headerLength(bytes);
  if (bytes.length < total) fail("abime");
  let h: Partial<BackupHeader>;
  try {
    h = JSON.parse(new TextDecoder().decode(bytes.subarray(HEADER_PREFIX, total))) as Partial<BackupHeader>;
  } catch {
    fail("format");
  }
  if (typeof h.v !== "number") fail("format");
  if (h.v > BACKUP_VERSION) fail("version");
  if ((h.type !== "sauvegarde" && h.type !== "kit") || typeof h.cree !== "string" || !/^[0-9a-f]{16}$/.test(h.prefixe ?? "")) fail("format");
  return h as BackupHeader;
}

/** Nom des éléments : le contenu (JSON), les fichiers, puis la marque de fin. */
export const ENTRY_DATA = "paperasse.json";
export const ENTRY_END = "fin";
const FILE_ENTRY = /^fichier\/[A-Za-z0-9_-]{1,64}$/;

export function fileEntry(fileId: string): string {
  const name = `fichier/${fileId}`;
  if (!FILE_ENTRY.test(name)) throw new Error("identifiant de fichier invalide");
  return name;
}

export class BackupWriter {
  readonly headerBytes: Uint8Array;
  private key: Uint8Array;
  private aead: Aead;
  private prefix: Uint8Array;
  private counter = 0;
  private pending: Uint8Array[] = [];
  private pendingLength = 0;
  private finished = false;

  constructor(key: Uint8Array, header: BackupHeader, aead: Aead) {
    this.key = key;
    this.aead = aead;
    this.headerBytes = encodeHeader(header);
    this.prefix = unhex(header.prefixe);
  }

  /** Ajoute un élément ; renvoie les morceaux chiffrés prêts à écrire (longueur + données). */
  async add(name: string, data: Uint8Array): Promise<Uint8Array[]> {
    if (this.finished) throw new Error("sauvegarde déjà terminée");
    const n = new TextEncoder().encode(name);
    if (n.length === 0 || n.length > 255) throw new Error("nom invalide");
    this.push(concat([new Uint8Array([n.length]), n, u32(data.length)]));
    if (data.length) this.push(data);
    return this.flush(false);
  }

  /** Termine : marque de fin, dernier morceau. */
  async finish(): Promise<Uint8Array[]> {
    const out = await this.add(ENTRY_END, new Uint8Array(0));
    this.finished = true;
    return [...out, ...(await this.flush(true))];
  }

  private push(b: Uint8Array): void {
    this.pending.push(b);
    this.pendingLength += b.length;
  }

  private take(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let at = 0;
    while (at < n) {
      const head = this.pending[0];
      const need = n - at;
      if (head.length <= need) {
        out.set(head, at);
        at += head.length;
        this.pending.shift();
      } else {
        out.set(head.subarray(0, need), at);
        this.pending[0] = head.subarray(need);
        at += need;
      }
    }
    this.pendingLength -= n;
    return out;
  }

  private async flush(final: boolean): Promise<Uint8Array[]> {
    const out: Uint8Array[] = [];
    while (this.pendingLength > CHUNK_SIZE || (final && this.pendingLength > 0)) {
      const size = Math.min(CHUNK_SIZE, this.pendingLength);
      const last = final && size === this.pendingLength;
      const plain = this.take(size);
      const sealed = await this.aead.seal(this.key, nonce(this.prefix, this.counter), plain, aad(this.headerBytes, this.counter, last));
      out.push(concat([u32(sealed.length), sealed]));
      this.counter++;
    }
    return out;
  }
}

export interface ReaderLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export const READER_LIMITS: ReaderLimits = { maxEntries: 20_000, maxEntryBytes: 40_000_000, maxTotalBytes: 4_000_000_000 };

export interface BackupEntry {
  name: string;
  data: Uint8Array;
}

/** Longueur annoncée d'un morceau (4 octets) : refuse ce qui ne peut pas venir de Paperasse. */
export function chunkLength(prefix: Uint8Array): number {
  const n = readU32(prefix);
  if (n < TAG || n > CHUNK_SIZE + TAG) fail("abime");
  return n;
}

export class BackupReader {
  private key: Uint8Array;
  private aead: Aead;
  private headerBytes: Uint8Array;
  private prefix: Uint8Array;
  private limits: ReaderLimits;
  private counter = 0;
  private buf: Uint8Array[] = [];
  private bufLength = 0;
  private entries = 0;
  private total = 0;
  private ended = false;
  private sawLast = false;

  constructor(key: Uint8Array, headerBytes: Uint8Array, aead: Aead, limits: ReaderLimits = READER_LIMITS) {
    const header = decodeHeader(headerBytes);
    this.key = key;
    this.aead = aead;
    this.headerBytes = headerBytes.subarray(0, headerLength(headerBytes));
    this.prefix = unhex(header.prefixe);
    this.limits = limits;
  }

  get done(): boolean {
    return this.ended && this.sawLast;
  }

  /** Un morceau chiffré (sans ses 4 octets de longueur) → les éléments complets qu'il termine. */
  async push(sealed: Uint8Array): Promise<BackupEntry[]> {
    if (this.sawLast) fail("abime"); // rien après le dernier morceau
    let plain: Uint8Array | null = null;
    let last = false;
    for (const flag of [false, true]) {
      try {
        plain = await this.aead.open(this.key, nonce(this.prefix, this.counter), sealed, aad(this.headerBytes, this.counter, flag));
        last = flag;
        break;
      } catch {
        // essai suivant
      }
    }
    if (!plain) fail(this.counter === 0 ? "cle" : "abime");
    this.counter++;
    this.sawLast = last;
    this.buf.push(plain);
    this.bufLength += plain.length;
    const out = this.parse();
    if (last && (!this.ended || this.bufLength > 0)) fail("abime");
    return out;
  }

  /** À appeler quand le fichier est fini : une sauvegarde coupée est refusée. */
  finish(): void {
    if (!this.done) fail("abime");
  }

  /** Les n premiers octets, sans tout recoller (un gros fichier arrive en plusieurs morceaux). */
  private peek(n: number): Uint8Array {
    if (this.buf[0].length >= n) return this.buf[0].subarray(0, n);
    const out = new Uint8Array(n);
    let at = 0;
    for (const piece of this.buf) {
      const part = piece.subarray(0, n - at);
      out.set(part, at);
      at += part.length;
      if (at === n) break;
    }
    return out;
  }

  private take(n: number): Uint8Array {
    const all = this.buf.length === 1 ? this.buf[0] : concat(this.buf, this.bufLength);
    const out = all.slice(0, n);
    const rest = all.subarray(n);
    this.buf = rest.length ? [rest] : [];
    this.bufLength = rest.length;
    return out;
  }

  private parse(): BackupEntry[] {
    const out: BackupEntry[] = [];
    while (this.bufLength > 0) {
      if (this.ended) fail("abime");
      const nameLen = this.peek(1)[0];
      if (nameLen === 0) fail("abime");
      if (this.bufLength < 1 + nameLen + 4) break;
      const head = this.peek(1 + nameLen + 4);
      const name = new TextDecoder("utf-8", { fatal: false }).decode(head.subarray(1, 1 + nameLen));
      const size = readU32(head, 1 + nameLen);
      if (name !== ENTRY_DATA && name !== ENTRY_END && !FILE_ENTRY.test(name)) fail("abime");
      if (size > this.limits.maxEntryBytes || (name === ENTRY_END && size !== 0)) fail("trop_gros");
      if (this.bufLength < 1 + nameLen + 4 + size) break;
      this.take(1 + nameLen + 4);
      const data = this.take(size);
      this.entries++;
      this.total += size;
      if (this.entries > this.limits.maxEntries || this.total > this.limits.maxTotalBytes) fail("trop_gros");
      if (name === ENTRY_END) this.ended = true;
      else out.push({ name, data });
    }
    return out;
  }
}

/** Lit un fichier entier déjà en mémoire (tests, petits kits). */
export async function readBackupBytes(bytes: Uint8Array, code: string, aead: Aead, limits?: ReaderLimits): Promise<{ header: BackupHeader; entries: BackupEntry[] }> {
  const total = headerLength(bytes.subarray(0, HEADER_PREFIX));
  const header = decodeHeader(bytes.subarray(0, total));
  const reader = new BackupReader(backupKey(code), bytes.subarray(0, total), aead, limits);
  const entries: BackupEntry[] = [];
  let at = total;
  while (at < bytes.length) {
    if (bytes.length - at < 4) fail("abime");
    const n = chunkLength(bytes.subarray(at, at + 4));
    if (bytes.length - at - 4 < n) fail("abime");
    entries.push(...(await reader.push(bytes.subarray(at + 4, at + 4 + n))));
    at += 4 + n;
  }
  reader.finish();
  return { header, entries };
}

export function newHeader(type: BackupType, now: string, random8: Uint8Array): BackupHeader {
  if (random8.length < 8) throw new Error("pas assez d'aléa");
  return { v: BACKUP_VERSION, type, cree: now, prefixe: hex(random8.subarray(0, 8)) };
}

const TEXT_REQUIRED = [
  "id",
  "created_at",
  "updated_at",
  "title",
  "doc_type",
  "category",
  "urgency",
  "analysis_status",
  "actions",
  "key_facts",
  "keywords",
  "search_text",
] as const;
const TEXT_NULLABLE = [
  "issuer",
  "doc_date",
  "summary",
  "deadline",
  "deadline_label",
  "deadline_quote",
  "expiry_date",
  "amount_direction",
  "full_text",
  "warning",
  "analysis_lang",
] as const;
const FLAGS = ["to_do", "is_done", "is_favorite"] as const;

/** Colonnes de la table documents (schéma 1), dans l'ordre d'insertion. */
export const DOC_COLUMNS = [...TEXT_REQUIRED, ...TEXT_NULLABLE, ...FLAGS, "amount", "notification_ids", "person_id"] as const;
export type DocRow = Record<(typeof DOC_COLUMNS)[number], string | number | null>;

export interface FileRow {
  id: string;
  document_id: string;
  position: number;
  mime: string;
}

export interface PersonRow {
  id: string;
  name: string;
  relation: string;
}

export interface BackupData {
  v: number;
  schema: number;
  documents: DocRow[];
  files: FileRow[];
  settings: [string, string][];
  /** Proches (famille, aidants) ; absent des sauvegardes plus anciennes. */
  people: PersonRow[];
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
const SETTING_KEYS = /^(language|sender|learn:.{1,80}|life:.{1,80})$/;
const MAX_TEXT = 500_000;

/** Vérifie tout ce qui vient du fichier : rien n'est pris tel quel (une sauvegarde peut venir d'ailleurs). */
export function validateBackupData(json: unknown): BackupData {
  const bad = (): never => fail("abime");
  if (!json || typeof json !== "object") bad();
  const j = json as Record<string, unknown>;
  if (typeof j.v !== "number" || j.v > BACKUP_VERSION) fail("version");
  if (!Array.isArray(j.documents) || !Array.isArray(j.files) || !Array.isArray(j.settings)) bad();
  const people: PersonRow[] = [];
  const personIds = new Set<string>();
  for (const raw of Array.isArray(j.people) ? (j.people as unknown[]) : []) {
    const r = raw as Record<string, unknown>;
    if (!r || typeof r.id !== "string" || !ID.test(r.id) || personIds.has(r.id)) bad();
    if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 40) bad();
    const relation = typeof r.relation === "string" && ["enfant", "conjoint", "parent", "proche"].includes(r.relation) ? r.relation : "proche";
    personIds.add(r.id as string);
    people.push({ id: r.id as string, name: (r.name as string).trim(), relation });
  }
  const documents: DocRow[] = [];
  const ids = new Set<string>();
  for (const raw of j.documents as unknown[]) {
    if (!raw || typeof raw !== "object") bad();
    const r = raw as Record<string, unknown>;
    const row = {} as DocRow;
    for (const c of TEXT_REQUIRED) {
      if (typeof r[c] !== "string" || (r[c] as string).length > MAX_TEXT) bad();
      row[c] = r[c] as string;
    }
    for (const c of TEXT_NULLABLE) {
      if (r[c] != null && (typeof r[c] !== "string" || (r[c] as string).length > MAX_TEXT)) bad();
      row[c] = (r[c] as string | null | undefined) ?? null;
    }
    for (const c of FLAGS) row[c] = r[c] === 1 || r[c] === true ? 1 : 0;
    row.amount = typeof r.amount === "number" && Number.isFinite(r.amount) ? r.amount : null;
    row.notification_ids = "[]"; // les rappels sont propres à chaque téléphone : reprogrammés à l'arrivée
    row.person_id = typeof r.person_id === "string" && personIds.has(r.person_id) ? r.person_id : null;
    if (!ID.test(row.id as string) || ids.has(row.id as string)) bad();
    ids.add(row.id as string);
    documents.push(row);
  }
  const files: FileRow[] = [];
  const fileIds = new Set<string>();
  for (const raw of j.files as unknown[]) {
    const r = raw as Record<string, unknown>;
    if (!r || typeof r.id !== "string" || !ID.test(r.id) || fileIds.has(r.id)) bad();
    if (typeof r.document_id !== "string" || !ids.has(r.document_id)) bad();
    if (typeof r.position !== "number" || !Number.isInteger(r.position) || r.position < 0 || r.position > 1000) bad();
    if (typeof r.mime !== "string" || !MIMES.has(r.mime)) bad();
    fileIds.add(r.id as string);
    files.push({ id: r.id as string, document_id: r.document_id as string, position: r.position as number, mime: r.mime as string });
  }
  const settings: [string, string][] = [];
  for (const raw of j.settings as unknown[]) {
    if (!Array.isArray(raw) || typeof raw[0] !== "string" || typeof raw[1] !== "string") bad();
    const [k, v] = raw as [string, string];
    if (SETTING_KEYS.test(k) && v.length <= 4000) settings.push([k, v]);
  }
  return { v: j.v, schema: typeof j.schema === "number" ? j.schema : 1, documents, files, settings, people };
}

export interface RestorePlan {
  /** Proches à créer s'ils n'existent pas (ceux des papiers restaurés). */
  people: PersonRow[];
  documents: DocRow[];
  files: FileRow[];
  /** Papiers déjà présents sur ce téléphone (même identifiant) : laissés tels quels. */
  skipped: number;
}

/** On ajoute ce qui manque, on n'écrase jamais un papier déjà là. */
export function planRestore(data: BackupData, existing: Set<string>, available: Set<string>): RestorePlan {
  const documents = data.documents.filter((d) => !existing.has(d.id as string));
  const keep = new Set(documents.map((d) => d.id as string));
  const files = data.files.filter((f) => keep.has(f.document_id) && available.has(f.id));
  const needed = new Set(documents.map((d) => d.person_id).filter((x): x is string => typeof x === "string"));
  const people = data.people.filter((p) => needed.has(p.id));
  return { people, documents, files, skipped: data.documents.length - documents.length };
}

export function extensionFor(mime: string): string {
  return mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "text/plain" ? "txt" : "jpg";
}
