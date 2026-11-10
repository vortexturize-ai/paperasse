import { findPersonalData } from "./privacy.ts";

const SENSITIVE_CATEGORIES = new Set(["identite", "banque", "sante"]);
// Fiche de paie et attestation employeur portent le numéro de sécurité sociale et le salaire.
const SENSITIVE_TYPES = new Set(["piece_identite", "titre_de_sejour", "releve_bancaire", "rib", "carte_vitale", "passeport", "permis_de_conduire", "fiche_de_paie", "attestation_employeur"]);

export function isSensitivePaper(p: { category?: string | null; docType?: string | null; fullText?: string | null }): boolean {
  if (p.category && SENSITIVE_CATEGORIES.has(p.category)) return true;
  if (p.docType && SENSITIVE_TYPES.has(p.docType)) return true;
  const text = p.fullText ?? "";
  return text.length > 0 && findPersonalData(text.slice(0, 50_000)).some((i) => i.sensitivity === "haute");
}
