import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SPEECH_LANG, speechChunks, type EasyLine } from "../engine/easyRead";
import type { Lang } from "../engine/i18n";
import { Icon } from "./Icon";
import { colors, fonts, tones } from "./theme";
import { Button, Card } from "./ui";

export function ListenButton({ text, lang, size = "md" }: { text: string; lang: Lang; size?: "md" | "lg" }) {
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current++;
      void Speech.stop();
    },
    [],
  );

  const toggle = async () => {
    if (speaking) {
      run.current++;
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    const chunks = speechChunks(text, Math.min(3500, Speech.maxSpeechInputLength || 3500));
    if (!chunks.length) return;
    const id = ++run.current;
    await Speech.stop();
    setSpeaking(true);
    const end = () => {
      if (run.current === id) setSpeaking(false);
    };
    chunks.forEach((c, i) =>
      Speech.speak(c, {
        language: SPEECH_LANG[lang],
        rate: 0.92,
        onDone: i === chunks.length - 1 ? end : undefined,
        onStopped: end,
        onError: end,
      }),
    );
  };

  return (
    <Button
      label={speaking ? "Arrêter" : "Écouter"}
      icon={speaking ? "close" : "message"}
      variant={speaking ? "secondary" : "info"}
      size={size}
      onPress={() => void toggle()}
    />
  );
}

const ICONS = { warning: "warning", file: "file", check: "check", euro: "euro", calendar: "calendar", idcard: "idcard" } as const;

/** L'essentiel en gros : une idée par ligne. */
export function EasyCard({ lines, speech, lang }: { lines: EasyLine[]; speech: string; lang: Lang }) {
  // Arabe : lignes lues de droite à gauche, icône à droite.
  const rtl = lang === "ar";
  return (
    <Card>
      <Text style={styles.title}>L’essentiel</Text>
      {lines.map((l, i) => {
        const fg = l.tone === "neutral" ? colors.ink : tones[l.tone].fg;
        return (
          <View key={i} style={[styles.line, rtl && styles.lineRtl, l.tone !== "neutral" && { backgroundColor: tones[l.tone].bg }]}>
            <Icon name={ICONS[l.icon]} size={30} color={fg} />
            <View style={styles.flex}>
              <Text style={[styles.label, { color: fg }, rtl && styles.rtl]}>{l.label}</Text>
              <Text style={[styles.text, { color: fg }, rtl && styles.rtl]}>{l.text}</Text>
            </View>
          </View>
        );
      })}
      <ListenButton text={speech} lang={lang} size="lg" />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.titleBold, fontSize: 26, color: colors.ink, marginBottom: 6 },
  line: { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, marginBottom: 6 },
  lineRtl: { flexDirection: "row-reverse" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
  flex: { flex: 1 },
  label: { fontFamily: fonts.bodyStrong, fontSize: 16 },
  text: { fontFamily: fonts.body, fontSize: 22, lineHeight: 30 },
});
