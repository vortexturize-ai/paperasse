import { Unzlib, Inflate } from "fflate";

export interface PdfResult {
  text: string;
  pages: number;
  encrypted: boolean;
  /** Images JPEG trouvées sur les pages sans texte (PDF scanné). */
  scans: Uint8Array[];
}

const MAX_INFLATE = 64 * 1024 * 1024; // 64 Mo décompressés au total
const MAX_PAGES = 60;
const MAX_TEXT = 200_000;

type PdfValue =
  | { k: "dict"; v: Map<string, PdfValue> }
  | { k: "arr"; v: PdfValue[] }
  | { k: "ref"; n: number }
  | { k: "name"; v: string }
  | { k: "num"; v: number }
  | { k: "str"; v: Uint8Array }
  | { k: "bool"; v: boolean }
  | { k: "null" };

interface PdfObject {
  value: PdfValue;
  /** Flux brut (encore compressé), pour les objets qui en ont un. */
  raw: Uint8Array | null;
}

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

/** Lecteur de jetons PDF sur un tableau d'octets. */
class Lexer {
  pos: number;
  readonly b: Uint8Array;
  readonly end: number;
  constructor(b: Uint8Array, pos = 0, end = b.length) {
    this.b = b;
    this.pos = pos;
    this.end = end;
  }

  skipWs(): void {
    const { b } = this;
    while (this.pos < this.end) {
      const c = b[this.pos];
      if (WS.has(c)) this.pos++;
      else if (c === 37) {
        while (this.pos < this.end && b[this.pos] !== 10 && b[this.pos] !== 13) this.pos++;
      } else break;
    }
  }

  /** Lit une valeur PDF (dictionnaire, tableau, nom, nombre, chaîne, référence). `depth` borne l'imbrication. */
  value(depth = 0): PdfValue | null {
    if (depth > 64) return null;
    this.skipWs();
    if (this.pos >= this.end) return null;
    const { b } = this;
    const c = b[this.pos];
    if (c === 60 && b[this.pos + 1] === 60) {
      this.pos += 2;
      const map = new Map<string, PdfValue>();
      for (let guard = 0; guard < 10_000; guard++) {
        this.skipWs();
        if (this.pos >= this.end) break;
        if (b[this.pos] === 62 && b[this.pos + 1] === 62) {
          this.pos += 2;
          break;
        }
        const key = this.value(depth + 1);
        if (!key || key.k !== "name") {
          this.pos++;
          continue;
        }
        const val = this.value(depth + 1);
        if (val) map.set(key.v, val);
      }
      return { k: "dict", v: map };
    }
    if (c === 91) {
      this.pos++;
      const arr: PdfValue[] = [];
      for (let guard = 0; guard < 100_000; guard++) {
        this.skipWs();
        if (this.pos >= this.end) break;
        if (b[this.pos] === 93) {
          this.pos++;
          break;
        }
        const before = this.pos;
        const v = this.value(depth + 1);
        if (v) arr.push(v);
        if (this.pos === before) this.pos++;
      }
      return { k: "arr", v: arr };
    }
    if (c === 47) return { k: "name", v: this.name() };
    if (c === 40) return { k: "str", v: this.literal() };
    if (c === 60) return { k: "str", v: this.hex() };
    const word = this.word();
    if (word === "true" || word === "false") return { k: "bool", v: word === "true" };
    if (word === "null") return { k: "null" };
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      // « 12 0 R » : référence à un autre objet.
      const save = this.pos;
      if (/^\d+$/.test(word)) {
        this.skipWs();
        const gen = this.word();
        this.skipWs();
        if (/^\d+$/.test(gen) && this.b[this.pos] === 82 && !this.isRegular(this.b[this.pos + 1])) {
          this.pos++;
          return { k: "ref", n: Number(word) };
        }
        this.pos = save;
      }
      return { k: "num", v: Number(word) };
    }
    if (word === "") this.pos++;
    return null;
  }

  isRegular(c: number | undefined): boolean {
    return c !== undefined && !WS.has(c) && !DELIM.has(c);
  }

  word(): string {
    let s = "";
    while (this.pos < this.end && this.isRegular(this.b[this.pos]) && s.length < 256) s += String.fromCharCode(this.b[this.pos++]);
    return s;
  }

  name(): string {
    this.pos++; // « / »
    let s = "";
    while (this.pos < this.end && this.isRegular(this.b[this.pos]) && s.length < 256) {
      const c = this.b[this.pos++];
      if (c === 35 && this.pos + 1 < this.end) {
        const h = parseInt(String.fromCharCode(this.b[this.pos], this.b[this.pos + 1]), 16);
        if (!Number.isNaN(h)) {
          s += String.fromCharCode(h);
          this.pos += 2;
          continue;
        }
      }
      s += String.fromCharCode(c);
    }
    return s;
  }

  literal(): Uint8Array {
    const out: number[] = [];
    this.pos++; // « ( »
    let depth = 1;
    const { b } = this;
    while (this.pos < this.end && out.length < 1_000_000) {
      const c = b[this.pos++];
      if (c === 92) {
        const n = b[this.pos++];
        if (n === 110) out.push(10);
        else if (n === 114) out.push(13);
        else if (n === 116) out.push(9);
        else if (n === 98) out.push(8);
        else if (n === 102) out.push(12);
        else if (n === 13) {
          if (b[this.pos] === 10) this.pos++;
        } else if (n === 10) {
          /* fin de ligne échappée */
        } else if (n >= 48 && n <= 55) {
          let v = n - 48;
          for (let i = 0; i < 2 && b[this.pos] >= 48 && b[this.pos] <= 55; i++) v = v * 8 + (b[this.pos++] - 48);
          out.push(v & 255);
        } else if (n !== undefined) out.push(n);
      } else if (c === 40) {
        depth++;
        out.push(c);
      } else if (c === 41) {
        if (--depth === 0) break;
        out.push(c);
      } else out.push(c);
    }
    return Uint8Array.from(out);
  }

  hex(): Uint8Array {
    this.pos++; // « < »
    let digits = "";
    while (this.pos < this.end && this.b[this.pos] !== 62 && digits.length < 2_000_000) {
      const ch = String.fromCharCode(this.b[this.pos++]);
      if (/[0-9a-fA-F]/.test(ch)) digits += ch;
    }
    this.pos++;
    if (digits.length % 2) digits += "0";
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
}

