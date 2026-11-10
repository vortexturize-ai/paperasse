import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { border, colors, pop, tones } from "../../components/theme";
import { IconTile, txt } from "../../components/ui";
import { CATEGORIES, CATEGORY_KEYS } from "../../lib/categories";
import { countByCategory } from "../../lib/db";
import { useFocusData } from "../../lib/useFocusData";

export default function Folders() {
  const { data: counts } = useFocusData(countByCategory);
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <Screen
      title="Mes dossiers"
      right={
        <View style={styles.total}>
          <Text style={txt.strong}>
            {total} papier{total > 1 ? "s" : ""}
          </Text>
        </View>
      }
    >
      <View style={styles.grid}>
        {CATEGORY_KEYS.map((key) => {
          const cat = CATEGORIES[key];
          const n = counts?.[key] ?? 0;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label}, ${n} papiers`}
              onPress={() => router.push(`/dossier/${key}`)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: tones[cat.tone].bg },
                pop(4),
                pressed && { transform: [{ translateY: 2 }] },
              ]}
            >
              <IconTile icon={cat.icon} tone={cat.tone} size={44} />
              <View style={styles.tileText}>
                <Text style={txt.h3}>{cat.label}</Text>
                <Text style={[txt.small, { color: "#4A4361" }]}>
                  {n === 0 ? "vide" : `${n} papier${n > 1 ? "s" : ""}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: {
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    minHeight: 92,
    borderRadius: 20,
    borderWidth: border,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileText: { flex: 1, gap: 2 },
});
