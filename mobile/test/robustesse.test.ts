import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import type { Lang } from "../src/engine/i18n.ts";
import { TOUS } from "./corpus/index.ts";
import { BRUITS_DURS, BRUITS_STRICTS, choisir, entier, hasard } from "./outils/bruit.ts";
import { comparer, decrire, TODAY, verifierFiche } from "./outils/fiche.ts";

const fr = { today: TODAY, language: "fr" as const };
const GRAINES = [1, 2, 3];

describe("photo abîmée : la fiche ne doit pas changer", () => {
  for (const [nom, bruit] of Object.entries(BRUITS_STRICTS)) {
    test(`${nom} (${TOUS.length} papiers × ${GRAINES.length} tirages)`, () => {
      const rates: string[] = [];
      for (const p of TOUS) {
        for (const graine of GRAINES) {
          const texte = bruit(p.texte, hasard(graine * 7919 + p.id.length));
          const r = analyzeText(texte, { today: p.today ?? TODAY, language: "fr" });
          const ecarts = comparer(r, { ...p.attendu, extrait: undefined, resume: undefined }, true);
          const fiche = verifierFiche(r, texte);
          if (ecarts.length || fiche.length) rates.push(`• ${p.id} (tirage ${graine})\n${decrire(ecarts)}${fiche.map((f) => `\n  fiche : ${f}`).join("")}`);
        }
      }
      assert.equal(rates.length, 0, `${rates.length} ratés :\n${rates.slice(0, 12).join("\n")}`);
    });
  }
});

describe("photo très abîmée : taux de réussite minimum", () => {
  // Lettres confondues, blocs dans le désordre : on n'exige pas 100 %, on interdit de régresser.
  const SEUILS: Record<string, number> = { lettres_ocr: 0.97, blocs_melanges: 0.97 };
  for (const [nom, bruit] of Object.entries(BRUITS_DURS)) {
    test(`${nom} : au moins ${SEUILS[nom] * 100} % des champs justes`, () => {
      let justes = 0;
      let total = 0;
      for (const p of TOUS) {
        for (const graine of [11, 12, 13, 14, 15]) {
          const texte = bruit(p.texte, hasard(graine * 104729 + p.id.length));
          const r = analyzeText(texte, fr);
          assert.deepEqual(verifierFiche(r, texte), [], p.id);
          const champs = Object.keys(p.attendu).filter((k) => !["extrait", "resume"].includes(k)).length;
          const faux = new Set(comparer(r, { ...p.attendu, extrait: undefined, resume: undefined }, true).map((e) => e.champ)).size;
          total += champs;
          justes += champs - faux;
        }
      }
      assert.ok(justes / total >= SEUILS[nom], `${((justes / total) * 100).toFixed(1)} % seulement`);
    });
  }
});

const POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZéèêàçùôÉÈ0123456789      \n\n.,;:!?'’\"-–—/()[]{}<«»€$%@#*&+=_|~^°²\t  😀🧾📄مرحباשלום中文\u0000�";

