import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { findDates } from "../engine/dates";
import { fold } from "../engine/normalize";
import { formatDate } from "../lib/text";
import { border, colors, fonts } from "./theme";
import { txt } from "./ui";

export function parseUserDate(input: string): string | null {
  return findDates(fold(input.trim()))[0]?.iso ?? null;
}

export function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (iso: string | null) => void }) {
  const [raw, setRaw] = useState(value ? value.split("-").reverse().join("/") : "");
  const iso = parseUserDate(raw);
  return (
    <View style={{ gap: 6 }}>
      <Text style={txt.strong}>{label}</Text>
      <TextInput
        value={raw}
        onChangeText={(t) => {
          setRaw(t);
          onChange(parseUserDate(t));
        }}
        placeholder="JJ/MM/AAAA"
        placeholderTextColor={colors.muted}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={label}
        style={styles.input}
      />
      {raw.trim() ? (
        <Text style={[txt.small, { color: iso ? colors.ink : "#A3122F" }]}>{iso ? `Le ${formatDate(iso)}` : "Date pas comprise : écris-la comme 15/12/2026."}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: border - 1,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyStrong,
    fontSize: 17,
    color: colors.ink,
  },
});
