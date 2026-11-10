import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderDates } from "../src/lib/reminders.ts";
import { daysUntil, formatDate, normalize, relativeDays, todayIso } from "../src/lib/text.ts";

const now = new Date(2026, 10, 9, 14, 30); // 9 nov. 2026, 14 h 30

test("todayIso et daysUntil en heure locale", () => {
  assert.equal(todayIso(now), "2026-11-09");
  assert.equal(daysUntil("2026-11-09", now), 0);
  assert.equal(daysUntil("2026-11-10", now), 1);
  assert.equal(daysUntil("2026-11-01", now), -8);
  assert.equal(daysUntil("2027-01-01", now), 53);
});

test("relativeDays", () => {
  assert.equal(relativeDays("2026-11-09", now), "aujourd'hui");
  assert.equal(relativeDays("2026-11-10", now), "demain");
  assert.equal(relativeDays("2026-11-19", now), "dans 10 jours");
  assert.equal(relativeDays("2026-11-06", now), "dépassée depuis 3 jours");
});

test("formatDate en français", () => {
  assert.equal(formatDate("2026-02-01"), "1 févr. 2026");
  assert.equal(formatDate(null), "");
});

test("normalize retire accents et majuscules", () => {
  assert.equal(normalize("Fiche de PAIE – Été Société"), "fiche de paie – ete societe");
});

test("rappels de date limite : J-7, J-2, jour J à 9 h, seulement à venir", () => {
  const r = reminderDates("2026-11-20", [7, 2, 0], now);
  assert.deepEqual(
    r.map((x) => [x.daysBefore, x.date.getDate(), x.date.getHours()]),
    [
      [7, 13, 9],
      [2, 18, 9],
      [0, 20, 9],
    ],
  );
  // Date limite dans 3 jours : J-7 est passé.
  assert.deepEqual(
    reminderDates("2026-11-12", [7, 2, 0], now).map((x) => x.daysBefore),
    [2, 0],
  );
  // Aujourd'hui à 14 h 30 : le rappel de 9 h est passé.
  assert.equal(reminderDates("2026-11-09", [0], now).length, 0);
});

test("rappels d'expiration qui changent de mois et d'année", () => {
  const r = reminderDates("2027-01-15", [60, 30, 0], now);
  assert.deepEqual(
    r.map((x) => `${x.date.getFullYear()}-${x.date.getMonth() + 1}-${x.date.getDate()}`),
    ["2026-11-16", "2026-12-16", "2027-1-15"],
  );
});