describe("textes absurdes : jamais de plantage, toujours une fiche cohérente", () => {
  test("2 000 textes aléatoires", () => {
    const rnd = hasard(2026);
    for (let i = 0; i < 2000; i++) {
      const n = entier(rnd, 0, i % 50 === 0 ? 20_000 : 600);
      let t = "";
      for (let j = 0; j < n; j++) t += POOL[Math.floor(rnd() * POOL.length)];
      const r = analyzeText(t, fr);
      const p = verifierFiche(r, t);
      assert.deepEqual(p, [], `texte n° ${i} : ${JSON.stringify(t.slice(0, 80))}`);
    }
  });

  test("1 000 salades de lignes tirées du corpus", () => {
    const rnd = hasard(77);
    const allLines = TOUS.flatMap((p) => p.texte.split("\n"));
    for (let i = 0; i < 1000; i++) {
      const t = Array.from({ length: entier(rnd, 1, 40) }, () => choisir(rnd, allLines)).join("\n");
      const r = analyzeText(t, fr);
      assert.deepEqual(verifierFiche(r, t), [], t.slice(0, 200));
    }
  });

  test("cas limites", () => {
    const cas = [
      "", " ", "\n\n\n", "\u0000", "\uD800", "\uDFFF\uD800", "€", "€€€€", "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
      "31/02/2026", "00/00/0000", "99/99/9999", "le 0 janvier 2026", "le 32 décembre 2026", "29/02/2027", "29/02/2028",
      "Montant : 99 999 999 999 €", "Montant : -50,00 €", "Montant à payer : 0,00 €", "1,2,3,4,5,6,7,8,9 €",
      "dans un délai de 999 jours", "dans un délai de 0 jour", "sous 400 mois", "avant le 15/12/1899", "avant le 15/12/2101",
      "P<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
      "IBAN FR76 3000 6000 0112 3456 7890 189 et FR14 2004 1010 0505 0001 3M02 606",
      "N° de sécurité sociale : 1 85 05 75 123 456 78",
      "مرحبا، هذه رسالة من الإدارة. يجب الدفع قبل 15/12/2026",
      "🧾".repeat(500),
    ];
    for (const t of cas) {
      const r = analyzeText(t, fr);
      assert.deepEqual(verifierFiche(r, t), [], JSON.stringify(t));
    }
  });
});

describe("textes géants : réponse rapide (pas de blocage)", () => {
  const PIEGES: [string, string][] = [
    ["chiffres et espaces", "1 ".repeat(50_000)],
    ["groupes de milliers sans €", "123 ".repeat(30_000)],
    ["groupes de milliers puis €", `${"123 ".repeat(30_000)}€`],
    ["points et chiffres", "1.".repeat(50_000)],
    ["barres obliques", "1/1/".repeat(25_000)],
    ["tirets", "12-".repeat(30_000)],
    ["euros", "€".repeat(100_000)],
    ["lettres", "a".repeat(200_000)],
    ["chevrons MRZ", `${"<".repeat(44)}\n`.repeat(3_000)],
    ["délais en boucle", "dans un délai de ".repeat(10_000)],
    ["indices de date limite", "avant le au plus tard le ".repeat(8_000)],
    ["une seule ligne immense", "Montant à payer 12,00 € avant le 12/12/2026 ".repeat(4_000)],
    ["10 000 lignes", "Madame, Monsieur,\n".repeat(10_000)],
    ["virgules", ",".repeat(100_000)],
    ["apostrophes", "'".repeat(100_000)],
  ];
  for (const [nom, t] of PIEGES) {
    test(`${nom} (${Math.round(t.length / 1000)} k caractères) en moins de 1,5 s`, () => {
      const start = performance.now();
      const r = analyzeText(t, fr);
      const ms = performance.now() - start;
      assert.deepEqual(verifierFiche(r, t), []);
      assert.ok(ms < 1500, `${Math.round(ms)} ms`);
    });
  }

  test("corpus complet : moins de 2 ms par papier en moyenne", () => {
    const start = performance.now();
    const n = 20;
    for (let i = 0; i < n; i++) for (const p of TOUS) analyzeText(p.texte, fr);
    const perDoc = (performance.now() - start) / (n * TOUS.length);
    assert.ok(perDoc < 2, `${perDoc.toFixed(2)} ms par papier`);
  });
});

