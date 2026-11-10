import { unzlibSync } from "fflate";

export interface GrayImage {
  width: number;
  height: number;
  /** Une valeur 0–255 par pixel, ligne par ligne. */
  data: Uint8Array;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = new Int16Array(256).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;
B64_INDEX["-".charCodeAt(0)] = 62;
B64_INDEX["_".charCodeAt(0)] = 63;

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/_-]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64_INDEX[clean.charCodeAt(i)];
    const b = B64_INDEX[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_INDEX[clean.charCodeAt(i + 2)] : -1;
    const d = i + 3 < clean.length ? B64_INDEX[clean.charCodeAt(i + 3)] : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

const MAX_PIXELS = 4_000_000;

/** Décode un PNG (8 bits, non entrelacé : ce que produit le téléphone) en niveaux de gris. */
export function decodePngGray(bytes: Uint8Array): GrayImage {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || sig.some((b, i) => bytes[i] !== b)) throw new Error("pas un PNG");
  const u32 = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = -1;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (at + 8 <= bytes.length) {
    const len = u32(at);
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    const body = bytes.subarray(at + 8, at + 8 + len);
    if (body.length < len) throw new Error("PNG coupé");
    if (type === "IHDR") {
      width = u32(at + 8);
      height = u32(at + 12);
      depth = body[8];
      color = body[9];
      interlace = body[12];
    } else if (type === "PLTE") palette = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  if (!width || !height || width * height > MAX_PIXELS) throw new Error("PNG trop grand ou vide");
  if (depth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(color)) throw new Error("PNG non pris en charge");
  if (color === 3 && !palette) throw new Error("PNG sans palette");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color as 0 | 2 | 3 | 4 | 6];
  const stride = width * channels;
  let total = 0;
  for (const c of idat) total += c.length;
  const packed = new Uint8Array(total);
  let p = 0;
  for (const c of idat) {
    packed.set(c, p);
    p += c.length;
  }
  const raw = unzlibSync(packed, { out: new Uint8Array((stride + 1) * height) });
  if (raw.length < (stride + 1) * height) throw new Error("PNG incomplet");

  const gray = new Uint8Array(width * height);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error("PNG abîmé");
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const i = x * channels;
      let r: number;
      let g: number;
      let bl: number;
      if (color === 0 || color === 4) r = g = bl = cur[i];
      else if (color === 3) {
        const k = cur[i] * 3;
        r = palette![k] ?? 0;
        g = palette![k + 1] ?? 0;
        bl = palette![k + 2] ?? 0;
      } else {
        r = cur[i];
        g = cur[i + 1];
        bl = cur[i + 2];
      }
      gray[y * width + x] = (r * 299 + g * 587 + bl * 114) / 1000;
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: gray };
}

export type PhotoProblem = "sombre" | "flou" | "reflet";

export interface PhotoQuality {
  brightness: number;
  contrast: number;
  /** Variance du laplacien rapportée au contraste : ne dépend presque pas du contenu de la photo. */
  sharpness: number;
  glare: number;
  problems: PhotoProblem[];
}

/**
 * Seuils prudents (copie de ~320 px de large) : on préfère se taire qu'embêter pour rien.
 * Netteté mesurée sur photos simulées : nette ≈ 0,77 ; flou de 1 px ≈ 0,12 ; 2 px ≈ 0,033 ; 3 px ≈ 0,018.
 */
export const QUALITY_LIMITS = { dark: 65, blur: 0.03, glareMin: 0.05, glareMax: 0.6, glareMedian: 235, minContrast: 18 };

