import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, deflateSync } from "node:zlib";
import { cropRect, decodePngGray, findPage, fromBase64, otsu, photoQuality, type GrayImage } from "../src/engine/scan.ts";
import { hasard } from "./outils/bruit.ts";

function chunk(type: string, data: Uint8Array): Buffer {
  const td = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encodeur PNG de test : niveaux de gris ou RGB, avec les 5 filtres de ligne tour à tour. */
function encodePng(img: GrayImage, rgb: boolean): Uint8Array {
  const ch = rgb ? 3 : 1;
  const stride = img.width * ch;
  const rows: number[][] = [];
  for (let y = 0; y < img.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < img.width; x++) {
      const v = img.data[y * img.width + x];
      if (rgb) row.push(v, v, v);
      else row.push(v);
    }
    rows.push(row);
  }
  const out: number[] = [];
  for (let y = 0; y < img.height; y++) {
    const f = y % 5;
    out.push(f);
    for (let x = 0; x < stride; x++) {
      const v = rows[y][x];
      const a = x >= ch ? rows[y][x - ch] : 0;
      const b = y > 0 ? rows[y - 1][x] : 0;
      const c = x >= ch && y > 0 ? rows[y - 1][x - ch] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out.push((v - pred) & 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = rgb ? 2 : 0;
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(out))), chunk("IEND", new Uint8Array(0))]),
  );
}

/** Photo de papier : fond sombre bruité, feuille claire avec des lignes de « texte ». */
function photo(opts: { w?: number; h?: number; page?: [number, number, number, number]; tilt?: number; seed?: number } = {}): GrayImage {
  const w = opts.w ?? 320;
  const h = opts.h ?? 420;
  const [px, py, pw, ph] = opts.page ?? [50, 60, 220, 300];
  const r = hasard(opts.seed ?? 1);
  const data = new Uint8Array(w * h);
  const tilt = opts.tilt ?? 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Rotation légère autour du centre de la feuille.
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      const rx = Math.cos(tilt) * (x - cx) + Math.sin(tilt) * (y - cy) + cx;
      const ry = -Math.sin(tilt) * (x - cx) + Math.cos(tilt) * (y - cy) + cy;
      let v = 70 + Math.floor(r() * 25);
      if (rx >= px && rx < px + pw && ry >= py && ry < py + ph) {
        v = 225 + Math.floor(r() * 10);
        const line = Math.floor(ry - py) % 14;
        const word = Math.floor((rx - px) / 9) % 7;
        if (ry > py + 20 && ry < py + ph - 20 && rx > px + 15 && rx < px + pw - 15 && line < 3 && word !== 6) v = 40;
      }
      data[y * w + x] = v;
    }
  return { width: w, height: h, data };
}

function blur(img: GrayImage, radius: number): GrayImage {
  const { width: w, height: h, data } = img;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
            s += data[yy * w + xx];
            n++;
          }
        }
      out[y * w + x] = Math.round(s / n);
    }
  return { width: w, height: h, data: out };
}

const map = (img: GrayImage, f: (v: number) => number): GrayImage => ({ ...img, data: img.data.map((v) => Math.max(0, Math.min(255, Math.round(f(v))))) });

test("PNG : gris et couleur, 5 filtres de ligne, base64", () => {
  const img = photo({ w: 37, h: 23 });
  for (const rgb of [false, true]) {
    const png = encodePng(img, rgb);
    assert.deepEqual(decodePngGray(png).data, img.data, rgb ? "rgb" : "gris");
    assert.deepEqual(decodePngGray(fromBase64(Buffer.from(png).toString("base64"))).data, img.data);
    assert.deepEqual(decodePngGray(fromBase64("data:image/png;base64," + Buffer.from(png).toString("base64"))).data, img.data);
  }
  assert.throws(() => decodePngGray(new Uint8Array(40)), /pas un PNG/);
  assert.throws(() => decodePngGray(encodePng(img, false).subarray(0, 60)));
});

test("photo nette et bien éclairée : rien à redire", () => {
  const q = photoQuality(photo());
  assert.deepEqual(q.problems, [], JSON.stringify(q));
});

test("photo floue, sombre ou avec reflet : repérée", () => {
  const sharp = photo();
  const fuzzy = photoQuality(blur(sharp, 3));
  assert.ok(fuzzy.problems.includes("flou"), JSON.stringify(fuzzy));
  assert.ok(fuzzy.sharpness < photoQuality(sharp).sharpness / 5);
  assert.deepEqual(photoQuality(map(sharp, (v) => v * 0.25)).problems, ["sombre"]);
  assert.ok(photoQuality(map(sharp, (v) => v * 1.8)).problems.includes("reflet"));
  // Tache de reflet ronde sur la feuille.
  const spot = { ...sharp, data: sharp.data.slice() };
  for (let y = 0; y < spot.height; y++)
    for (let x = 0; x < spot.width; x++) if ((x - 160) ** 2 + (y - 200) ** 2 < 75 ** 2) spot.data[y * spot.width + x] = 255;
  assert.deepEqual(photoQuality(spot).problems, ["reflet"]);
  // Un scan propre sur fond blanc pur (95 % de blanc) n'a pas de reflet (vu sur téléphone le 2026-11-10).
  const clean = { width: 100, height: 100, data: new Uint8Array(10000).fill(255) };
  for (let i = 0; i < 500; i++) clean.data[i * 19] = 30;
  assert.deepEqual(photoQuality(clean).problems, []);
  // Une feuille blanche vide (peu de contraste) n'est pas « floue ».
  assert.ok(!photoQuality({ width: 100, height: 100, data: new Uint8Array(10000).fill(210) }).problems.includes("flou"));
});

test("feuille trouvée : recadrage autour, avec une petite marge, jamais dans le texte", () => {
  const box = findPage(photo())!;
  assert.ok(box);
  const [px, py, pw, ph] = [50 / 320, 60 / 420, 220 / 320, 300 / 420];
  assert.ok(box.x <= px && box.y <= py, "la marge reste dehors");
  assert.ok(box.x + box.width >= px + pw && box.y + box.height >= py + ph, "toute la feuille est gardée");
  assert.ok(box.x > px - 0.04 && box.width < pw + 0.08, JSON.stringify(box));
  // Feuille un peu de travers : toujours trouvée, toujours entière.
  const tilted = findPage(photo({ tilt: 0.08, seed: 3 }))!;
  assert.ok(tilted && tilted.x < px && tilted.x + tilted.width > px + pw);
});

test("dans le doute, pas de recadrage", () => {
  assert.equal(findPage(photo({ page: [5, 5, 310, 410] })), null, "la feuille remplit déjà la photo");
  const r = hasard(9);
  assert.equal(findPage({ width: 200, height: 200, data: Uint8Array.from({ length: 40000 }, () => Math.floor(r() * 256)) }), null, "bruit");
  assert.equal(findPage({ width: 100, height: 100, data: new Uint8Array(10000).fill(128) }), null, "uni");
  assert.equal(findPage(photo({ page: [140, 190, 40, 40] })), null, "trop petit");
});

test("seuil et rectangle en pixels toujours dans l'image", () => {
  const two = new Uint8Array(1000);
  two.fill(30, 0, 500);
  two.fill(220, 500);
  const t = otsu(two);
  assert.ok(t >= 30 && t < 220);
  assert.deepEqual(cropRect({ x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, 1000, 2000), { originX: 100, originY: 400, width: 500, height: 1000 });
  const edge = cropRect({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, 1000, 1000);
  assert.ok(edge.originX + edge.width <= 1000 && edge.originY + edge.height <= 1000);
});