class Budget {
  used = 0;
  take(n: number): void {
    this.used += n;
    if (this.used > MAX_INFLATE) throw new Error("PDF trop gros une fois décompressé");
  }
}

function inflate(data: Uint8Array, budget: Budget): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const onData = (chunk: Uint8Array) => {
    budget.take(chunk.length);
    total += chunk.length;
    chunks.push(chunk);
  };
  try {
    const z = new Unzlib(onData);
    z.push(data, true);
  } catch {
    // Certains générateurs oublient l'en-tête zlib : on retente en « deflate » brut.
    chunks.length = 0;
    total = 0;
    try {
      const z = new Inflate(onData);
      z.push(data, true);
    } catch {
      if (total === 0) return new Uint8Array(0);
    }
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function bytesToLatin1(b: Uint8Array, start = 0, end = b.length): string {
  let s = "";
  for (let i = start; i < end; i += 8192) s += String.fromCharCode(...b.subarray(i, Math.min(end, i + 8192)));
  return s;
}

function indexOfBytes(b: Uint8Array, needle: string, from: number, to = b.length): number {
  const n = needle.length;
  const first = needle.charCodeAt(0);
  outer: for (let i = from; i <= to - n; i++) {
    if (b[i] !== first) continue;
    for (let j = 1; j < n; j++) if (b[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

class PdfDoc {
  objects = new Map<number, PdfObject>();
  decoded = new Map<number, Uint8Array>();
  budget = new Budget();
  trailer: Map<string, PdfValue> = new Map();
  readonly b: Uint8Array;

  constructor(b: Uint8Array) {
    this.b = b;
    const latin = bytesToLatin1(b);
    const re = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
    let count = 0;
    for (const m of latin.matchAll(re)) {
      if (++count > 200_000) break;
      const start = (m.index ?? 0) + m[0].length;
      const lex = new Lexer(b, start);
      const value = lex.value();
      if (!value) continue;
      let raw: Uint8Array | null = null;
      lex.skipWs();
      if (indexOfBytes(b, "stream", lex.pos, lex.pos + 6) === lex.pos) {
        let s = lex.pos + 6;
        if (b[s] === 13) s++;
        if (b[s] === 10) s++;
        const len = value.k === "dict" ? value.v.get("Length") : undefined;
        let e = len?.k === "num" && len.v >= 0 && s + len.v <= b.length ? s + len.v : -1;
        if (e < 0 || indexOfBytes(b, "endstream", e, Math.min(b.length, e + 12)) < 0) {
          const found = indexOfBytes(b, "endstream", s);
          e = found < 0 ? b.length : found;
          while (e > s && (b[e - 1] === 10 || b[e - 1] === 13)) e--;
        }
        raw = b.subarray(s, e);
      }
      this.objects.set(Number(m[1]), { value, raw });
    }
    // Dictionnaires de fin de fichier (« trailer ») et flux de références croisées : /Root, /Encrypt.
    for (const m of latin.matchAll(/trailer\s*<</g)) {
      const v = new Lexer(b, (m.index ?? 0) + 7).value();
      if (v?.k === "dict") for (const [k, val] of v.v) this.trailer.set(k, val);
    }
    for (const obj of this.objects.values()) {
      if (obj.value.k === "dict" && this.nameOf(obj.value.v.get("Type")) === "XRef") {
        for (const [k, val] of obj.value.v) if (!this.trailer.has(k)) this.trailer.set(k, val);
      }
    }
    this.expandObjectStreams();
  }

  nameOf(v: PdfValue | undefined): string | null {
    const r = this.resolve(v);
    return r?.k === "name" ? r.v : null;
  }

  resolve(v: PdfValue | undefined, depth = 0): PdfValue | undefined {
    if (!v || v.k !== "ref" || depth > 16) return v;
    return this.resolve(this.objects.get(v.n)?.value, depth + 1);
  }

  dict(v: PdfValue | undefined): Map<string, PdfValue> | null {
    const r = this.resolve(v);
    return r?.k === "dict" ? r.v : null;
  }

  num(v: PdfValue | undefined): number | null {
    const r = this.resolve(v);
    return r?.k === "num" ? r.v : null;
  }

  /** Contenu décodé d'un flux (FlateDecode géré ; filtres images laissés bruts). */
  stream(n: number): Uint8Array | null {
    const cached = this.decoded.get(n);
    if (cached) return cached;
    const obj = this.objects.get(n);
    if (!obj?.raw || obj.value.k !== "dict") return null;
    const f = this.resolve(obj.value.v.get("Filter"));
    const filters = f?.k === "name" ? [f.v] : f?.k === "arr" ? f.v.map((x) => (this.resolve(x)?.k === "name" ? (this.resolve(x) as { v: string }).v : "")) : [];
    let data: Uint8Array = obj.raw;
    for (const name of filters) {
      if (name === "FlateDecode" || name === "Fl") data = inflate(data, this.budget);
      else if (name === "ASCIIHexDecode" || name === "AHx") data = new Lexer(Uint8Array.from([60, ...data, 62])).hex();
      else break; // DCT (JPEG) et autres : on garde les octets tels quels
    }
    this.decoded.set(n, data);
    return data;
  }

  private expandObjectStreams(): void {
    for (const [n, obj] of [...this.objects]) {
      if (obj.value.k !== "dict" || this.nameOf(obj.value.v.get("Type")) !== "ObjStm") continue;
      let data: Uint8Array | null = null;
      try {
        data = this.stream(n);
      } catch {
        continue;
      }
      if (!data) continue;
      const count = this.num(obj.value.v.get("N")) ?? 0;
      const first = this.num(obj.value.v.get("First")) ?? 0;
      const head = new Lexer(data, 0, Math.min(first, data.length));
      const pairs: [number, number][] = [];
      for (let i = 0; i < count && i < 100_000; i++) {
        const a = head.value();
        const b = head.value();
        if (a?.k !== "num" || b?.k !== "num") break;
        pairs.push([a.v, b.v]);
      }
      for (const [num, off] of pairs) {
        if (this.objects.has(num) && this.objects.get(num)!.raw) continue;
        const v = new Lexer(data, first + off).value();
        if (v) this.objects.set(num, { value: v, raw: null });
      }
    }
  }

  get encrypted(): boolean {
    return this.trailer.has("Encrypt");
  }

  /** Pages dans l'ordre du document, avec leurs ressources (héritées des parents). */
  pages(): { dict: Map<string, PdfValue>; resources: Map<string, PdfValue> | null }[] {
    const out: { dict: Map<string, PdfValue>; resources: Map<string, PdfValue> | null }[] = [];
    const root = this.dict(this.trailer.get("Root"));
    const seen = new Set<Map<string, PdfValue>>();
    const walk = (node: Map<string, PdfValue> | null, inherited: Map<string, PdfValue> | null, depth: number) => {
      if (!node || depth > 32 || seen.has(node) || out.length >= MAX_PAGES) return;
      seen.add(node);
      const res = this.dict(node.get("Resources")) ?? inherited;
      const kids = this.resolve(node.get("Kids"));
      if (kids?.k === "arr") for (const k of kids.v) walk(this.dict(k), res, depth + 1);
      else if (this.nameOf(node.get("Type")) === "Page" || node.has("Contents")) out.push({ dict: node, resources: res });
    };
    walk(this.dict(root?.get("Pages")), null, 0);
    if (out.length === 0) {
      // Arbre des pages abîmé : on prend les objets « Page » dans l'ordre du fichier.
      for (const obj of this.objects.values()) {
        if (obj.value.k === "dict" && this.nameOf(obj.value.v.get("Type")) === "Page") out.push({ dict: obj.value.v, resources: this.dict(obj.value.v.get("Resources")) });
        if (out.length >= MAX_PAGES) break;
      }
    }
    return out;
  }
}

// WinAnsiEncoding (Windows-1252) : la plage 0x80-0x9F diffère du Latin-1.
const WIN_ANSI: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
  0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

// Noms de glyphes courants (pour /Differences).
const GLYPHS: Record<string, string> = {
  space: " ", eacute: "é", egrave: "è", ecircumflex: "ê", edieresis: "ë", agrave: "à", acircumflex: "â", ccedilla: "ç",
  icircumflex: "î", idieresis: "ï", ocircumflex: "ô", ugrave: "ù", ucircumflex: "û", udieresis: "ü", Eacute: "É", Egrave: "È",
  Ecircumflex: "Ê", Agrave: "À", Ccedilla: "Ç", quoteright: "’", quoteleft: "‘", quotedblleft: "“", quotedblright: "”",
  guillemotleft: "«", guillemotright: "»", Euro: "€", endash: "–", emdash: "—", bullet: "•", ellipsis: "…", degree: "°",
  oe: "œ", OE: "Œ", period: ".", comma: ",", colon: ":", semicolon: ";", hyphen: "-", slash: "/", parenleft: "(", parenright: ")",
  numbersign: "#", percent: "%", ampersand: "&", quotesingle: "'", at: "@", underscore: "_",
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

function glyphToChar(name: string): string | null {
  if (GLYPHS[name]) return GLYPHS[name];
  if (/^[A-Za-z]$/.test(name)) return name;
  const uni = name.match(/^uni([0-9A-Fa-f]{4})$/);
  if (uni) return String.fromCharCode(parseInt(uni[1], 16));
  return null;
}

function utf16be(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return s;
}

interface FontMap {
  bytesPerCode: 1 | 2;
  map: Map<number, string>;
  /** Pour les polices simples sans table : WinAnsi par défaut. */
  fallback: (code: number) => string;
  /** Largeur d'un code en millièmes de cadratin, si la police la donne. */
  widths: Map<number, number>;
  defaultWidth: number | null;
}

// Largeurs approximatives (millièmes de cadratin, proches d'Helvetica) quand la police ne les donne pas.
const NARROW = new Set([..."iljtfr.,:;'!|()[]  /"]);
function estimateWidth(ch: string): number {
  if (NARROW.has(ch)) return ch === "r" || ch === "(" || ch === ")" || ch === "-" ? 333 : 278;
  if (ch === "-") return 333;
  if (ch === "m" || ch === "M") return 833;
  if (ch === "w") return 722;
  if (ch === "W") return 944;
  const base = ch.normalize("NFD")[0] ?? ch;
  if (/[A-Z]/.test(base)) return /[IJ]/.test(base) ? 400 : 700;
  return 556;
}

function parseCMap(data: Uint8Array): { map: Map<number, string>; bytes: 1 | 2 } {
  const s = bytesToLatin1(data);
  const map = new Map<number, string>();
  let bytes: 1 | 2 = 2;
  const space = s.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (space && space[1].length <= 2) bytes = 1;
  const hexToBytes = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
  for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16be(hexToBytes(m[2])));
  }
  for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = Math.min(parseInt(m[2], 16), lo + 65535);
      if (m[3].startsWith("[")) {
        const items = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)];
        items.forEach((it, i) => lo + i <= hi && map.set(lo + i, utf16be(hexToBytes(it[1]))));
      } else {
        const base = hexToBytes(m[3].slice(1, -1));
        for (let c = lo; c <= hi; c++) {
          const dst = base.slice();
          dst[dst.length - 1] += c - lo;
          map.set(c, utf16be(dst));
        }
      }
    }
  }
  return { map, bytes };
}

