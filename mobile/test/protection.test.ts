import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { exposureSummary, findPersonalData, isValidIban, isValidNir, luhn, redactText } from "../src/engine/privacy.ts";
import { detectScam } from "../src/engine/scam.ts";
import { TOUS } from "./corpus/index.ts";
import { ARNAQUES, HONNETES } from "./corpus/arnaques.ts";
import { entier, hasard } from "./outils/bruit.ts";

const kinds = (t: string) => findPersonalData(t).map((i) => i.kind);

describe("bouclier : numéros validés par leur clé", () => {
  test("IBAN : clé modulo 97", () => {
    assert.equal(isValidIban("FR76 3000 6000 0112 3456 7890 189"), true);
    assert.equal(isValidIban("FR76 3000 6000 0112 3456 7890 188"), false);
    assert.equal(isValidIban("DE89 3704 0044 0532 0130 00"), true);
  });
  test("sécurité sociale : clé, Corse", () => {
    assert.equal(isValidNir("1 85 05 75 123 456 73"), true);
    assert.equal(isValidNir("1 85 05 75 123 456 74"), false);
    assert.equal(isValidNir("2 90 01 33 063 021 76"), true);
  });
  test("Luhn", () => {
    assert.equal(luhn("4111111111111111"), true);
    assert.equal(luhn("4111111111111112"), false);
  });
});

describe("bouclier : ce qui est trouvé", () => {
  test("numéro de sécurité sociale mal lu par la caméra (« NlR : L 85 … », « 2O3 ») : trouvé quand même", () => {
    const found = findPersonalData("Identifiant (NlR) : L 85 05 75 2O3 456 78\nDate : 03/11/2026");
    assert.ok(found.some((d) => d.kind === "securite_sociale"), JSON.stringify(found));
    assert.ok(!findPersonalData("Merci de fournir 12 justificatifs avant le 03/11/2026").some((d) => d.kind === "securite_sociale"));
  });
  test("chaque sorte de donnée personnelle", () => {
    const t = `Camille EXEMPLE, née le 14/06/1992
25 rue des Fleurs
31000 Toulouse
Mail : camille.exemple@orange.fr — Tél. 06 12 34 56 78 ou +33 6 98 76 54 32
IBAN : FR76 3000 6000 0112 3456 7890 189
N° de sécurité sociale : 1 85 05 75 123 456 73
Numéro fiscal : 12 34 567 890 123
Carte bancaire n° 4111 1111 1111 1111
SIRET : 812 345 678 00027
Passeport n° 19AB12345`;
    const found = kinds(t);
    for (const k of ["date_naissance", "adresse", "email", "telephone", "iban", "securite_sociale", "numero_fiscal", "carte_bancaire", "siret", "passeport"] as const) {
      assert.ok(found.includes(k), `${k} manquant (trouvé : ${found.join(", ")})`);
    }
    assert.equal(found.filter((k) => k === "telephone").length, 2);
    const s = exposureSummary(findPersonalData(t));
    assert.ok(s.high >= 5);
  });
  test("pas de fausse alerte : numéros qui ressemblent sans en être", () => {
    const t = `Facture n° 2026-10-48213
Numéro de télépaiement : 4111 1111 1111 1111
Référence : 1 85 05 75 123 456 74
IBAN FR76 3000 6000 0112 3456 7890 188
Total 1 234,56 € le 12/11/2026`;
    const found = kinds(t);
    assert.ok(!found.includes("carte_bancaire"), "un n° de télépaiement n'est pas une carte");
    assert.ok(!found.includes("iban"), "IBAN à clé fausse");
    assert.ok(!found.includes("securite_sociale"), "clé de sécu fausse");
  });
  test("bande MRZ = donnée sensible", () => {
    assert.ok(kinds("P<FRAEXEMPLE<<KARIM<<<<<<<<<<<<<<<<<<<<<<<<<<<\n19AB123453FRA8801304M2703155<<<<<<<<<<<<<<04").includes("bande_mrz"));
  });
  test("masquage avant partage : plus aucun numéro sensible en clair", () => {
    const t = "IBAN : FR76 3000 6000 0112 3456 7890 189\nN° de sécurité sociale : 1 85 05 75 123 456 73\nMail : a.b@free.fr";
    const items = findPersonalData(t);
    const out = redactText(t, items);
    assert.ok(!out.includes("0112 3456"));
    assert.ok(!out.includes("123 456 73"));
    assert.ok(!out.includes("a.b@free.fr"));
    assert.match(out, /\[IBAN \(compte bancaire\) masqué\]/);
    // Les valeurs masquées affichables ne contiennent jamais le numéro complet.
    for (const it of items) assert.ok(it.masked.replace(/\s/g, "").length < 14 || it.kind === "email", it.masked);
  });
  test("rien de cassé sur tout le corpus", () => {
    for (const p of TOUS) {
      const items = findPersonalData(p.texte);
      for (const it of items) assert.equal(p.texte.slice(it.index, it.index + it.length).length, it.length);
      redactText(p.texte, items);
    }
  });
});