describe("cohérence", () => {
  test("le même texte donne toujours la même fiche", () => {
    for (const p of TOUS) assert.deepEqual(analyzeText(p.texte, fr), analyzeText(p.texte, fr), p.id);
  });

  test("le jour qui passe ne change ni le type, ni l'organisme, ni les dates, ni le montant", () => {
    for (const p of TOUS) {
      const a = analyzeText(p.texte, fr);
      const b = analyzeText(p.texte, { today: "2026-11-23", language: "fr" });
      for (const k of ["type_document", "categorie", "organisme", "emetteur", "date_limite", "date_expiration", "montant", "montant_sens"] as const) {
        assert.equal(b[k], a[k], `${p.id} · ${k}`);
      }
    }
  });

  test("plus la date limite approche, plus c'est urgent (jamais l'inverse)", () => {
    const rank = { aucune: 0, faible: 1, moyenne: 2, haute: 3 } as const;
    for (const p of TOUS) {
      const a = analyzeText(p.texte, fr);
      if (!a.a_traiter || !a.date_limite) continue;
      let prev = rank[a.urgence];
      for (const jour of ["2026-11-12", "2026-11-20", "2026-12-01", "2026-12-20"]) {
        if (jour > a.date_limite) break;
        const u = rank[analyzeText(p.texte, { today: jour, language: "fr" }).urgence];
        assert.ok(u >= prev, `${p.id} : moins urgent le ${jour}`);
        prev = u;
      }
    }
  });

  test("une date limite n'est jamais avant la date du courrier", () => {
    for (const p of TOUS) {
      const a = analyzeText(p.texte, fr);
      if (a.date_limite && a.date_document) assert.ok(a.date_limite >= a.date_document, p.id);
    }
  });

  test("ajouter des lignes vides ou des espaces autour ne change rien", () => {
    for (const p of TOUS) {
      const a = analyzeText(p.texte, fr);
      const b = analyzeText(`\n\n  ${p.texte.replace(/\n/g, "\n\n")}  \n\n`, fr);
      for (const k of ["type_document", "categorie", "organisme", "date_limite", "date_document", "montant", "a_traiter", "urgence"] as const) {
        assert.equal(b[k], a[k], `${p.id} · ${k}`);
      }
    }
  });
});

describe("langues", () => {
  const LANGS: Lang[] = ["fr", "en", "es", "ar"];
  test(`${TOUS.length} papiers × ${LANGS.length} langues : explication complète, jamais de trou`, () => {
    for (const p of TOUS) {
      const fiches = LANGS.map((language) => analyzeText(p.texte, { today: TODAY, language }));
      for (const [i, f] of fiches.entries()) {
        assert.deepEqual(verifierFiche(f, p.texte), [], `${p.id} (${LANGS[i]})`);
        // La langue ne change pas les faits.
        assert.equal(f.date_limite, fiches[0].date_limite);
        assert.equal(f.montant, fiches[0].montant);
        assert.equal(f.a_traiter, fiches[0].a_traiter);
        assert.equal(f.actions.length, fiches[0].actions.length, `${p.id} (${LANGS[i]}) : nombre d'étapes`);
      }
      for (let i = 1; i < LANGS.length; i++) assert.notEqual(fiches[i].resume, fiches[0].resume, `${p.id} : résumé non traduit en ${LANGS[i]}`);
      assert.match(fiches[3].resume, /[؀-ۿ]/, `${p.id} : pas d'arabe`);
    }
  });
});

describe("vie privée", () => {
  test("IBAN et numéro de sécurité sociale toujours masqués dans la fiche", () => {
    const t = `Madame,\nIBAN : FR76 3000 6000 0112 3456 7890 189\nN° de sécurité sociale : 1 85 05 75 123 456 78\nMerci de nous retourner ce formulaire avant le 30/11/2026.`;
    const r = analyzeText(t, fr);
    assert.deepEqual(verifierFiche(r, t), []);
    assert.equal(r.infos_cles.find((f) => f.label === "IBAN")?.valeur, "FR76 •••• •••• 0189");
    assert.equal(r.infos_cles.find((f) => f.label === "N° de sécurité sociale")?.valeur, "1850 •••• •••• 5678");
  });
});

test("aucun ratage silencieux : chaque papier du corpus a au moins 5 attentes", () => {
  for (const p of TOUS) assert.ok(Object.keys(p.attendu).length >= 5 || p.id === "texte-presque-vide", p.id);
});
