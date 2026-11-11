// Les sons de l'interface doivent rester discrets : courts, pas trop forts, sans claquement au début ni à la fin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "assets", "sounds");
const EXPECTED = ["pop", "select", "success", "tap", "toggleOff", "toggleOn"];

function read(name: string) {
  const b = readFileSync(join(DIR, `${name}.wav`));
  assert.equal(b.toString("latin1", 0, 4), "RIFF", name);
  assert.equal(b.toString("latin1", 8, 12), "WAVE", name);
  assert.equal(b.readUInt16LE(20), 1, `${name} : PCM`);
  assert.equal(b.readUInt16LE(22), 1, `${name} : mono`);
  assert.equal(b.readUInt32LE(24), 44_100, name);
  assert.equal(b.readUInt16LE(34), 16, `${name} : 16 bits`);
  assert.equal(b.toString("latin1", 36, 40), "data", name);
  const n = b.readUInt32LE(40) / 2;
  const samples = Array.from({ length: n }, (_, i) => b.readInt16LE(44 + 2 * i) / 32768);
  return { seconds: n / 44_100, samples };
}

test("sons de l'interface : tous là, au bon format", () => {
  assert.deepEqual(readdirSync(DIR).filter((f) => f.endsWith(".wav")).map((f) => f.replace(".wav", "")).sort(), EXPECTED);
});

test("sons discrets : courts, jamais forts, sans claquement", () => {
  for (const name of EXPECTED) {
    const { seconds, samples } = read(name);
    const peakDb = 20 * Math.log10(Math.max(...samples.map(Math.abs)));
    assert.ok(seconds <= (name === "success" ? 0.5 : 0.12), `${name} : ${seconds.toFixed(3)} s`);
    assert.ok(peakDb <= -11.9, `${name} : crête à ${peakDb.toFixed(1)} dB (au plus -12 dB)`);
    assert.ok(Math.abs(samples[0]) < 0.01 && Math.abs(samples.at(-1)!) < 0.01, `${name} : commence et finit dans le silence`);
  }
});