function fontMap(doc: PdfDoc, fontRef: PdfValue | undefined): FontMap {
  const font = doc.dict(fontRef);
  const winAnsi = (c: number) => WIN_ANSI[c] ?? String.fromCharCode(c);
  if (!font) return { bytesPerCode: 1, map: new Map(), fallback: winAnsi, widths: new Map(), defaultWidth: null };
  const type0 = doc.nameOf(font.get("Subtype")) === "Type0";
  const widths = new Map<number, number>();
  let defaultWidth: number | null = null;
  if (type0) {
    const desc = doc.resolve(font.get("DescendantFonts"));
    const cid = desc?.k === "arr" ? doc.dict(desc.v[0]) : null;
    defaultWidth = doc.num(cid?.get("DW")) ?? 1000;
    const w = doc.resolve(cid?.get("W"));
    if (w?.k === "arr") {
      // [c [w1 w2 …]] ou [cDébut cFin w]
      for (let i = 0; i < w.v.length && widths.size < 70_000; ) {
        const first = doc.num(w.v[i]);
        const next = doc.resolve(w.v[i + 1]);
        if (first === null) break;
        if (next?.k === "arr") {
          next.v.forEach((x, j) => widths.set(first + j, doc.num(x) ?? 0));
          i += 2;
        } else {
          const last = doc.num(w.v[i + 1]) ?? first;
          const width = doc.num(w.v[i + 2]) ?? 0;
          for (let c = first; c <= last && c - first < 70_000; c++) widths.set(c, width);
          i += 3;
        }
      }
    }
  } else {
    const firstChar = doc.num(font.get("FirstChar")) ?? 0;
    const w = doc.resolve(font.get("Widths"));
    if (w?.k === "arr") w.v.forEach((x, i) => widths.set(firstChar + i, doc.num(x) ?? 0));
  }
  const tu = font.get("ToUnicode");
  if (tu?.k === "ref") {
    try {
      const data = doc.stream(tu.n);
      if (data) {
        const cm = parseCMap(data);
        return { bytesPerCode: type0 ? 2 : cm.bytes, map: cm.map, fallback: type0 ? () => "" : winAnsi, widths, defaultWidth };
      }
    } catch {
      /* table illisible : encodage simple */
    }
  }
  const map = new Map<number, string>();
  const enc = doc.resolve(font.get("Encoding"));
  if (enc?.k === "dict") {
    const diff = doc.resolve(enc.v.get("Differences"));
    if (diff?.k === "arr") {
      let code = 0;
      for (const item of diff.v) {
        if (item.k === "num") code = item.v;
        else if (item.k === "name") {
          const ch = glyphToChar(item.v);
          if (ch) map.set(code, ch);
          code++;
        }
      }
    }
  }
  return { bytesPerCode: type0 ? 2 : 1, map, fallback: type0 ? () => "" : winAnsi, widths, defaultWidth };
}

