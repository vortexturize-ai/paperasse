import { analyzeText } from "../src/engine/analyze.ts";
import { TOUS } from "../test/corpus/index.ts";
import { FAMILLES } from "../test/corpus/familles.ts";
import { BRUITS_DURS, BRUITS_STRICTS, hasard, type Bruit } from "../test/outils/bruit.ts";
import { CHAMPS_FIABILITE, comparer, TODAY, type Champ, type Papier } from "../test/outils/fiche.ts";

type Score = Partial<Record<Champ, [ok: number, total: number]>>;

function mesurer(papiers: Papier[], bruit: Bruit | null, graines: number[]): { score: Score; papiersOk: number; total: number; ms: number } {
  const score: Score = {};
  let papiersOk = 0;
  let total = 0;
  const start = performance.now();
  for (const p of papiers) {
    for (const g of graines) {
      const texte = bruit ? bruit(p.texte, hasard(g * 7919 + p.id.length)) : p.texte;
      const r = analyzeText(texte, { today: p.today ?? TODAY, language: "fr" });
      const faux = new Set(comparer(r, { ...p.attendu, extrait: undefined, resume: undefined }, bruit !== null).map((e) => e.champ));
      total++;
      if (faux.size === 0) papiersOk++;
      for (const champ of CHAMPS_FIABILITE) {
        if (p.attendu[champ] === undefined) continue;
        const s = (score[champ] ??= [0, 0]);
        s[1]++;
        if (!faux.has(champ)) s[0]++;
      }
    }
  }
  return { score, papiersOk, total, ms: performance.now() - start };
}

const pct = (ok: number, total: number) => (total ? `${((ok / total) * 100).toFixed(1)} %` : "—");

const lignes: [string, ReturnType<typeof mesurer>][] = [["Papiers propres (corpus écrit à la main)", mesurer(TOUS, null, [0])]];
for (const [nom, gen] of Object.entries(FAMILLES)) lignes.push([`Famille : ${nom}`, mesurer(gen(), null, [0])]);
for (const [nom, b] of Object.entries(BRUITS_STRICTS)) lignes.push([`Photo abîmée : ${nom}`, mesurer(TOUS, b, [1, 2, 3])]);
for (const [nom, b] of Object.entries(BRUITS_DURS)) lignes.push([`Photo très abîmée : ${nom}`, mesurer(TOUS, b, [11, 12, 13, 14, 15])]);

const champs = CHAMPS_FIABILITE.filter((c) => lignes.some(([, m]) => m.score[c]));
console.log(`\nFiabilité du Moteur Paperasse — ${new Date().toISOString().slice(0, 10)}\n`);
console.log(["Condition", "Papiers 100 % justes", ...champs, "ms/papier"].join(" | "));
console.log(["---", "---", ...champs.map(() => "---"), "---"].join(" | "));
let cas = 0;
for (const [nom, m] of lignes) {
  cas += m.total;
  console.log([nom, `${m.papiersOk}/${m.total} (${pct(m.papiersOk, m.total)})`, ...champs.map((c) => (m.score[c] ? pct(...m.score[c]!) : "—")), (m.ms / m.total).toFixed(2)].join(" | "));
}
console.log(`\n${cas} analyses au total.\n`);
