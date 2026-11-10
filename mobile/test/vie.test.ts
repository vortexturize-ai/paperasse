import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import { adminCalendar, nextTechnicalInspection } from "../src/engine/calendar.ts";
import { DOSSIERS, prepareDossier } from "../src/engine/dossiers.ts";
import { findTerms, GLOSSARY } from "../src/engine/glossary.ts";
import { LIFE_EVENTS, planLifeEvent } from "../src/engine/lifeEvents.ts";
import { depositClaim, findMoney } from "../src/engine/money.ts";
import { checkPayslip, smicAt } from "../src/engine/payslip.ts";
import { REPLY_GOALS, writeReply } from "../src/engine/reply.ts";
import { keepAdvice } from "../src/engine/retention.ts";
import type { Paper } from "../src/engine/vault.ts";
import type { DocType } from "../src/lib/categories.ts";
import { TOUS } from "./corpus/index.ts";
import { TODAY } from "./outils/fiche.ts";

/** Le coffre du test : chaque papier du corpus analysé par le moteur, comme dans l'app. */
function toPaper(id: string, texte: string, added = TODAY): Paper {
  const r = analyzeText(texte, { today: TODAY, language: "fr" });
  return {
    id, title: r.titre, type: r.type_document as DocType, category: r.categorie, issuer: r.emetteur, organisme: r.organisme,
    docDate: r.date_document, deadline: r.date_limite, expiry: r.date_expiration, amount: r.montant, amountDirection: r.montant_sens,
    text: r.texte, done: false, added,
  };
}
const COFFRE: Paper[] = TOUS.map((p) => toPaper(p.id, p.texte));
const byId = (id: string) => COFFRE.find((p) => p.id === id)!;

describe("tu peux jeter ?", () => {
  test("fiche de paie : à vie ; facture télécom : 1 an ; énergie : 5 ans ; avis d'impôt : fin de la 3e année", () => {
    assert.equal(keepAdvice({ type: "fiche_de_paie", organisme: null, docDate: "2010-01-31", expiry: null }, TODAY).forever, true);
    assert.equal(keepAdvice({ type: "fiche_de_paie", organisme: null, docDate: "2010-01-31", expiry: null }, TODAY).canDiscard, false);
    const tel = keepAdvice({ type: "facture", organisme: "orange", docDate: "2025-03-05", expiry: null }, TODAY);
    assert.equal(tel.until, "2026-03-05");
    assert.equal(tel.canDiscard, true);
    assert.equal(keepAdvice({ type: "facture", organisme: "edf", docDate: "2025-03-05", expiry: null }, TODAY).until, "2030-03-05");
    assert.equal(keepAdvice({ type: "avis_imposition", organisme: "dgfip", docDate: "2026-07-31", expiry: null }, TODAY).until, "2028-12-31");
  });
  test("jamais « tu peux jeter » sur un papier qui sert pour la retraite ou la justice", () => {
    for (const p of COFFRE) {
      const k = keepAdvice({ type: p.type, organisme: p.organisme, docDate: p.docDate, expiry: p.expiry, text: p.text }, "2099-01-01");
      if (["fiche_de_paie", "contrat_de_travail", "attestation_employeur", "diplome"].includes(p.type)) assert.equal(k.canDiscard, false, p.id);
      if (p.organisme === "justice" || p.organisme === "tribunal" || p.organisme === "francetravail") assert.equal(k.canDiscard, false, p.id);
      assert.ok(k.rule.length > 10, p.id);
    }
  });
});

describe("glossaire", () => {
  test("chaque mot a ses 4 langues", () => {
    for (const t of GLOSSARY) for (const l of ["fr", "en", "es", "ar"] as const) assert.ok(t.def[l].length > 20, `${t.id} ${l}`);
    assert.equal(new Set(GLOSSARY.map((t) => t.id)).size, GLOSSARY.length);
  });
  test("les mots difficiles d'un papier sont trouvés, pas les faux amis", () => {
    const ids = (id: string) => findTerms(byId(id).text).map((t) => t.id);
    assert.ok(ids("caf-indu").includes("indu"));
    assert.ok(ids("urssaf-mise-en-demeure").includes("mise_en_demeure"));
    assert.ok(ids("commissaire-justice-commandement").includes("commandement"));
    assert.ok(!ids("employeur-convocation-entretien-prealable").includes("indu"), "zone industrielle");
    assert.ok(!ids("bail-habitation").includes("designation"), "« Désignation : appartement »");
  });
});