describe("détecteur d'arnaques", () => {
  for (const m of ARNAQUES) {
    test(`attrapé : ${m.id}`, () => {
      const r = detectScam(m.texte);
      assert.equal(r.level, m.attendu, `${r.score} pts : ${r.reasons.join(" | ")}`);
      assert.ok(r.reasons.length > 0);
    });
  }
  for (const m of HONNETES) {
    test(`pas de fausse alerte : ${m.id}`, () => {
      const r = detectScam(m.texte);
      assert.equal(r.level, "aucun", `${r.score} pts : ${r.reasons.join(" | ")}`);
    });
  }
  test(`aucun des ${TOUS.length} vrais papiers du corpus n'est signalé`, () => {
    for (const p of TOUS) {
      const r = detectScam(p.texte);
      assert.equal(r.level, "aucun", `${p.id} : ${r.reasons.join(" | ")}`);
    }
  });
  test("un SMS court vers un faux site des impôts reste une arnaque, même s'il ressemble à une adresse mal lue", () => {
    assert.notEqual(detectScam("Impots : remboursement de 312 EUR en attente. Confirmez sur seruice-public.fr avant ce soir.").level, "aucun");
    assert.notEqual(detectScam("Ameli : votre carte vitale expire. Mettez a jour vos informations sur arneli.fr").level, "aucun");
  });
  test("SMS vers « impots.gouv.fi » : arnaque, même avec une extension rare", () => {
    assert.equal(detectScam("Impots : remboursement de 312 EUR en attente. Confirmez sur impots.gouv.fi avant ce soir.").level, "arnaque_probable");
  });
  test("long mail piégé vers « impots.gouv.fr.com » : pas pris pour une adresse officielle mal lue", () => {
    const lignes = [
      "Direction generale des finances publiques",
      "Objet : votre remboursement d'impot",
      "Madame, Monsieur,",
      "Apres les derniers calculs annuels de votre impot sur le revenu, nous avons determine que vous etes eligible a un remboursement de 412,50 euros.",
      "Pour recevoir ce remboursement, vous devez confirmer vos informations bancaires dans les meilleurs delais.",
      "Votre dossier sera cloture si vous ne repondez pas sous 48h, et le remboursement sera definitivement perdu.",
      "Rendez-vous sur impots.gouv.fr.com, rubrique remboursement, puis saisissez le numero de votre carte et le cryptogramme.",
      "Ce service est gratuit et securise. Il vous suffit de quelques minutes pour finaliser la demande.",
      "Si vous avez deja effectue cette demande, merci de ne pas tenir compte de ce message et de conserver votre numero de dossier.",
      "Pour toute question, notre equipe reste a votre disposition du lundi au vendredi, de neuf heures a dix-sept heures.",
      "Nous vous remercions de votre confiance et de votre comprehension.",
      "Veuillez agreer, Madame, Monsieur, l'expression de nos salutations distinguees.",
      "Le service des remboursements",
    ];
    assert.equal(detectScam(lignes.join("\n")).level, "arnaque_probable");
  });
  test("les adresses mail ne sont pas des liens", () => {
    assert.equal(detectScam("Écris-nous : contact@ameli-faux.com").links.length, 0);
  });
});

describe("protection : robustesse", () => {
  test("textes au hasard : jamais de plantage", () => {
    const rnd = hasard(4242);
    const pool = "abcdefghijklmnopqrstuvwxyz0123456789 .,:/@-+\n€éàFRIBAN<";
    for (let i = 0; i < 1500; i++) {
      let t = "";
      const n = entier(rnd, 0, 400);
      for (let j = 0; j < n; j++) t += pool[Math.floor(rnd() * pool.length)];
      findPersonalData(t);
      detectScam(t);
    }
  });
  const PIEGES: [string, string][] = [
    ["arobases", "a@".repeat(50_000)],
    ["points", "a.".repeat(80_000)],
    ["tirets de domaine", "a-".repeat(80_000) + ".com"],
    ["chiffres", "1 ".repeat(80_000)],
    ["faux IBAN", "FR76 ".repeat(30_000)],
    ["adresses", "12 rue ".repeat(20_000)],
    ["liens", "http://".repeat(20_000)],
  ];
  for (const [nom, t] of PIEGES) {
    test(`texte piège « ${nom} » : moins de 1,5 s`, () => {
      const start = performance.now();
      findPersonalData(t);
      detectScam(t);
      assert.ok(performance.now() - start < 1500, `${Math.round(performance.now() - start)} ms`);
    });
  }
});

describe("arnaque dans la fiche", () => {
  test("une arnaque n'est jamais « à payer », n'a pas de rappel, ne prête pas son nom à l'organisme imité", async () => {
    const { analyzeText } = await import("../src/engine/analyze.ts");
    const { verifierFiche, TODAY } = await import("./outils/fiche.ts");
    for (const m of ARNAQUES.filter((x) => x.attendu === "arnaque_probable")) {
      for (const language of ["fr", "en", "es", "ar"] as const) {
        const r = analyzeText(m.texte, { today: TODAY, language });
        assert.equal(r.a_traiter, false, m.id);
        assert.equal(r.date_limite, null, m.id);
        assert.equal(r.montant, null, m.id);
        assert.equal(r.organisme, null, m.id);
        assert.equal(r.arnaque?.level, "arnaque_probable", m.id);
        assert.ok(r.actions.length >= 3, m.id);
        assert.deepEqual(verifierFiche(r, m.texte), [], m.id);
      }
    }
  });
  test("un message suspect garde sa fiche mais reçoit un avertissement", async () => {
    const { analyzeText } = await import("../src/engine/analyze.ts");
    const r = analyzeText("Vous avez un colis en attente. Appelez le 08 99 12 34 56 pour fixer la livraison.", { today: "2026-11-09", language: "fr" });
    assert.equal(r.arnaque?.level, "suspect");
    assert.match(r.avertissement ?? "", /Prudence/);
  });
});
