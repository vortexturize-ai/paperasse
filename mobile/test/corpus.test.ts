import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import { CORPUS } from "./corpus/index.ts";
import { FAMILLES } from "./corpus/familles.ts";
import { comparer, decrire, TODAY, verifierFiche } from "./outils/fiche.ts";

for (const [nom, papiers] of Object.entries(CORPUS)) {
  describe(`corpus · ${nom}`, () => {
    for (const p of papiers) {
      test(p.id, () => {
        const r = analyzeText(p.texte, { today: p.today ?? TODAY, language: "fr" });
        const ecarts = comparer(r, p.attendu);
        assert.equal(ecarts.length, 0, `\n${decrire(ecarts)}\n  (résumé : ${r.resume})`);
        assert.deepEqual(verifierFiche(r, p.texte), []);
      });
    }
  });
}

describe("familles générées", () => {
  for (const [nom, generer] of Object.entries(FAMILLES)) {
    const papiers = generer();
    test(`${nom} (${papiers.length} cas)`, () => {
      const rates: string[] = [];
      for (const p of papiers) {
        const r = analyzeText(p.texte, { today: p.today ?? TODAY, language: "fr" });
        const ecarts = comparer(r, p.attendu);
        const fiche = verifierFiche(r, p.texte);
        if (ecarts.length || fiche.length) rates.push(`• ${p.id}\n${decrire(ecarts)}${fiche.map((f) => `\n  fiche : ${f}`).join("")}`);
      }
      assert.equal(rates.length, 0, `${rates.length}/${papiers.length} ratés :\n${rates.slice(0, 15).join("\n")}${rates.length > 15 ? `\n… et ${rates.length - 15} autres` : ""}`);
    });
  }
});
