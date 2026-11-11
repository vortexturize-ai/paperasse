"use no memo";
// Dessin du widget Android « Prochaine échéance ». Fonctions simples (pas de hooks) : la bibliothèque les
// transforme en vues Android. Chargé seulement si le module natif du widget est dans l'app (voir lib/widget.ts).
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetView } from "../lib/widgetData";

type Hex = `#${string}`;
interface Palette {
  bg: Hex;
  ink: Hex;
  sub: Hex;
  border: Hex;
  chip: { bg: Hex; fg: Hex };
  urgent: { bg: Hex; fg: Hex };
  calm: { bg: Hex; fg: Hex };
}

// Couleurs de l'app (components/theme.ts), recopiées : ce fichier ne charge rien d'autre.
const LIGHT: Palette = {
  bg: "#FFF8EC",
  ink: "#2B2440",
  sub: "#4A4361",
  border: "#2B2440",
  chip: { bg: "#FFE3C7", fg: "#9A4A00" },
  urgent: { bg: "#FFD9DF", fg: "#A3122F" },
  calm: { bg: "#D8F5DC", fg: "#1F6B2E" },
};
const DARK: Palette = {
  bg: "#2B2440",
  ink: "#FFF3D6",
  sub: "#D9D2EE",
  border: "#FFD15C",
  chip: { bg: "#FFD15C", fg: "#2B2440" },
  urgent: { bg: "#FF9AAA", fg: "#2B2440" },
  calm: { bg: "#A8E6B4", fg: "#2B2440" },
};

function Card({ view, c }: { view: WidgetView; c: Palette }) {
  const tone = view.empty ? c.calm : view.urgent ? c.urgent : c.chip;
  const spoken = view.empty ? `${view.when}. ${view.what}` : `${view.label} ${view.when.toLowerCase()}, ${view.date} : ${view.what}.`;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`Paperasse. ${spoken} Ouvrir Paperasse.`}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: c.bg,
        borderRadius: 24,
        borderWidth: 3,
        borderColor: c.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <FlexWidget style={{ backgroundColor: tone.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
          <TextWidget text={view.label} maxLines={1} style={{ fontSize: 13, fontFamily: "Nunito_800ExtraBold", color: tone.fg }} />
        </FlexWidget>
        {view.date ? <TextWidget text={view.date} maxLines={1} style={{ fontSize: 13, fontFamily: "Nunito_700Bold", color: c.sub }} /> : null}
      </FlexWidget>
      <TextWidget text={view.when} maxLines={1} truncate="END" style={{ fontSize: 26, fontFamily: "Fredoka_600SemiBold", color: c.ink }} />
      <TextWidget text={view.what} maxLines={2} truncate="END" style={{ fontSize: 15, fontFamily: "Nunito_700Bold", color: c.ink }} />
      {view.more ? <TextWidget text={view.more} maxLines={1} style={{ fontSize: 12, fontFamily: "Nunito_700Bold", color: c.sub }} /> : null}
    </FlexWidget>
  );
}

/** Version claire et sombre : Android choisit selon le thème du téléphone. */
export function echeanceWidget(view: WidgetView) {
  return { light: <Card view={view} c={LIGHT} />, dark: <Card view={view} c={DARK} /> };
}