export function photoQuality(img: GrayImage): PhotoQuality {
  const { width: w, height: h, data } = img;
  let sum = 0;
  let sq = 0;
  let bright = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    sq += data[i] * data[i];
    hist[data[i]]++;
    if (data[i] >= 250) bright++;
  }
  const n = data.length;
  let median = 0;
  for (let acc = 0; median < 255 && acc + hist[median] < n / 2; median++) acc += hist[median];
  const brightness = sum / n;
  const contrast = Math.sqrt(Math.max(0, sq / n - brightness * brightness));
  // Netteté : variance du laplacien (les bords nets donnent de grands écarts).
  let ls = 0;
  let lq = 0;
  let m = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      ls += l;
      lq += l * l;
      m++;
    }
  const mean = m ? ls / m : 0;
  const sharpness = m ? (lq / m - mean * mean) / Math.max(1, contrast * contrast) : 0;
  const glare = bright / n;
  const problems: PhotoProblem[] = [];
  if (brightness < QUALITY_LIMITS.dark) problems.push("sombre");
  else if (sharpness < QUALITY_LIMITS.blur && contrast >= QUALITY_LIMITS.minContrast) problems.push("flou");
  // Reflet = une tache « brûlée » sur une page qui, elle, n'est pas blanche partout (un scan propre sur fond blanc
  // pur n'a pas de reflet).
  if (glare >= QUALITY_LIMITS.glareMin && glare <= QUALITY_LIMITS.glareMax && median < QUALITY_LIMITS.glareMedian) problems.push("reflet");
  return { brightness, contrast, sharpness, glare, problems };
}

export const PROBLEM_TEXT: Record<PhotoProblem, string> = {
  sombre: "La photo est trop sombre : mets-toi près d’une fenêtre ou allume la lumière.",
  flou: "La photo est floue : tiens le téléphone bien immobile, à 30 cm du papier.",
  reflet: "Il y a un gros reflet : penche un peu le papier ou éteins le flash.",
};

/** Seuil d'Otsu : sépare au mieux les pixels clairs (papier) des sombres (fond). */
export function otsu(data: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;
  const total = data.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

export interface CropBox {
  /** Proportions de l'image (0 à 1), à appliquer à la photo en pleine taille. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** La feuille : la plus grande zone claire, assez rectangulaire, nettement plus claire que le fond. */
export function findPage(img: GrayImage): CropBox | null {
  const { width: w, height: h, data } = img;
  const t = otsu(data);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) mask[i] = data[i] > t ? 1 : 0;
  // Plus grande composante claire (4 voisins), parcours en largeur.
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let best = { size: 0, x0: 0, y0: 0, x1: 0, y1: 0, sum: 0 };
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let sum = 0;
    const visit = (j: number) => {
      if (mask[j] && !seen[j]) {
        seen[j] = 1;
        queue[tail++] = j;
      }
    };
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i - x) / w;
      sum += data[i];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y > 0) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
    if (tail > best.size) best = { size: tail, x0, y0, x1, y1, sum };
  }
  const total = w * h;
  const bw = best.x1 - best.x0 + 1;
  const bh = best.y1 - best.y0 + 1;
  const boxArea = bw * bh;
  if (best.size < total * 0.2) return null; // pas de grande feuille claire
  if (boxArea > total * 0.9) return null; // la feuille remplit déjà la photo
  if (best.size / boxArea < 0.6) return null; // forme trop irrégulière : on ne devine pas
  // La feuille doit être nettement plus claire que ce qui l'entoure.
  let outSum = 0;
  let outN = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < best.x0 || x > best.x1 || y < best.y0 || y > best.y1) {
        outSum += data[y * w + x];
        outN++;
      }
  if (outN && best.sum / best.size - outSum / outN < 40) return null;
  // Petite marge, pour ne jamais couper le bord du texte.
  const mx = Math.round(w * 0.02);
  const my = Math.round(h * 0.02);
  const x0 = Math.max(0, best.x0 - mx);
  const y0 = Math.max(0, best.y0 - my);
  const x1 = Math.min(w - 1, best.x1 + mx);
  const y1 = Math.min(h - 1, best.y1 + my);
  return { x: x0 / w, y: y0 / h, width: (x1 - x0 + 1) / w, height: (y1 - y0 + 1) / h };
}

/** Rectangle en pixels pour la photo en pleine taille, toujours dans l'image. */
export function cropRect(box: CropBox, fullWidth: number, fullHeight: number): { originX: number; originY: number; width: number; height: number } {
  const originX = Math.max(0, Math.floor(box.x * fullWidth));
  const originY = Math.max(0, Math.floor(box.y * fullHeight));
  const width = Math.max(1, Math.min(fullWidth - originX, Math.ceil(box.width * fullWidth)));
  const height = Math.max(1, Math.min(fullHeight - originY, Math.ceil(box.height * fullHeight)));
  return { originX, originY, width, height };
}
