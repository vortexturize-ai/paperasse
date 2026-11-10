import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { colors, fonts } from "./theme";

export type Mood = "happy" | "reading" | "sleepy" | "worried" | "party";

const MOOD_LABEL: Record<Mood, string> = {
  happy: "La mascotte Paperasse sourit",
  reading: "La mascotte Paperasse lit avec une loupe",
  sleepy: "La mascotte Paperasse dort",
  worried: "La mascotte Paperasse est inquiète",
  party: "La mascotte Paperasse fait la fête",
};

/** Yeux et bouche selon l'humeur (repère 200 × 220, comme assets/brand/mascot.svg). */
function Face({ mood, ink }: { mood: Mood; ink: string }) {
  const stroke = { stroke: ink, strokeWidth: 9, strokeLinecap: "round" as const, fill: "none" };
  switch (mood) {
    case "sleepy":
      return (
        <>
          <Path d="M66 120 Q78 130 90 120" {...stroke} />
          <Path d="M116 120 Q128 130 140 120" {...stroke} />
          <Ellipse cx={103} cy={158} rx={8} ry={6} fill={ink} />
          <Path d="M150 30 H168 L150 50 H168" stroke={ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
    case "worried":
      return (
        <>
          {/* Bout intérieur des sourcils relevé : inquiet (bout intérieur baissé = fâché). */}
          <Path d="M64 104 L90 94" {...stroke} strokeWidth={7} />
          <Path d="M142 104 L116 94" {...stroke} strokeWidth={7} />
          <Ellipse cx={78} cy={122} rx={10} ry={13} fill={ink} />
          <Ellipse cx={128} cy={122} rx={10} ry={13} fill={ink} />
          <Path d="M86 164 Q103 148 120 164" {...stroke} />
          <Path d="M160 80 Q152 96 160 102 Q168 96 160 80 Z" fill="#8FD3FF" stroke={ink} strokeWidth={4} />
        </>
      );
    case "party":
      return (
        <>
          <Path d="M66 124 Q78 108 90 124" {...stroke} />
          <Path d="M116 124 Q128 108 140 124" {...stroke} />
          <Path d="M80 144 Q103 186 126 144 Z" fill="#FF6F8F" stroke={ink} strokeWidth={8} strokeLinejoin="round" />
          <Path d="M8 70 l14 -8 M184 92 l10 8 M14 150 l12 4 M180 40 l8 -12" stroke="#FF8A1F" strokeWidth={8} strokeLinecap="round" />
          <Path d="M30 30 l6 12 M192 150 l-12 4" stroke="#38B6FF" strokeWidth={8} strokeLinecap="round" />
        </>
      );
    case "reading":
      return (
        <>
          <Ellipse cx={78} cy={124} rx={10} ry={11} fill={ink} />
          <Ellipse cx={128} cy={124} rx={10} ry={11} fill={ink} />
          <Path d="M90 156 Q103 164 116 156" {...stroke} />
          <Ellipse cx={150} cy={168} rx={24} ry={24} fill="#D6EEFF" stroke={ink} strokeWidth={8} />
          <Path d="M168 186 L190 208" stroke={ink} strokeWidth={10} strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <Ellipse cx={78} cy={118} rx={11} ry={15} fill={ink} />
          <Ellipse cx={128} cy={118} rx={11} ry={15} fill={ink} />
          <Ellipse cx={81} cy={112} rx={4} ry={4} fill="#FFFFFF" />
          <Ellipse cx={131} cy={112} rx={4} ry={4} fill="#FFFFFF" />
          <Path d="M84 150 Q103 172 122 150" {...stroke} />
        </>
      );
  }
}

/** La mascotte : une feuille de papier avec un trombone, en 5 humeurs. Même dessin que assets/brand/mascot.svg. */
export function Mascot({
  size = 64,
  tilt = 0,
  fold = "#E7E2FF",
  mood = "happy",
  label,
}: {
  size?: number;
  tilt?: number;
  fold?: string;
  mood?: Mood;
  label?: string;
}) {
  const ink = colors.ink;
  return (
    <View
      style={{ transform: [{ rotate: `${tilt}deg` }] }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? MOOD_LABEL[mood]}
    >
      <Svg width={size} height={size * 1.1} viewBox="0 0 200 220">
        <Path
          d="M38 14 H140 L182 56 V182 A16 16 0 0 1 166 198 H38 A16 16 0 0 1 22 182 V30 A16 16 0 0 1 38 14 Z"
          fill="#FFFDF7"
          stroke={ink}
          strokeWidth={9}
          strokeLinejoin="round"
        />
        <Path d="M140 14 V42 A14 14 0 0 0 154 56 H182" fill={fold} stroke={ink} strokeWidth={9} strokeLinejoin="round" />
        {mood !== "worried" ? (
          <>
            <Ellipse cx={58} cy={146} rx={11} ry={7} fill="#FF9EB5" />
            <Ellipse cx={148} cy={146} rx={11} ry={7} fill="#FF9EB5" />
          </>
        ) : null}
        <Face mood={mood} ink={ink} />
        <Path
          d="M60 4 V44 A11 11 0 0 1 38 44 V12 A7 7 0 0 1 52 12 V40"
          fill="none"
          stroke="#E8A400"
          strokeWidth={8}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// Une couleur par lettre, avec son relief plus foncé.
const LIGHT = [
  ["#E86F00", "#9C4A00"],
  ["#E0326A", "#96133F"],
  ["#1C9BE6", "#08629A"],
  ["#36B04F", "#1B7A30"],
  ["#F0A800", "#9E7300"],
  ["#7766F2", "#4634BD"],
];
const DARK = [
  ["#FF8A1F", "#B85700"],
  ["#F0457A", "#A8184A"],
  ["#38B6FF", "#0A73B3"],
  ["#4CC764", "#1F8A36"],
  ["#FFC21A", "#B98600"],
  ["#8C7BFF", "#5240D0"],
];

/** Le nom en lettres multicolores, en relief. `onDark` pour le fond bleu nuit. */
export function Wordmark({ size = 30, onDark = false, upper = false }: { size?: number; onDark?: boolean; upper?: boolean }) {
  const word = upper ? "PAPERASSE" : "Paperasse";
  const palette = onDark ? DARK : LIGHT;
  const depth = Math.max(2, Math.round(size / 15));
  return (
    <Text accessibilityRole="header" accessibilityLabel="Paperasse" style={[styles.word, { fontSize: size, lineHeight: size * 1.2 }]}>
      {word.split("").map((letter, i) => {
        const [color, shade] = palette[i % palette.length];
        return (
          <Text
            key={i}
            style={{
              color,
              textShadowColor: shade,
              textShadowOffset: { width: 0, height: depth },
              textShadowRadius: 1,
            }}
          >
            {letter}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: fonts.titleBold, letterSpacing: 0.5 },
});
