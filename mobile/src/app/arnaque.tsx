import { goBack } from "../lib/nav";
import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { border, colors, fonts, tones } from "../components/theme";
import { Card, SpeechBubble, txt } from "../components/ui";
import { findPersonalData } from "../engine/privacy";
import { detectScam, SCAM_ACTIONS } from "../engine/scam";

export default function ScamCheckScreen() {
  const [text, setText] = useState("");
  const report = useMemo(() => (text.trim().length >= 10 ? detectScam(text) : null), [text]);
  const personal = useMemo(() => (text.trim() ? findPersonalData(text) : []), [text]);

  return (
    <Screen title="Vérifier un message" onBack={goBack}>
      <SpeechBubble mood="reading">Colle ici un SMS ou un mail qui te paraît bizarre. Je te dis s’il ressemble à une arnaque, sans rien envoyer sur Internet.</SpeechBubble>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Colle le message ici…"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Message à vérifier"
        textAlignVertical="top"
      />
      {report ? (
        report.level === "aucun" ? (
          <Card tone="green">
            <View style={styles.row}>
              <Icon name="check" size={24} color={tones.green.fg} />
              <Text style={[txt.h3, { flex: 1, color: tones.green.fg }]}>Pas de signe d’arnaque connu</Text>
            </View>
            <Text style={txt.body}>Reste prudent : en cas de doute, va toi-même sur le site officiel au lieu de cliquer sur un lien.</Text>
          </Card>
        ) : (
          <Card tone={report.level === "arnaque_probable" ? "red" : "yellow"}>
            <View style={styles.row}>
              <Icon name="warning" size={26} color={report.level === "arnaque_probable" ? tones.red.fg : tones.yellow.fg} />
              <Text style={[txt.h2, { flex: 1, color: report.level === "arnaque_probable" ? tones.red.fg : tones.yellow.fg }]}>
                {report.level === "arnaque_probable" ? "Arnaque probable" : "Message suspect"}
              </Text>
            </View>
            {report.reasons.map((r, i) => <Text key={i} style={txt.body}>• {r}</Text>)}
            <Text style={[txt.h3, { marginTop: 6 }]}>Les bons réflexes</Text>
            {SCAM_ACTIONS.map((a, i) => <Text key={i} style={txt.body}>{i + 1}. {a}</Text>)}
          </Card>
        )
      ) : null}
      {report && report.links.length > 0 ? (
        <Card flat>
          <Text style={txt.h3}>Liens dans le message</Text>
          {report.links.map((l) => (
            <View key={l.domain} style={styles.row}>
              <Icon name={l.official ? "check" : "warning"} size={18} color={l.official ? tones.green.fg : tones.red.fg} />
              <Text style={[txt.body, { flex: 1 }]}>{l.domain}{l.official ? " (site officiel)" : l.impersonates ? ` (imite ${l.impersonates})` : " (pas un site officiel connu)"}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {personal.length > 0 ? (
        <Card flat tone="purple">
          <Text style={[txt.small, { color: tones.purple.fg }]}>
            Ce message contient {personal.length} donnée{personal.length > 1 ? "s" : ""} personnelle{personal.length > 1 ? "s" : ""} ({[...new Set(personal.map((p) => p.label))].join(", ")}). Ne les renvoie jamais à un expéditeur que tu ne connais pas.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    minHeight: 140,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: border - 1,
    borderColor: colors.ink,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
});