/** Texte et largeur (millièmes de cadratin) d'une chaîne. */
function decodeString(bytes: Uint8Array, font: FontMap): { text: string; width: number } {
  let s = "";
  let width = 0;
  const step = font.bytesPerCode;
  for (let i = 0; i + step - 1 < bytes.length; i += step) {
    const code = step === 2 ? (bytes[i] << 8) | bytes[i + 1] : bytes[i];
    const ch = font.map.get(code) ?? font.fallback(code);
    s += ch;
    width += font.widths.get(code) ?? font.defaultWidth ?? estimateWidth(ch);
  }
  return { text: s, width };
}

interface TextState {
  out: string[];
  lastY: number | null;
  lastXEnd: number;
  x: number;
  y: number;
  lineX: number;
  lineY: number;
  leading: number;
  size: number;
  scale: number;
  font: FontMap;
}

/** `width` en millièmes de cadratin. */
function emit(st: TextState, text: string, width: number): void {
  if (!text) return;
  const eff = Math.max(1, Math.abs(st.size * st.scale));
  if (st.lastY !== null && Math.abs(st.y - st.lastY) > eff * 0.5) {
    st.out.push("\n");
  } else if (st.lastY !== null && st.x - st.lastXEnd > eff * 0.15) {
    const prev = st.out[st.out.length - 1] ?? "";
    if (!/\s$/.test(prev) && !/^\s/.test(text)) st.out.push(" ");
  }
  st.out.push(text);
  st.lastY = st.y;
  st.lastXEnd = st.x + (width / 1000) * eff;
  st.x = st.lastXEnd;
}

