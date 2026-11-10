import { test } from "node:test";
import assert from "node:assert/strict";
import { belongsTo, checkName, isRelation, ownerName, type Person } from "../src/engine/people.ts";

test("prénoms : propres, refusés s'ils sont vides, trop longs, bizarres ou déjà pris", () => {
  assert.deepEqual(checkName("  Léa  ", []), { name: "Léa" });
  assert.deepEqual(checkName("Jean-Pierre  d’Arc", []), { name: "Jean-Pierre d’Arc" });
  assert.deepEqual(checkName("Fatoumata", ["Léa"]), { name: "Fatoumata" });
  assert.deepEqual(checkName("محمد", []), { name: "محمد" });
  for (const bad of ["", "   ", "x".repeat(41), "123", "<script>", "Léa;DROP", "moi", "MOI"]) assert.ok("problem" in checkName(bad, []), bad);
  assert.ok("problem" in checkName("lea", ["Léa"]), "même prénom sans accent");
});

test("filtre par personne : tout le monde, moi, ou un proche", () => {
  assert.equal(belongsTo(null, "tous"), true);
  assert.equal(belongsTo("p1", "tous"), true);
  assert.equal(belongsTo(null, "moi"), true);
  assert.equal(belongsTo("p1", "moi"), false);
  assert.equal(belongsTo("p1", "p1"), true);
  assert.equal(belongsTo("p2", "p1"), false);
  assert.equal(belongsTo(null, "p1"), false);
});

test("nom affiché, relations connues", () => {
  const people: Person[] = [{ id: "p1", name: "Maman", relation: "parent" }];
  assert.equal(ownerName("p1", people), "Maman");
  assert.equal(ownerName(null, people), "Moi");
  assert.equal(ownerName("supprimé", people), "Moi");
  assert.equal(isRelation("enfant"), true);
  assert.equal(isRelation("patron"), false);
});
