export type Hasard = () => number;

/** mulberry32 : petit générateur rapide, reproductible. */
export function hasard(graine: number): Hasard {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function choisir<T>(rnd: Hasard, items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)];
}

export function entier(rnd: Hasard, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

const isMrz = (l: string) => /^[A-Z0-9<]{28,46}$/.test(l.replace(/\s/g, "")) && l.includes("<");

/** Toute la page en majuscules (titres, tampons, vieilles imprimantes). */
function majuscules(t: string): string {
  return t.toUpperCase();
}

/** Accents perdus par la lecture. */
function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Retours de ligne Windows, espaces doublés, tabulations, espaces insécables dans les nombres. */
function espaces(t: string, rnd: Hasard): string {
  return t
    .split("\n")
    .map((l) => {
      let s = l.replace(/ /g, () => (rnd() < 0.15 ? "  " : rnd() < 0.05 ? "\t" : " "));
      s = s.replace(/(\d) (\d{3})\b/g, (_, a: string, b: string) => `${a}${rnd() < 0.5 ? " " : " "}${b}`);
      return (rnd() < 0.3 ? "  " : "") + s + (rnd() < 0.3 ? " " : "");
    })
    .join(rnd() < 0.5 ? "\r\n" : "\n");
}

/** Confusions de la caméra dans les nombres : 0 lu O, 1 lu l. Une seule par nombre. */
function chiffresOcr(t: string, rnd: Hasard): string {
  return t
    .split("\n")
    .map((l) => (isMrz(l) ? l : l.replace(/\d{3,}/g, (run) => {
      if (rnd() > 0.5) return run;
      const i = run.search(/[01]/);
      if (i <= 0 || i === run.length - 1) return run; // garde au moins un vrai chiffre de chaque côté
      return run.slice(0, i) + (run[i] === "0" ? "O" : "l") + run.slice(i + 1);
    })))
    .join("\n");
}

/** Le texte d'un paragraphe revient à la ligne à une largeur au hasard, parfois avec une césure. */
function lignesCoupees(t: string, rnd: Hasard): string {
  const largeur = entier(rnd, 30, 48);
  const out: string[] = [];
  for (const line of t.split("\n")) {
    if (line.length <= 52 || isMrz(line)) {
      out.push(line);
      continue;
    }
    // On ne coupe jamais au milieu d'un nombre (« 1 234,56 ») ni entre un nombre et « € ».
    const words = line.split(/ (?!\d{3}\b|€)/);
    let cur = "";
    for (const w of words) {
      if (cur && (cur + " " + w).length > largeur) {
        if (w.length > 8 && /^[a-zà-ÿ]+$/.test(w) && rnd() < 0.3) {
          const cut = entier(rnd, 3, w.length - 4);
          out.push(`${cur} ${w.slice(0, cut)}-`);
          cur = w.slice(cut);
          continue;
        }
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
  }
  return out.join("\n");
}

const PARASITES = ["|", "@#%", "* * *", "—", "•", "_____", "▪▪▪", "l l l", ")", "° °", "~", "[ ]", "..."];
const NUMEROS_DE_PAGE = ["1/2", "- 1 -", "Page 1 sur 1"];

/** Logos, traits, tampons et puces lus comme des bouts de texte, n'importe où ; numéro de page en haut ou en bas. */
function parasites(t: string, rnd: Hasard): string {
  const lines = t.split("\n");
  const out: string[] = [];
  if (rnd() < 0.3) out.push(choisir(rnd, NUMEROS_DE_PAGE));
  for (let i = 0; i < lines.length; i++) {
    const inMrz = isMrz(lines[i]) && i > 0 && isMrz(lines[i - 1]);
    if (!inMrz && rnd() < 0.2) out.push(choisir(rnd, PARASITES));
    out.push(lines[i]);
  }
  if (rnd() < 0.5) out.push(choisir(rnd, [...PARASITES, ...NUMEROS_DE_PAGE]));
  return out.join("\n");
}

const PIEDS = [
  "Siège social : Exemple SA au capital de 1 000 000 € - RCS Paris 123 456 789",
  "Page 1/1",
  "www.exemple.fr - Tél. 01 23 45 67 89",
  "Service gratuit + prix appel",
  "Imprimé sur papier recyclé",
];

/** Le bas de page habituel : siège social, capital, numéro de page, téléphone. */
function piedDePage(t: string, rnd: Hasard): string {
  const n = entier(rnd, 1, 3);
  const pick = [...PIEDS].sort(() => rnd() - 0.5).slice(0, n);
  return `${t}\n${pick.join("\n")}`;
}

/** Lettres confondues (l/I, rn/m, é/e) : bruit plus dur, on mesure sans exiger 100 %. */
function lettresOcr(t: string, rnd: Hasard): string {
  return t
    .split("\n")
    .map((l) => (isMrz(l) ? l : l.replace(/[a-zéèêàù]/g, (c) => {
      const p = rnd();
      if (p < 0.02 && c === "l") return "I";
      if (p < 0.03 && "éèê".includes(c)) return "e";
      if (p < 0.004) return c.toUpperCase();
      return c;
    }).replace(/rn/g, (m) => (rnd() < 0.1 ? "m" : m))))
    .join("\n");
}

/** Un bloc de lignes remonte ou descend (colonnes lues dans le désordre). On mesure sans exiger 100 %. */
function blocsMelanges(t: string, rnd: Hasard): string {
  const lines = t.split("\n");
  if (lines.length < 6) return t;
  const size = entier(rnd, 1, 3);
  const from = entier(rnd, 2, lines.length - size);
  const block = lines.splice(from, size);
  const to = entier(rnd, 2, lines.length);
  lines.splice(to, 0, ...block);
  return lines.join("\n");
}

export type Bruit = (t: string, rnd: Hasard) => string;

/** Bruits qui ne doivent RIEN changer à la fiche (champs comparés en mode souple). */
export const BRUITS_STRICTS: Record<string, Bruit> = {
  majuscules,
  sans_accents: sansAccents,
  espaces,
  chiffres_ocr: chiffresOcr,
  lignes_coupees: lignesCoupees,
  parasites,
  pied_de_page: piedDePage,
  tout_ensemble: (t, rnd) => parasites(lignesCoupees(chiffresOcr(espaces(piedDePage(t, rnd), rnd), rnd), rnd), rnd),
};

/** Bruits durs : on mesure le taux de réussite, avec un seuil minimum. */
export const BRUITS_DURS: Record<string, Bruit> = {
  lettres_ocr: lettresOcr,
  blocs_melanges: blocsMelanges,
};
