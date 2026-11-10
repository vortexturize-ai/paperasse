export type Relation = "enfant" | "conjoint" | "parent" | "proche";

export const RELATIONS: Record<Relation, string> = {
  enfant: "Enfant",
  conjoint: "Conjoint ou conjointe",
  parent: "Parent que j’aide",
  proche: "Autre proche",
};

export interface Person {
  id: string;
  name: string;
  relation: Relation;
}

export const MAX_PEOPLE = 12;

/** Prénom propre (1 à 40 caractères, lettres, espaces, tirets, apostrophes), ou la raison du refus. */
export function checkName(raw: string, taken: string[]): { name: string } | { problem: string } {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!name) return { problem: "Écris un prénom." };
  if (name.length > 40) return { problem: "40 caractères au plus." };
  if (!/^[\p{L}][\p{L}\p{M} '’.-]*$/u.test(name)) return { problem: "Seulement des lettres, des espaces et des tirets." };
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (fold(name) === "moi" || taken.some((t) => fold(t) === fold(name))) return { problem: "Ce prénom est déjà dans la liste." };
  return { name };
}

export function isRelation(v: string): v is Relation {
  return v in RELATIONS;
}

/** « tous », « moi », ou l'identifiant d'une personne. */
export type Who = "tous" | "moi" | string;

export function belongsTo(personId: string | null, who: Who): boolean {
  if (who === "tous") return true;
  if (who === "moi") return personId === null;
  return personId === who;
}

/** Libellé court pour un papier : « Moi » ou le prénom (personne supprimée entre-temps → « Moi »). */
export function ownerName(personId: string | null, people: Person[]): string {
  return (personId && people.find((p) => p.id === personId)?.name) || "Moi";
}
