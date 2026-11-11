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
