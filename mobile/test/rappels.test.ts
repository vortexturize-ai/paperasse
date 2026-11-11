import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderPlans } from "../src/lib/reminders.ts";

const now = new Date(2026, 10, 9, 12, 0, 0);
const caf = { title: "2026-11 Courrier – CAF", deadline: "2026-11-20", deadlineLabel: "Envoyer le document", isDone: false, expiryDate: null };

test("rappels détaillés : la date et le nom du papier", () => {
  const plans = reminderPlans(caf, false, now);
  assert.equal(plans.length, 3);
  assert.match(plans[0].title, /À faire dans 7 jours \(20 nov/);
  assert.match(plans[0].body, /Courrier – CAF/);
});

test("code secret en place : rien sur l'écran verrouillé ne dit de quel papier il s'agit", () => {
  const passeport = { title: "Passeport – Camille EXEMPLE", deadline: null, deadlineLabel: null, isDone: false, expiryDate: "2027-01-10" };
  for (const doc of [caf, passeport]) {
    const plans = reminderPlans(doc, true, now);
    assert.ok(plans.length > 0);
    for (const p of plans) {
      const shown = `${p.title} ${p.body}`;
      assert.doesNotMatch(shown, /CAF|Passeport|EXEMPLE|Envoyer|nov|janv/, shown);
      assert.match(p.title, /Paperasse/);
    }
  }
});

test("papier traité : plus de rappel d'échéance", () => {
  assert.equal(reminderPlans({ ...caf, isDone: true }, false, now).length, 0);
});

test("plafond du coffre : les rappels les plus proches de tous les papiers, pas plus de 60", async () => {
  const { MAX_SCHEDULED, selectReminders } = await import("../src/lib/reminders.ts");
  assert.equal(MAX_SCHEDULED, 60);
  const day = (n: number) => new Date(2026, 10, 9 + n, 9, 0, 0);
  const perDoc = [
    { id: "a", plans: [{ date: day(10) }, { date: day(20) }] },
    { id: "b", plans: [{ date: day(1) }, { date: day(30) }] },
    { id: "c", plans: [{ date: day(10) }] },
    { id: "d", plans: [] },
  ];
  const kept = selectReminders(perDoc, 3);
  assert.deepEqual([...kept.keys()], ["a", "b", "c", "d"]);
  assert.deepEqual(kept.get("b")!.map((p) => p.date.getDate()), [10]);
  assert.deepEqual(kept.get("a")!.map((p) => p.date.getDate()), [19]);
  assert.deepEqual(kept.get("c")!.map((p) => p.date.getDate()), [19]);
  assert.deepEqual(kept.get("d"), []);
  // Sans plafond atteint : tout le monde garde tout, dans l'ordre.
  const all = selectReminders(perDoc);
  assert.deepEqual(all.get("a")!.map((p) => p.date.getDate()), [19, 29]);
  assert.equal(selectReminders(perDoc, 0).get("b")!.length, 0);
  // 30 papiers × 6 rappels = 180 : seuls les 60 plus proches restent, jamais un papier loin devant un proche.
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, plans: Array.from({ length: 6 }, (_, j) => ({ date: day(i * 6 + j) })) }));
  const capped = selectReminders(many);
  const total = [...capped.values()].reduce((n, v) => n + v.length, 0);
  assert.equal(total, 60);
  assert.equal(capped.get("p9")!.length, 6);
  assert.equal(capped.get("p10")!.length, 0);
});