function runContent(doc: PdfDoc, data: Uint8Array, resources: Map<string, PdfValue> | null, st: TextState, depth: number): void {
  if (depth > 4) return;
  const fonts = doc.dict(resources?.get("Font"));
  const xobjects = doc.dict(resources?.get("XObject"));
  const fontCache = new Map<string, FontMap>();
  const lex = new Lexer(data);
  const stack: PdfValue[] = [];
  for (let guard = 0; guard < 2_000_000 && lex.pos < lex.end; guard++) {
    lex.skipWs();
    if (lex.pos >= lex.end) break;
    const c = data[lex.pos];
    if (c === 47 || c === 40 || c === 60 || c === 91 || /[0-9+\-.]/.test(String.fromCharCode(c))) {
      const before = lex.pos;
      const v = lex.value();
      if (v) stack.push(v);
      if (lex.pos === before) lex.pos++;
      if (stack.length > 1000) stack.splice(0, stack.length - 100);
      continue;
    }
    const op = lex.word();
    if (!op) {
      lex.pos++;
      continue;
    }
    const nums = () => stack.map((x) => (x.k === "num" ? x.v : 0));
    switch (op) {
      case "BT":
        st.x = st.lineX = 0;
        st.y = st.lineY = 0;
        break;
      case "Tf": {
        const name = stack[stack.length - 2];
        const size = stack[stack.length - 1];
        if (name?.k === "name") {
          if (!fontCache.has(name.v)) fontCache.set(name.v, fontMap(doc, fonts?.get(name.v)));
          st.font = fontCache.get(name.v)!;
        }
        if (size?.k === "num") st.size = size.v;
        break;
      }
      case "Tm": {
        const [a, b, , d, e, f] = nums().slice(-6);
        st.scale = Math.hypot(a ?? 1, b ?? 0) || Math.abs(d ?? 1) || 1;
        st.x = st.lineX = e ?? 0;
        st.y = st.lineY = f ?? 0;
        break;
      }
      case "Td":
      case "TD": {
        const [tx, ty] = nums().slice(-2);
        st.lineX += (tx ?? 0) * st.scale;
        st.lineY += (ty ?? 0) * st.scale;
        st.x = st.lineX;
        st.y = st.lineY;
        if (op === "TD") st.leading = -(ty ?? 0);
        break;
      }
      case "TL":
        st.leading = nums().slice(-1)[0] ?? 0;
        break;
      case "T*":
        st.lineY -= (st.leading || st.size * 1.2) * st.scale;
        st.x = st.lineX;
        st.y = st.lineY;
        break;
      case "Tj":
      case "'":
      case '"': {
        if (op !== "Tj") {
          st.lineY -= (st.leading || st.size * 1.2) * st.scale;
          st.x = st.lineX;
          st.y = st.lineY;
        }
        const s = stack[stack.length - 1];
        if (s?.k === "str") {
          const d = decodeString(s.v, st.font);
          emit(st, d.text, d.width);
        }
        break;
      }
      case "TJ": {
        const arr = stack[stack.length - 1];
        if (arr?.k === "arr") {
          let piece = "";
          let width = 0;
          for (const it of arr.v) {
            if (it.k === "str") {
              const d = decodeString(it.v, st.font);
              piece += d.text;
              width += d.width;
            } else if (it.k === "num") {
              width -= it.v;
              if (it.v < -180 && !piece.endsWith(" ")) piece += " ";
            }
          }
          emit(st, piece, width);
        }
        break;
      }
      case "Do": {
        const name = stack[stack.length - 1];
        const ref = name?.k === "name" ? xobjects?.get(name.v) : undefined;
        if (ref?.k === "ref") {
          const x = doc.objects.get(ref.n);
          if (x?.value.k === "dict" && doc.nameOf(x.value.v.get("Subtype")) === "Form") {
            const content = doc.stream(ref.n);
            if (content) runContent(doc, content, doc.dict(x.value.v.get("Resources")) ?? resources, st, depth + 1);
          }
        }
        break;
      }
      case "ID": {
        // Image dans le flux : on saute ses octets jusqu'à « EI ».
        const end = indexOfBytes(data, "EI", lex.pos);
        lex.pos = end < 0 ? data.length : end + 2;
        break;
      }
      default:
        break;
    }
    stack.length = 0;
  }
}

