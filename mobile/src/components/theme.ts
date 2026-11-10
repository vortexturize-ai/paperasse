export const colors = {
  bg: "#FFF8EC", // crème
  card: "#FFFFFF",
  ink: "#2B2440", // texte et contours
  muted: "#5E5775",
  line: "#D9D3EC",
  navy: "#1F3C88", // fond du logo et de l'écran de démarrage
  orange: "#FF8A1F",
  sun: "#FFD15C",
  green: "#4CC764",
  greenInk: "#10361A",
  red: "#D12A4A",
  sky: "#8FD3FF",
  lilac: "#C7BEFF",
  // compatibilité avec les anciens noms
  text: "#2B2440",
  primary: "#FF8A1F",
};

/** Couleurs pâles + texte foncé de la même teinte (contraste ≥ 4,5:1). */
export const tones = {
  red: { bg: "#FFD9DF", fg: "#A3122F" },
  orange: { bg: "#FFE3C7", fg: "#9A4A00" },
  yellow: { bg: "#FFF0B8", fg: "#7A5A00" },
  green: { bg: "#D8F5DC", fg: "#1F6B2E" },
  blue: { bg: "#D6EEFF", fg: "#0B5A8F" },
  purple: { bg: "#E7E2FF", fg: "#4B3BB5" },
  pink: { bg: "#FFE0EC", fg: "#A0174E" },
  neutral: { bg: "#EFEAE0", fg: "#4A4361" },
} as const;

export type Tone = keyof typeof tones;

/** Polices chargées dans src/app/_layout.tsx. Ne pas ajouter fontWeight avec elles. */
export const fonts = {
  title: "Fredoka_600SemiBold",
  titleBold: "Fredoka_700Bold",
  body: "Nunito_700Bold",
  bodyStrong: "Nunito_800ExtraBold",
  bodyLight: "Nunito_600SemiBold",
};

export const radius = 20;
export const gap = 12;
export const border = 3;

/** Ombre pleine décalée, effet autocollant. */
export function pop(offset = 4): { boxShadow: string } {
  return { boxShadow: `0px ${offset}px 0px ${colors.ink}` };
}