describe("dossiers prêts à envoyer", () => {
  test("location : ce que le coffre contient, ce qui manque, ce qui est interdit", () => {
    const r = prepareDossier("location", COFFRE, TODAY);
    const item = (id: string) => r.items.find((i) => i.requirement.id === id)!;
    assert.equal(item("identite").status, "ok"); // passeport ou CNI valides dans le corpus
    assert.ok(item("identite").papers.every((p) => !p.expiry || p.expiry >= TODAY), "jamais une pièce périmée");
    assert.ok(["ok", "incomplet"].includes(item("paie").status));
    assert.ok(r.template.forbidden && r.template.forbidden.some((f) => /relevé de compte/.test(f)));
    for (const i of r.items) assert.ok(i.papers.length <= i.requirement.count);
  });
  test("un papier n'est jamais utilisé deux fois dans le même dossier", () => {
    for (const d of DOSSIERS) {
      const r = prepareDossier(d.id, COFFRE, TODAY);
      const ids = r.items.flatMap((i) => i.papers.map((p) => p.id));
      assert.equal(new Set(ids).size, ids.length, d.id);
    }
  });
  test("coffre vide : tout manque, rien ne plante", () => {
    for (const d of DOSSIERS) {
      const r = prepareDossier(d.id, [], TODAY);
      assert.equal(r.ready, false);
      assert.ok(r.items.every((i) => i.status === "manquant"));
    }
  });
});

describe("moments de vie", () => {
  test("déménagement : préavis 3 mois avant, carte grise 1 mois après, dépôt de garantie", () => {
    const plan = planLifeEvent("demenagement", "2027-01-15", COFFRE, TODAY);
    const step = (id: string) => plan.steps.find((s) => s.step.id === id)!;
    assert.equal(step("preavis").due, "2026-10-15");
    assert.equal(step("preavis").overdue, true);
    assert.equal(step("carte_grise").due, "2027-02-15");
    assert.ok(step("carte_grise").papers.some((p) => p.type === "carte_grise"));
    for (let i = 1; i < plan.steps.length; i++) assert.ok((plan.steps[i - 1].due ?? "") <= (plan.steps[i].due ?? "9999"), "triées par date");
  });
  test("naissance : 5 jours pour la déclarer", () => {
    const plan = planLifeEvent("naissance", "2026-12-01", [], TODAY);
    assert.equal(plan.steps.find((s) => s.step.id === "declaration")?.due, "2026-12-06");
  });
  test("tous les moments de vie se calculent, avec et sans papiers", () => {
    for (const e of LIFE_EVENTS) {
      for (const coffre of [[], COFFRE]) {
        const plan = planLifeEvent(e.id, "2027-03-01", coffre, TODAY);
        assert.equal(plan.steps.length, e.steps.length);
        assert.ok(plan.steps.every((s) => s.step.title && s.step.detail));
      }
    }
  });
});

describe("calendrier administratif", () => {
  test("contrôle technique : avant 4 ans, puis tous les 2 ans", () => {
    assert.equal(nextTechnicalInspection("2019-03-12", "2026-11-09"), "2027-03-12");
    assert.equal(nextTechnicalInspection("2024-06-05", "2026-11-09"), "2028-06-05");
  });
  test("le coffre du corpus donne un calendrier trié, sans date absurde", () => {
    const cal = adminCalendar(COFFRE, TODAY);
    assert.ok(cal.length > 10);
    for (let i = 1; i < cal.length; i++) assert.ok(cal[i - 1].date <= cal[i].date);
    assert.ok(cal.some((e) => e.kind === "controle_technique"));
    assert.ok(cal.some((e) => e.kind === "assurance"));
    assert.ok(cal.some((e) => e.kind === "actualisation" && /-15$/.test(e.date)));
    assert.ok(cal.some((e) => e.kind === "impots"));
    assert.ok(cal.some((e) => e.kind === "essai"), "fin de période d'essai du CDI");
    for (const e of cal) assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
  });
  test("actualisation : la prochaine clôture est le 15", () => {
    const ft = byId("francetravail-convocation");
    assert.equal(adminCalendar([ft], "2026-11-20").find((e) => e.kind === "actualisation")?.date, "2026-12-15");
    assert.equal(adminCalendar([ft], "2026-11-09").find((e) => e.kind === "actualisation")?.date, "2026-11-15");
  });
});

