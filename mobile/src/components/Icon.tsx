import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "./theme";

// Icônes à traits épais (grille 24 × 24), dessinées pour l'app. Pas d'émojis : leur rendu change d'un téléphone à l'autre.
const ICONS = {
  home: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  search: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-4-4",
  sliders:
    "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 5l-7 7 7 7",
  erase: "M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9l6 6M18 9l-6 6",
  fingerprint:
    "M6.5 7.5A7 7 0 0 1 19 12v1M5 11a7 7 0 0 0 0 3M9 19.5c-1-2-1.5-4-1.5-7a4.5 4.5 0 0 1 9 0c0 1.5 0 3-.5 4.5M12 12.5c0 3 .5 5.5 2 8M16 19.5c.5-1 .8-2 1-3",
  chevron: "M9 5l7 7-7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  camera:
    "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM8.5 13.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
  image: "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM7 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0M21 17l-5-5-8 8",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4",
  pencil: "M4 20l4-1 11-11-3-3L5 16z",
  share: "M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  lock: "M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3",
  clock: "M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 9v4l2.5 2.5",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  euro: "M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9",
  warning: "M12 3l10 18H2zM12 10v4M12 17.5v.5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  text: "M5 6h14M5 10h14M5 14h10M5 18h7",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  signpost: "M12 3v18M5 5h11l3 3-3 3H5zM19 13H8l-3 3 3 3h11z",
  folderCheck: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 13l2 2 4-4",
  book: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12",
  message: "M4 5h16v11H9l-5 4z",
  hourglass: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9",
  briefcase: "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 7V5h6v2M3 13h18",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  idcard:
    "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 11a2 2 0 1 0 4 0a2 2 0 1 0-4 0M6 16c.8-1.5 5.2-1.5 6 0M14 10h4M14 14h3",
  bank: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  car: "M5 15l1.5-4.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 15M4.5 14h15a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-2A1.5 1.5 0 0 1 4.5 14z",
  cap: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5",
  family:
    "M6 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M3 20c0-3.5 3-5.5 6-5.5s6 2 6 5.5M14.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M15 14.5c3 0 6 1.5 6 4.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z",
  mail: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 2.3,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  // Décoratives : le libellé est porté par le bouton ou le texte voisin.
  return (
    <View aria-hidden pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={ICONS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