function pageContents(doc: PdfDoc, page: Map<string, PdfValue>): Uint8Array[] {
  const c = page.get("Contents");
  const refs: PdfValue[] = c?.k === "arr" ? c.v : c ? [c] : [];
  const r = doc.resolve(c);
  const list = r?.k === "arr" ? r.v : refs;
  const out: Uint8Array[] = [];
  for (const ref of list) {
    if (ref.k !== "ref") continue;
    const s = doc.stream(ref.n);
    if (s) out.push(s);
  }
  return out;
}

function pageJpegs(doc: PdfDoc, resources: Map<string, PdfValue> | null): Uint8Array[] {
  const xobjects = doc.dict(resources?.get("XObject"));
  const out: Uint8Array[] = [];
  for (const ref of xobjects?.values() ?? []) {
    if (ref.k !== "ref") continue;
    const x = doc.objects.get(ref.n);
    if (!x?.raw || x.value.k !== "dict" || doc.nameOf(x.value.v.get("Subtype")) !== "Image") continue;
    const f = doc.resolve(x.value.v.get("Filter"));
    const isJpeg = (f?.k === "name" && (f.v === "DCTDecode" || f.v === "DCT")) || (f?.k === "arr" && f.v.length === 1 && doc.nameOf(f.v[0]) === "DCTDecode");
    const w = doc.num(x.value.v.get("Width")) ?? 0;
    if (isJpeg && w >= 400 && x.raw[0] === 0xff && x.raw[1] === 0xd8) out.push(x.raw);
  }
  return out;
}

