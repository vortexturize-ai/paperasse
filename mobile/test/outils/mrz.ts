function valeur(c: string): number {
  if (/\d/.test(c)) return Number(c);
  if (/[A-Z]/.test(c)) return c.charCodeAt(0) - 55;
  return 0;
}

export function cle(champ: string): string {
  const poids = [7, 3, 1];
  let s = 0;
  for (let i = 0; i < champ.length; i++) s += valeur(champ[i]) * poids[i % 3];
  return String(s % 10);
}

const fill = (s: string, n: number) => (s + "<".repeat(n)).slice(0, n);
const nom = (surname: string, given: string[], n: number) => fill(`${surname}<<${given.join("<")}`, n);
/** AAAA-MM-JJ → AAMMJJ */
const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);

export interface Identite {
  code: string; // "ID", "IR", "P<"…
  pays: string;
  numero: string;
  naissance: string; // AAAA-MM-JJ
  sexe: "M" | "F" | "<";
  expiration: string; // AAAA-MM-JJ
  nationalite: string;
  nom: string;
  prenoms: string[];
}

/** Carte au format TD1 (carte d'identité depuis 2021, titre de séjour) : 3 lignes de 30. */
export function td1(p: Identite): string[] {
  const num = fill(p.numero, 9);
  const l1 = fill(`${fill(p.code, 2)}${p.pays}${num}${cle(num)}`, 30);
  const b = yymmdd(p.naissance);
  const e = yymmdd(p.expiration);
  const l2body = `${b}${cle(b)}${p.sexe}${e}${cle(e)}${p.nationalite}`;
  const l2noCheck = fill(l2body, 29);
  const composite = l1.slice(5, 30) + l2noCheck.slice(0, 7) + l2noCheck.slice(8, 15) + l2noCheck.slice(18, 29);
  const l2 = l2noCheck + cle(composite);
  return [l1, l2, nom(p.nom, p.prenoms, 30)];
}

/** Passeport au format TD3 : 2 lignes de 44. */
export function td3(p: Identite): string[] {
  const l1 = fill(`P<${p.pays}${nom(p.nom, p.prenoms, 39)}`, 44);
  const num = fill(p.numero, 9);
  const b = yymmdd(p.naissance);
  const e = yymmdd(p.expiration);
  const perso = fill("", 14);
  const body = `${num}${cle(num)}${p.nationalite}${b}${cle(b)}${p.sexe}${e}${cle(e)}${perso}${cle(perso)}`;
  const composite = body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43);
  return [l1, body + cle(composite)];
}
