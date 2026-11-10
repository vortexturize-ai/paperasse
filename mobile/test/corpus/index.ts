import type { Papier } from "../outils/fiche.ts";
import { ADMINISTRATIF } from "./administratif.ts";
import { CONTROLE } from "./controle.ts";
import { FACTURES } from "./factures.ts";
import { IDENTITE_ETUDES_SANTE } from "./identite-etudes-sante.ts";
import { IMPOTS_AMENDES } from "./impots-amendes.ts";
import { LOGEMENT_BANQUE } from "./logement-banque.ts";
import { PIEGES } from "./pieges.ts";
import { TRAVAIL } from "./travail.ts";

export const CORPUS: Record<string, Papier[]> = {
  "Courriers d'organismes": ADMINISTRATIF,
  "Impôts et amendes": IMPOTS_AMENDES,
  Travail: TRAVAIL,
  "Logement, assurance, banque": LOGEMENT_BANQUE,
  Factures: FACTURES,
  "Identité, études, santé": IDENTITE_ETUDES_SANTE,
  "Lot de contrôle (écrit à l'aveugle)": CONTROLE,
  "Pièges de vrais papiers (textes inventés)": PIEGES,
};

export const TOUS: Papier[] = Object.values(CORPUS).flat();

const ids = new Set<string>();
for (const p of TOUS) {
  if (ids.has(p.id)) throw new Error(`Identifiant de papier en double : ${p.id}`);
  ids.add(p.id);
}
