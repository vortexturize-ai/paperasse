import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../src/engine/analyze.ts";
import { findTextDuplicate, type DuplicateInput } from "../src/engine/duplicates.ts";
import { TOUS } from "./corpus/index.ts";
import { FAMILLES } from "./corpus/familles.ts";
import { BRUITS_DURS, BRUITS_STRICTS, hasard, type Hasard } from "./outils/bruit.ts";
import { TODAY } from "./outils/fiche.ts";

/** Comme dans l'app : le texte et les champs lus par le moteur. */
function lu(id: string, texte: string, today = TODAY): DuplicateInput {
  const r = analyzeText(texte, { today, language: "fr" });
  return {
    id,
    fullText: texte,
    docDate: r.date_document,
    amount: r.montant,
    deadline: r.date_limite,
    expiryDate: r.date_expiration,
    issuer: r.emetteur,
    amountDirection: r.montant_sens,
  };
}

/** Texte seul, sans rien de lu (le pire cas : seuls les mots et les nombres départagent). */
function brut(id: string, texte: string): DuplicateInput {
  return { id, fullText: texte, docDate: null, amount: null, deadline: null, expiryDate: null, issuer: null, amountDirection: null };
}

const COFFRE = TOUS.map((p) => lu(p.id, p.texte, p.today));

function taux(bruit: (t: string, rnd: Hasard) => string): { ok: number; faux: string[] } {
  let ok = 0;
  const faux: string[] = [];
  for (const [i, p] of TOUS.entries()) {
    const hit = findTextDuplicate(lu("nouveau", bruit(p.texte, hasard(i * 31 + 1)), p.today), COFFRE);
    if (hit?.id === p.id) ok++;
    else if (hit) faux.push(`${p.id} → ${hit.id}`);
  }
  return { ok, faux };
}

test("doublons : le même texte recollé est « identique »", () => {
  const p = TOUS.find((x) => x.texte.length > 400)!;
  assert.deepEqual(findTextDuplicate(lu("nouveau", p.texte, p.today), COFFRE), { id: p.id, kind: "identique", score: 1 });
});

test("doublons : le même papier photographié à nouveau est retrouvé (et jamais un autre)", () => {
  const { espaces, chiffres_ocr, lignes_coupees, parasites, majuscules } = BRUITS_STRICTS;
  const melange = (t: string, rnd: Hasard) => parasites(lignes_coupees(chiffres_ocr(espaces(t, rnd), rnd), rnd), rnd);
  for (const [nom, bruit] of Object.entries({ majuscules, melange, lettres_ocr: BRUITS_DURS.lettres_ocr })) {
    const { ok, faux } = taux(bruit);
    assert.deepEqual(faux, [], `${nom} : mauvais papier proposé`);
    assert.ok(ok / TOUS.length >= 0.95, `${nom} : ${ok}/${TOUS.length} retrouvés`);
  }
});

test("doublons : deux papiers différents ne sont jamais pris l'un pour l'autre (corpus et modèles générés)", () => {
  // Les familles générées sont le piège : même modèle de lettre, seuls l'organisme, la date ou le montant changent.
  const papiers = [...TOUS, ...Object.values(FAMILLES).flatMap((g) => g())];
  const coffre = papiers.map((p) => lu(p.id, p.texte, p.today));
  const attendu = papiers.map((p) => JSON.stringify(p.attendu));
  const faux: string[] = [];
  for (const [i, doc] of coffre.entries()) {
    // Les variantes dont la fiche attendue est la même (date écrite « 15/12 » ou « 15.12 ») sont bien le même papier.
    const autres = coffre.filter((_, j) => j !== i && attendu[j] !== attendu[i]);
    const hit = findTextDuplicate(doc, autres);
    if (hit) faux.push(`${doc.id} ~ ${hit.id}`);
  }
  assert.deepEqual(faux.slice(0, 10), [], `${faux.length} faux doublons`);
});

const FACTURE = (mois: string, numero: string, montant: string, echeance: string) => `Énergie Exemple
Facture n° ${numero} du 05/${mois}/2026
Client n° 0012345678 - Contrat 4400123
Madame Exemple, 12 rue des Lilas, 75011 Paris
Période de consommation : du 01/${mois}/2026 au 30/${mois}/2026
Consommation électricité : ${montant} kWh relevés par votre compteur
Montant total à payer : ${montant},40 euros TTC
Ce montant sera prélevé le ${echeance}/2026 sur votre compte.
Pour toute question, contactez votre service client du lundi au vendredi.
Retrouvez votre espace client et vos factures en ligne.`;

test("doublons : deux factures du même fournisseur (mois différents) ne sont pas des doublons, même sans rien de lu", () => {
  const octobre = FACTURE("10", "2026100512", "84", "20/10");
  const novembre = FACTURE("11", "2026110587", "91", "20/11");
  assert.equal(findTextDuplicate(brut("nov", novembre), [brut("oct", octobre)]), null);
  assert.equal(findTextDuplicate(lu("nov", novembre), [lu("oct", octobre)]), null);
  // La même facture reprise en photo (texte un peu abîmé) : retrouvée, même sans rien de lu.
  const reprise = novembre.toUpperCase().replace(/\n/g, "\n ").replace("2026110587", "2O26110587");
  assert.equal(findTextDuplicate(brut("photo", reprise), [brut("oct", octobre), brut("nov", novembre)])?.id, "nov");
});

test("doublons : trop peu de texte pour juger, champs qui se contredisent", () => {
  assert.equal(findTextDuplicate(brut("a", "Merci, à demain"), [brut("b", "Merci, à demain")]), null);
  assert.equal(findTextDuplicate(brut("a", ""), [brut("b", "")]), null);
  const texte = FACTURE("11", "2026110587", "91", "20/11");
  // Même texte, mais l'utilisateur a corrigé le montant ou la date limite de l'un des deux : ce n'est plus le même papier.
  assert.equal(findTextDuplicate({ ...brut("a", texte), amount: 91.4 }, [{ ...brut("b", texte), amount: 19.4 }]), null);
  assert.equal(findTextDuplicate({ ...brut("a", texte), deadline: "2026-11-20" }, [{ ...brut("b", texte), deadline: "2026-12-20" }]), null);
  // Organisme écrit autrement (majuscules, accents) : pas une contradiction.
  assert.equal(findTextDuplicate({ ...brut("a", texte), issuer: "Énergie Exemple" }, [{ ...brut("b", texte), issuer: "ENERGIE EXEMPLE" }])?.kind, "identique");
});
