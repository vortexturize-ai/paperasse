import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SNAPSHOT, WIDGET_KEEP, parseSnapshot, shortTitle, widgetSnapshot, widgetView } from "../src/lib/widgetData.ts";

const now = new Date(2026, 10, 11, 18, 0, 0); // mercredi 11 novembre 2026
const docs = [
  { title: "2026-11 Courrier – CAF", deadline: "2026-11-14", isDone: false, expiryDate: null },
  { title: "Passeport – Camille EXEMPLE", deadline: null, isDone: false, expiryDate: "2026-12-20" },
  { title: "2026-10 Avis – Impôts", deadline: "2026-11-01", isDone: false, expiryDate: null }, // passé
  { title: "2026-11 Facture – EDF", deadline: "2026-11-12", isDone: true, expiryDate: null }, // traité
  { title: "2026-11 Relance – Free", deadline: "2026-11-18", isDone: false, expiryDate: null },
  { title: "Carte d'identité", deadline: null, isDone: false, expiryDate: "2028-03-01" },
];

test("widget : la plus proche échéance non traitée, avec le nom du papier sans date", () => {
  const snap = widgetSnapshot(docs, false, now);
  assert.deepEqual(
    snap.items.map((i) => [i.kind, i.date, i.title]),
    [
      ["deadline", "2026-11-14", "Courrier – CAF"],
      ["deadline", "2026-11-18", "Relance – Free"],
      ["expiry", "2026-12-20", "Passeport – Camille EXEMPLE"],
      ["expiry", "2028-03-01", "Carte d'identité"],
    ],
  );
  const v = widgetView(snap, now);
  assert.equal(v.label, "À faire");
  assert.equal(v.when, "Dans 3 jours");
  assert.equal(v.what, "Courrier – CAF");
  assert.equal(v.date, "sam. 14 nov.");
  assert.equal(v.more, "+ 1 autre bientôt");
  assert.equal(v.urgent, false);
});

test("widget avec code secret : aucun nom de papier, ni dans le fichier ni à l'écran", () => {
  const snap = widgetSnapshot(docs, true, now);
  const stored = JSON.stringify(snap);
  assert.doesNotMatch(stored, /CAF|Free|Passeport|EXEMPLE|identité|title/);
  const v = widgetView(snap, now);
  assert.equal(v.what, "Un papier t’attend");
  assert.equal(v.when, "Dans 3 jours");
  // Un fichier modifié à la main ne fait pas réapparaître de nom en mode discret.
  const forged = parseSnapshot(JSON.stringify({ v: 1, discreet: true, items: [{ kind: "deadline", date: "2026-11-14", title: "CAF" }] }));
  assert.equal(widgetView(forged, now).what, "Un papier t’attend");
});

test("widget : passe tout seul à l'échéance suivante, jours recalculés sans rouvrir l'app", () => {
  const snap = widgetSnapshot(docs, false, now);
  const later = new Date(2026, 10, 15, 8, 0, 0); // après la date CAF
  const v = widgetView(snap, later);
  assert.equal(v.what, "Relance – Free");
  assert.equal(v.when, "Dans 3 jours");
  assert.equal(widgetView(snap, new Date(2026, 10, 18, 7, 0, 0)).when, "Aujourd’hui");
  assert.equal(widgetView(snap, new Date(2026, 10, 17, 23, 0, 0)).when, "Demain");
  assert.equal(widgetView(snap, new Date(2026, 10, 17, 23, 0, 0)).urgent, true);
});

test("widget : expiration montrée seulement à 60 jours ou moins", () => {
  const snap = widgetSnapshot([docs[1]], false, now);
  const far = widgetView(snap, new Date(2026, 9, 1));
  assert.equal(far.empty, true); // 80 jours avant : pas encore
  const near = widgetView(snap, now);
  assert.equal(near.label, "Expire");
  assert.equal(near.when, "Dans 39 jours");
  assert.equal(near.what, "Passeport – Camille EXEMPLE");
  assert.equal(widgetView(widgetSnapshot([docs[1]], true, now), now).what, "Un papier à renouveler");
});

test("widget vide (coffre leurre, rien à faire, fichier abîmé)", () => {
  for (const snap of [EMPTY_SNAPSHOT, widgetSnapshot([], false, now), parseSnapshot("{abîmé"), parseSnapshot(null), parseSnapshot('{"v":2,"items":[]}')]) {
    const v = widgetView(snap, now);
    assert.equal(v.empty, true);
    assert.equal(v.when, "Rien à faire");
  }
});

test("widget : nombre d'échéances gardé borné, année affichée si elle change", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `Papier ${i}`, deadline: `2026-12-${String(i + 1).padStart(2, "0")}`, isDone: false, expiryDate: null }));
  assert.equal(widgetSnapshot(many, false, now).items.length, WIDGET_KEEP);
  const next = widgetView(widgetSnapshot([{ title: "Taxe", deadline: "2027-01-15", isDone: false, expiryDate: null }], false, now), now);
  assert.equal(next.date, "ven. 15 janv. 2027");
  assert.equal(shortTitle("2026-11-03 Courrier – CAF"), "Courrier – CAF");
  assert.equal(shortTitle("2026-11"), "2026-11");
});