/** Lit un PDF. Ne lance jamais d'exception : un fichier illisible donne un texte vide. */
export function extractPdfText(bytes: Uint8Array): PdfResult {
  const empty: PdfResult = { text: "", pages: 0, encrypted: false, scans: [] };
  if (bytes.length < 8 || indexOfBytes(bytes, "%PDF", 0, Math.min(bytes.length, 1024)) < 0) return empty;
  let doc: PdfDoc;
  try {
    doc = new PdfDoc(bytes);
  } catch {
    return empty;
  }
  if (doc.encrypted) return { ...empty, encrypted: true };
  const pages = doc.pages();
  const texts: string[] = [];
  const scans: Uint8Array[] = [];
  let total = 0;
  for (const p of pages) {
    const st: TextState = { out: [], lastY: null, lastXEnd: 0, x: 0, y: 0, lineX: 0, lineY: 0, leading: 0, size: 10, scale: 1, font: fontMap(doc, undefined) };
    try {
      for (const content of pageContents(doc, p.dict)) runContent(doc, content, p.resources, st, 0);
    } catch {
      /* page abîmée ou trop grosse : on garde ce qui a été lu */
    }
    const text = st.out.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\u0000/g, "").trim();
    if (text.replace(/\s/g, "").length < 20) {
      try {
        scans.push(...pageJpegs(doc, p.resources));
      } catch {
        /* image illisible */
      }
    }
    texts.push(text);
    total += text.length;
    if (total > MAX_TEXT) break;
  }
  return { text: texts.filter(Boolean).join("\n\n").slice(0, MAX_TEXT), pages: pages.length, encrypted: false, scans: scans.slice(0, MAX_PAGES) };
}
