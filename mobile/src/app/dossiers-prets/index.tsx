import { goBack } from "../../lib/nav";
import { router } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { Card, Chip, SpeechBubble, txt } from "../../components/ui";
import { DOSSIERS, prepareDossier } from "../../engine/dossiers";
import { todayIso } from "../../lib/text";
import { useFocusData } from "../../lib/useFocusData";
import { loadPapers } from "../../lib/vault";

async function load(db: SQLiteDatabase) {
  const papers = await loadPapers(db);
  return DOSSIERS.map((d) => prepareDossier(d.id, papers, todayIso()));
}

export default function DossiersScreen() {
  const { data } = useFocusData(load);
  return (
    <Screen title="Dossiers prêts" onBack={goBack}>
      <SpeechBubble mood="happy">Je regarde ton coffre et je te dis ce que tu as déjà pour chaque démarche, et ce qui manque.</SpeechBubble>
      {(data ?? []).map((r) => (
        <Pressable key={r.template.id} accessibilityRole="button" onPress={() => router.push(`/dossiers-prets/${r.template.id}`)}>
          <Card>
            <View style={styles.row}>
              <Icon name="folderCheck" size={24} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={txt.h3}>{r.template.title}</Text>
                {r.ready ? <Chip label="Tout est prêt" tone="green" icon="check" /> : <Chip label={`${r.missing} pièce${r.missing > 1 ? "s" : ""} à compléter`} tone="orange" />}
              </View>
              <Icon name="chevron" size={18} />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 12 } });
