// Norme OACI 9303.
export type MrzKind = "passeport" | "carte_identite" | "titre_sejour" | "autre";

export interface MrzResult {
  kind: MrzKind;
  documentNumber: string;
  issuer: string; // pays émetteur (FRA…)
  birthDate: string | null;
  expiryDate: string | null;
  surname: string;
  givenNames: string;
  checksOk: boolean;
}

const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // « < »
}

export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += charValue(field[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

function checks(field: string, digit: string): boolean {
  return /^\d$/.test(digit) && checkDigit(field) === Number(digit);
}

/** Corrige les confusions courantes de la caméra dans une zone de chiffres. */
function digits(s: string): string {
  return s.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

function mrzDate(yymmdd: string, kind: "birth" | "expiry", todayYear: number): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  const century = kind === "expiry" ? 2000 : yy + 2000 > todayYear ? 1900 : 2000;
  const y = century + yy;
  const date = new Date(Date.UTC(y, mm - 1, dd));
  if (date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null;
  return date.toISOString().slice(0, 10);
}

function names(field: string): { surname: string; givenNames: string } {
  const [surname = "", given = ""] = field.split("<<");
  const clean = (s: string) => s.replace(/<+/g, " ").trim();
  return { surname: clean(surname), givenNames: clean(given) };
}

function kindOf(code: string): MrzKind {
  if (code.startsWith("P")) return "passeport";
  if (code === "IR" || code.startsWith("A") || code.startsWith("C") || code === "RP") return "titre_sejour";
  if (code.startsWith("I")) return "carte_identite";
  return "autre";
}

/** Cherche une bande MRZ dans les lignes lues. Renvoie null si aucune. */
// Une photo lit souvent un caractère de trop ou de moins dans la bande : on tolère 2 d'écart et on recale.
const near = (l: string, n: number) => Math.abs(l.length - n) <= 2;
const fit = (l: string, n: number) => (l.length >= n ? l.slice(0, n) : l + "<".repeat(n - l.length));

export function parseMrz(rawLines: string[], todayYear = new Date().getFullYear()): MrzResult | null {
  const candidates = rawLines
    .map((l) => l.toUpperCase().replace(/\s+/g, "").replace(/«/g, "<<").replace(/‹/g, "<"))
    .filter((l) => /^[A-Z0-9<]{26,48}$/.test(l) && l.includes("<"));

  // Passeport (TD3) : 2 lignes de 44.
  for (let i = 0; i + 1 < candidates.length; i++) {
    if (!(near(candidates[i], 44) && near(candidates[i + 1], 44) && candidates[i].startsWith("P"))) continue;
    const [l1, l2] = [fit(candidates[i], 44), fit(candidates[i + 1], 44)];
    {
      const num = l2.slice(0, 9);
      const birth = digits(l2.slice(13, 19));
      const expiry = digits(l2.slice(21, 27));
      const ok = checks(num, l2[9]) && checks(birth, digits(l2[19])) && checks(expiry, digits(l2[27]));
      return {
        kind: "passeport",
        documentNumber: num.replace(/</g, ""),
        issuer: l1.slice(2, 5).replace(/</g, ""),
        birthDate: mrzDate(birth, "birth", todayYear),
        expiryDate: ok ? mrzDate(expiry, "expiry", todayYear) : null,
        ...names(l1.slice(5)),
        checksOk: ok,
      };
    }
  }

  // Carte d'identité ou titre de séjour (TD1) : 3 lignes de 30.
  for (let i = 0; i + 2 < candidates.length; i++) {
    if (!(near(candidates[i], 30) && near(candidates[i + 1], 30) && near(candidates[i + 2], 30) && /^[ACI]/.test(candidates[i]))) continue;
    const [l1, l2, l3] = [fit(candidates[i], 30), fit(candidates[i + 1], 30), fit(candidates[i + 2], 30)];
    {
      const num = l1.slice(5, 14);
      const birth = digits(l2.slice(0, 6));
      const expiry = digits(l2.slice(8, 14));
      const ok = checks(num, l1[14]) && checks(birth, digits(l2[6])) && checks(expiry, digits(l2[14]));
      return {
        kind: kindOf(l1.slice(0, 2).replace(/</g, "")),
        documentNumber: num.replace(/</g, ""),
        issuer: l1.slice(2, 5).replace(/</g, ""),
        birthDate: mrzDate(birth, "birth", todayYear),
        expiryDate: ok ? mrzDate(expiry, "expiry", todayYear) : null,
        ...names(l3),
        checksOk: ok,
      };
    }
  }

  // Ancienne carte d'identité française : 2 lignes de 36 (pas de date d'expiration dans la bande).
  for (let i = 0; i + 1 < candidates.length; i++) {
    if (!(near(candidates[i], 36) && near(candidates[i + 1], 36) && /^[I1]DFRA/.test(candidates[i]))) continue;
    const [l1, l2] = [fit(candidates[i], 36), fit(candidates[i + 1], 36)];
    {
      const birth = digits(l2.slice(27, 33));
      return {
        kind: "carte_identite",
        documentNumber: l2.slice(0, 12).replace(/</g, ""),
        issuer: "FRA",
        birthDate: checks(birth, digits(l2[33])) ? mrzDate(birth, "birth", todayYear) : null,
        expiryDate: null,
        surname: l1.slice(5, 30).replace(/<+/g, " ").trim(),
        givenNames: l2.slice(13, 27).replace(/<+/g, " ").trim(),
        checksOk: checks(l2.slice(0, 12), l2[12]),
      };
    }
  }
  return null;
}
