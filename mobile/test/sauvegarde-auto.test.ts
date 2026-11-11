import { test } from "node:test";
import assert from "node:assert/strict";
import { autoBackupDue, backupFileName, backupNudge, backupsToDelete } from "../src/engine/backupPlan.ts";

const base = { papers: 6, last: null, papersAtLast: null, autoFailed: false, snoozeUntil: null };

test("rappel : jamais sauvegardé, sauvegarde vieille, beaucoup de nouveaux papiers", () => {
  assert.deepEqual(backupNudge(base, "2026-11-11"), { kind: "jamais" });
  assert.deepEqual(backupNudge({ ...base, last: "2026-09-30T10:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), { kind: "vieille", days: 42 });
  assert.deepEqual(backupNudge({ ...base, papers: 12, last: "2026-11-05T10:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), { kind: "nouveaux", added: 6 });
  assert.equal(backupNudge({ ...base, last: "2026-11-05T10:00:00.000Z", papersAtLast: 5 }, "2026-11-11"), null);
});

test("rappel : rien sans papier, « plus tard » respecté, échec de la sauvegarde automatique toujours signalé", () => {
  assert.equal(backupNudge({ ...base, papers: 0 }, "2026-11-11"), null);
  assert.equal(backupNudge({ ...base, snoozeUntil: "2026-11-18" }, "2026-11-11"), null);
  assert.deepEqual(backupNudge({ ...base, snoozeUntil: "2026-11-18", autoFailed: true }, "2026-11-11"), { kind: "auto_echec" });
});

test("sauvegarde automatique : au plus une fois par jour, au moins une fois par semaine", () => {
  assert.equal(autoBackupDue({ papers: 6, last: null, papersAtLast: null }, "2026-11-11"), true);
  assert.equal(autoBackupDue({ papers: 7, last: "2026-11-11T08:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), false);
  assert.equal(autoBackupDue({ papers: 7, last: "2026-11-10T08:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), true);
  assert.equal(autoBackupDue({ papers: 6, last: "2026-11-08T08:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), false);
  assert.equal(autoBackupDue({ papers: 6, last: "2026-11-04T08:00:00.000Z", papersAtLast: 6 }, "2026-11-11"), true);
  assert.equal(autoBackupDue({ papers: 0, last: null, papersAtLast: null }, "2026-11-11"), false);
});

test("fichiers : un nom par jour, les 3 plus récents gardés", () => {
  assert.equal(backupFileName("2026-11-11"), "Paperasse-sauvegarde-2026-11-11.paperasse");
  assert.equal(backupFileName("2026-11-11", 2), "Paperasse-sauvegarde-2026-11-11-2.paperasse");
  assert.deepEqual(backupsToDelete(["a", "b", "c", "d", "e"]), ["a", "b"]);
  assert.deepEqual(backupsToDelete(["a", "b"]), []);
});

test("nom du dossier choisi : lisible quelle que soit l'adresse", async () => {
  const { folderLabelFromUri } = await import("../src/engine/backupPlan.ts");
  assert.equal(folderLabelFromUri("content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FPaperasse"), "Paperasse");
  assert.equal(folderLabelFromUri("content://com.android.externalstorage.documents/tree/1234-ABCD%3ASauvegardes"), "Sauvegardes");
  assert.equal(folderLabelFromUri("content://com.google.android.apps.docs.storage/tree/encoded%3DABCDEF0123456789abcdef"), "ton dossier");
  assert.equal(folderLabelFromUri("file:///storage/emulated/0/Download/"), "Download");
  assert.equal(folderLabelFromUri(""), "ton dossier");
  assert.equal(folderLabelFromUri("%E0%A4%A", "ailleurs"), "%E0%A4%A");
});
