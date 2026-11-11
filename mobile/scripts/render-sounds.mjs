// Fabrique les petits sons de l'interface (assets/sounds/*.wav) : synthétisés ici, rien d'emprunté.
// Courts, doux, sans claquement au début ni à la fin. `npm run sounds` pour les refaire.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44_100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");

/** Note avec glissement de hauteur et enveloppe (attaque, puis décroissance exponentielle). */
function tone({ from, to = from, ms, attack = 2, decay, gain = 1, harmonics = [1], start = 0 }) {
  return { from, to, ms, attack, decay: decay ?? ms / 3, gain, harmonics, start };
}

function render(notes, totalMs, peak) {
  const n = Math.round((totalMs / 1000) * RATE);
  const out = new Float64Array(n);
  for (const t of notes) {
    const begin = Math.round((t.start / 1000) * RATE);
    const len = Math.min(n - begin, Math.round((t.ms / 1000) * RATE));
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const s = i / RATE;
      const k = i / len;
      const f = t.from * Math.pow(t.to / t.from, k); // glissement exponentiel : plus naturel à l'oreille
      phase += (2 * Math.PI * f) / RATE;
      const env = Math.min(1, s / (t.attack / 1000)) * Math.exp(-s / (t.decay / 1000));
      let v = 0;
      t.harmonics.forEach((h, j) => (v += h * Math.sin(phase * (j + 1))));
      out[begin + i] += v * env * t.gain;
    }
  }
  // Fondu de 4 ms à la fin, puis volume ramené au maximum voulu (en dBFS).
  const fade = Math.round(0.004 * RATE);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  const max = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const scale = Math.pow(10, peak / 20) / max;
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(out[i] * scale * 32767);
  return pcm;
}

function wav(pcm) {
  const data = Buffer.from(pcm.buffer);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SOUNDS = {
  // Appui sur un bouton : petit « pop » rond qui descend.
  tap: render([tone({ from: 880, to: 620, ms: 55, attack: 1.5, decay: 14, harmonics: [1, 0.18] })], 60, -14),
  // Choix d'une pastille ou d'un onglet : « tic » léger et aigu.
  select: render([tone({ from: 1500, to: 1320, ms: 32, attack: 1, decay: 7, harmonics: [1, 0.1] })], 36, -18),
  // Interrupteur : deux gouttes qui montent (oui) ou qui descendent (non).
  toggleOn: render(
    [tone({ from: 760, ms: 40, decay: 11, harmonics: [1, 0.15] }), tone({ from: 1140, ms: 55, decay: 14, harmonics: [1, 0.15], start: 42 })],
    100,
    -15,
  ),
  toggleOff: render(
    [tone({ from: 1140, ms: 40, decay: 11, harmonics: [1, 0.15] }), tone({ from: 760, ms: 55, decay: 14, harmonics: [1, 0.15], start: 42 })],
    100,
    -15,
  ),
  // Gros bouton « + » : bulle qui monte.
  pop: render([tone({ from: 420, to: 980, ms: 70, attack: 2, decay: 22, harmonics: [1, 0.25, 0.05] })], 80, -13),
  // Réussite (« C'est fait ! », papier rangé) : deux notes claires, une quinte qui monte (do, sol).
  success: render(
    [
      tone({ from: 1046.5, ms: 240, attack: 4, decay: 70, harmonics: [1, 0.3, 0.08] }),
      tone({ from: 1568, ms: 360, attack: 4, decay: 120, harmonics: [1, 0.3, 0.08], start: 95 }),
    ],
    460,
    -12,
  ),
};

mkdirSync(OUT, { recursive: true });
for (const [name, pcm] of Object.entries(SOUNDS)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(pcm));
  console.log(`${name}.wav  ${Math.round((pcm.length / RATE) * 1000)} ms`);
}