describe("chasseur d'argent", () => {
  test("argent promis non reçu après 30 jours", () => {
    const leads = findMoney(COFFRE, "2026-12-20");
    assert.ok(leads.some((l) => l.kind === "remboursement_attendu" && l.paperIds.includes("totalenergies-regularisation-en-votre-faveur")));
    assert.ok(!leads.some((l) => l.paperIds.includes("paie-boulangerie") && l.kind === "remboursement_attendu"), "une fiche de paie n'est pas une promesse");
  });
  test("marqué « reçu » : la piste disparaît", () => {
    const coffre = COFFRE.map((p) => (p.id === "totalenergies-regularisation-en-votre-faveur" ? { ...p, done: true } : p));
    assert.ok(!findMoney(coffre, "2026-12-20").some((l) => l.paperIds.includes("totalenergies-regularisation-en-votre-faveur")));
  });
  test("assurance qui augmente de plus de 3 % en un an", () => {
    const a = toPaper("axa-2025", "AXA France\nAvis d'échéance\nDate : 01/11/2025\nMontant à payer : 450,00 €\nÀ régler avant le 01/01/2026.");
    const b = toPaper("axa-2026", "AXA France\nAvis d'échéance\nDate : 02/11/2026\nMontant à payer : 486,00 €\nÀ régler avant le 01/01/2027.");
    const lead = findMoney([a, b], TODAY).find((l) => l.kind === "hausse_assurance");
    assert.ok(lead);
    assert.equal(lead.amount, 36);
    assert.match(lead.title, /\+8 %/);
  });
  test("double facture, mais pas le même papier ajouté deux fois", () => {
    const a = toPaper("edf-1", "EDF\nFacture du 02/11/2026\nMontant à payer : 84,60 € avant le 20/11/2026");
    const b = toPaper("edf-2", "EDF\nFacture du 05/11/2026\nRéf. 2\nMontant à payer : 84,60 € avant le 23/11/2026");
    assert.ok(findMoney([a, b], TODAY).some((l) => l.kind === "double_facture"));
    assert.ok(!findMoney([a, { ...a, id: "edf-1-copie" }], TODAY).some((l) => l.kind === "double_facture"));
  });
  test("dépôt de garantie : délai d'un mois, +10 % du loyer par mois commencé", () => {
    const ok = depositClaim({ rent: 620, deposit: 620, keysReturned: "2026-10-01", damages: false, today: "2026-10-25" });
    assert.equal(ok.due, "2026-11-01");
    assert.equal(ok.late, false);
    const late = depositClaim({ rent: 620, deposit: 620, keysReturned: "2026-08-01", damages: false, today: "2026-11-09" });
    assert.equal(late.due, "2026-09-01");
    assert.equal(late.monthsLate, 3);
    assert.equal(late.penalty, 186);
    assert.equal(late.total, 806);
    assert.equal(depositClaim({ rent: 620, deposit: 620, keysReturned: "2026-08-01", damages: true, today: "2026-10-01" }).due, "2026-10-01");
  });
});

describe("vérificateur de fiche de paie", () => {
  test("SMIC selon la date", () => {
    assert.equal(smicAt("2025-06-15"), 11.88);
    assert.equal(smicAt("2026-03-01"), 12.02);
    assert.equal(smicAt("2026-10-31"), 12.31);
    assert.equal(smicAt("2020-01-01"), null);
  });
  test("fiche du corpus : taux sous le SMIC de juin 2026 repéré, heures sup bien majorées", () => {
    const f = checkPayslip(byId("paie-colonnes-sas").text, "2026-10-31");
    assert.ok(f.some((x) => x.level === "a_verifier" && /SMIC/.test(x.text)), JSON.stringify(f));
    assert.ok(f.some((x) => x.level === "ok" && /supplémentaires à 25 %/.test(x.text)));
  });
  test("calcul juste : brut − cotisations = net", () => {
    const f = checkPayslip("Salaire de base 151,67 h 12,50 1 895,88\nSalaire brut 1 895,88\nCotisations salariales 417,09\nNet à payer avant impôt sur le revenu 1 478,79", "2026-10-31");
    assert.deepEqual(f.filter((x) => x.level === "a_verifier"), []);
  });
  test("heures sup sous-payées et écart de calcul signalés", () => {
    const f = checkPayslip("Salaire de base 151,67 h 12,50 1 895,88\nHeures supplémentaires 25 % 10,00 h 12,50 125,00\nSalaire brut 2 020,88\nCotisations salariales 444,59\nNet à payer avant impôt sur le revenu 1 500,00", "2026-10-31");
    assert.ok(f.some((x) => /il faudrait au moins 15,63/.test(x.text)), JSON.stringify(f));
    assert.ok(f.some((x) => /Écart de 76,29/.test(x.text)), JSON.stringify(f));
  });
  test("aucune fiche du corpus ne fait planter le vérificateur", () => {
    for (const p of COFFRE.filter((x) => x.type === "fiche_de_paie")) checkPayslip(p.text, p.docDate);
  });
});

describe("courriers guidés", () => {
  test("chaque objectif donne une lettre complète, références reprises, inconnues entre crochets", () => {
    for (const g of REPLY_GOALS) {
      const letter = writeReply({ goal: g.id, sender: "", issuer: "Agence Exemple", docTitle: "Papier", docDate: "2026-11-02", amount: 620, references: [{ label: "N° de contrat", valeur: "0123456789" }], details: "", today: TODAY });
      assert.match(letter, /Madame, Monsieur,/);
      assert.match(letter, /N° de contrat : 0123456789/);
      assert.match(letter, /\[Prénom Nom\]/);
      assert.ok(!/undefined|NaN|null/.test(letter), g.id);
    }
  });
  test("dépôt de garantie : la loi et la majoration de 10 % sont citées, en recommandé", () => {
    const letter = writeReply({ goal: "depot_garantie", sender: "", issuer: null, docTitle: "Bail", docDate: null, amount: 620, references: [], details: "", today: TODAY });
    assert.match(letter, /article 22 de la loi du 6 juillet 1989/);
    assert.match(letter, /10 %/);
    assert.match(letter, /Lettre recommandée avec accusé de réception/);
    assert.match(letter, /620,00 €/);
  });
});
