/** Au-delà, le texte est coupé : une page lue fait quelques milliers de caractères, 20 pages ~100 000. */
export const MAX_TEXT_LENGTH = 200_000;

/** Minuscules, sans accents, apostrophes droites. Même longueur que l'entrée. */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    let c = ch.toLowerCase();
    if (c === "’" || c === "‘" || c === "`" || c === "´") c = "'";
    else if (c === " " || c === " " || c === "\t") c = " ";
    else {
      const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (base.length === 1) c = base;
    }
    // Un caractère hors plan de base (émoji) compte pour 2 unités : on garde sa longueur.
    out += c.length === ch.length ? c : ch;
  }
  return out;
}

/** Texte replié sur une seule ligne (retours à la ligne → espaces), même longueur.
 *  Une photo coupe les phrases n'importe où : « au plus tard\nle 20/11 » doit se lire « au plus tard le 20/11 ». */
export function flat(folded: string): string {
  return folded.replace(/\n/g, " ");
}

/** Confusions de la caméra dans les nombres : « 2O26 » → « 2026 », « 1l/11 » → « 11/11 ».
 *  On ne touche qu'aux suites de chiffres et séparateurs qui contiennent au moins 2 vrais chiffres. */
function fixDigits(text: string): string {
  return text.replace(/(?<![A-Za-zÀ-ÿ])[0-9OolI|][0-9OolI|,./:\-]*[0-9OolI|](?![A-Za-zÀ-ÿ])/g, (run) => {
    const real = run.replace(/\D/g, "").length;
    if (real < 2 || !/[OolI|]/.test(run)) return run;
    return run.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1");
  });
}

/** Nettoie un texte lu par la caméra : retours de ligne unifiés, espaces en trop, césures, chiffres mal lus. */
export function cleanText(raw: string): string {
  const text = raw.length > MAX_TEXT_LENGTH ? raw.slice(0, MAX_TEXT_LENGTH) : raw;
  return fixDigits(
    text
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[  \t]/g, " ")
      .replace(/[’‘]/g, "'")
      .replace(/-\n(?=[a-zà-ÿ])/g, "") // mot coupé en fin de ligne
      .replace(/[ ]{2,}/g, " ")
      .replace(/ *\n */g, "\n")
      // Ligne sans un seul mot ni chiffre (trait, puce, tampon, bout de logo) : retirée, elle couperait une phrase.
      .replace(/^(?=.)(?![^\n]*(?:[A-Za-zÀ-ÿ]{2}|\d))[^\n]*\n?/gm, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

export function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const STOP = /[.!?\n]/;

/** La phrase qui contient la position `index` (pour montrer d'où vient une info).
 *  Une phrase coupée par un retour à la ligne est recollée quand la ligne suivante continue en minuscule. */
export function sentenceAt(text: string, index: number, maxLength = 240): string {
  const continues = (nl: number) => {
    // Le retour à la ligne en `nl` coupe-t-il une phrase ? Oui si la ligne d'avant ne finit pas
    // par une ponctuation ou « : », et que la suivante commence en minuscule.
    const prev = text[nl - 1] ?? "";
    const next = text[nl + 1] ?? "";
    if (/[.!?:;]/.test(prev)) return false;
    const nextLine = text.slice(nl + 1, nl + 40);
    if (/[a-zà-ÿ0-9]/.test(next)) return !/^[a-zà-ÿ]+\s*:/.test(nextLine);
    // Suite en majuscule (« rubrique\nMon Compte. ») : seulement au milieu d'un long paragraphe,
    // jamais devant une ligne « Libellé : valeur ».
    const prevLen = nl - (text.lastIndexOf("\n", nl - 1) + 1);
    return /[A-ZÀ-Ý]/.test(next) && /[a-zà-ÿ,]/.test(prev) && prevLen >= 35 && !/^[^\n:]{0,30}:/.test(nextLine);
  };
  // Un point collé à la suite (« caf.fr », « 12.500 ») n'est pas une fin de phrase.
  const ends = (i: number) => STOP.test(text[i]) && !(text[i] === "." && /[A-Za-zÀ-ÿ0-9]/.test(text[i + 1] ?? ""));
  let start = index;
  while (start > 0) {
    const c = text[start - 1];
    if (c === "\n" ? !continues(start - 1) : ends(start - 1)) break;
    start--;
  }
  let end = index;
  while (end < text.length) {
    const c = text[end];
    if (c === "\n" ? !continues(end) : ends(end)) break;
    end++;
  }
  if (end < text.length && text[end] !== "\n") end++;
  let s = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (s.length > maxLength) {
    const rel = Math.max(0, index - start - Math.floor(maxLength / 2));
    s = `${rel > 0 ? "…" : ""}${s.slice(rel, rel + maxLength).trim()}…`;
  }
  return s;
}

/** Le texte juste avant une position (repliée), pour chercher un indice (« avant le », « né le »…). */
export function before(folded: string, index: number, width = 60): string {
  return folded.slice(Math.max(0, index - width), index);
}

export function after(folded: string, index: number, width = 60): string {
  return folded.slice(index, index + width);
}

// « indu » ne doit pas se lire dans « industrielle », ni « crous » dans « croustillant ».
// Un indice accepte un pluriel (« justificatifs »), et un féminin s'il est assez long (« convoquée »).

const isWordChar = (c: string | undefined) => c !== undefined && /[a-z0-9]/.test(c);

function endsOk(hay: string, end: number, needle: string, inflect = true): boolean {
  if (!isWordChar(needle[needle.length - 1])) return true;
  if (!isWordChar(hay[end])) return true;
  if (!inflect) return false;
  const rest = hay.slice(end, end + 4);
  if (/^[sx](?![a-z0-9])/.test(rest)) return true;
  if (needle.length >= 6 && /^(?:e|es|ee|ees)(?![a-z0-9])/.test(rest)) return true;
  return false;
}

function startsOk(hay: string, start: number, needle: string): boolean {
  return !isWordChar(needle[0]) || !isWordChar(hay[start - 1]);
}

/** Position de l'indice en mot entier à partir de `from`, ou -1.
 *  `inflect` : accepte pluriel et féminin (non pour un nom propre : « gmf » ne se lit pas dans « gmfx »). */
export function indexOfWord(hay: string, needle: string, from = 0, inflect = true): number {
  if (!needle) return -1;
  let i = hay.indexOf(needle, from);
  while (i !== -1) {
    if (startsOk(hay, i, needle) && endsOk(hay, i + needle.length, needle, inflect)) return i;
    i = hay.indexOf(needle, i + 1);
  }
  return -1;
}

/** Dernière position de l'indice en mot entier, ou -1. */
export function lastIndexOfWord(hay: string, needle: string): number {
  if (!needle) return -1;
  let i = hay.lastIndexOf(needle);
  while (i !== -1) {
    if (startsOk(hay, i, needle) && endsOk(hay, i + needle.length, needle)) return i;
    if (i === 0) break;
    i = hay.lastIndexOf(needle, i - 1);
  }
  return -1;
}

/** Vrai si un des indices apparaît (en mot entier) dans le texte replié. */
export function hasAny(folded: string, cues: readonly string[]): boolean {
  return cues.some((c) => indexOfWord(folded, c) !== -1);
}

export function countMatches(folded: string, needle: string): number {
  let n = 0;
  let i = indexOfWord(folded, needle);
  while (i !== -1) {
    n++;
    i = indexOfWord(folded, needle, i + needle.length);
  }
  return n;
}
