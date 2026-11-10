import { goBack } from "../../lib/nav";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DateField } from "../../components/DateField";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { colors, fonts, tones } from "../../components/theme";
import { Card, Chip, EmptyState, deadlineChip, txt } from "../../components/ui";
import { LIFE_EVENTS, planLifeEvent, type LifeEventId } from "../../engine/lifeEvents";
import { DOC_TYPES } from "../../lib/categories";
import { getSetting, setSetting } from "../../lib/db";
import { formatDate, todayIso } from "../../lib/text";
import { useFocusData } from "../../lib/useFocusData";
import { loadPapers } from "../../lib/vault";

export default function LifeEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const event = LIFE_EVENTS.find((e) => e.id === id);
  const load = useCallback(async (database: SQLiteDatabase) => ({
    papers: await loadPapers(database),
    saved: await getSetting(database, `life:${id}`),
  }), [id]);
  const { data } = useFocusData(load);
  // Tant que rien n'est tapé, on reprend la date enregistrée la dernière fois.
  const [typed, setTyped] = useState<string | null | undefined>(undefined);
  const date = typed === undefined ? (data?.saved ?? null) : typed;

  const choose = (iso: string | null) => {
    setTyped(iso);
    if (iso) void setSetting(db, `life:${id}`, iso);
  };

  if (!event) {
    return (
      <Screen onBack={goBack}>
        <EmptyState title="Ce moment de vie n’existe pas" />
      </Screen>
    );
  }
  if (!data) return null;
  const plan = date ? planLifeEvent(event.id as LifeEventId, date, data.papers, todayIso()) : null;

  return (
    <Screen title={event.title} onBack={goBack}>
      <Text style={txt.body}>{event.intro}</Text>
      <Card flat>
        <DateField key={data.saved ?? "vide"} label={event.question} value={date} onChange={choose} />
      </Card>

      {plan?.steps.map((s, i) => (
        <Card key={s.step.id} flat tone={s.overdue ? "red" : undefined}>
          <View style={styles.row}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={txt.h3}>{s.step.title}</Text>
              <View style={styles.chips}>
                {s.due ? <Chip {...deadlineChip(s.due)} icon="clock" /> : null}
                {s.due ? <Text style={txt.small}>{formatDate(s.due)}</Text> : null}
                {s.step.legal ? <Chip label="délai légal" tone="purple" /> : null}
                {s.step.optional ? <Chip label="facultatif" tone="neutral" /> : null}
              </View>
            </View>
          </View>
          <Text style={txt.body}>{s.step.detail}</Text>
          {s.step.site ? <Text style={[txt.small, { color: tones.blue.fg }]}>Site officiel : {s.step.site}</Text> : null}
          {s.papers.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/document/${p.id}`)} style={styles.paper}>
              <Icon name="check" size={18} color={tones.green.fg} />
              <Text style={[txt.small, { flex: 1, color: tones.green.fg }]}>Dans ton coffre : {p.title}</Text>
            </Pressable>
          ))}
          {s.missing.length ? (
            <Text style={[txt.small, { color: tones.orange.fg }]}>Pas encore dans ton coffre : {s.missing.map((t) => DOC_TYPES[t]).join(", ")}</Text>
          ) : null}
        </Card>
      ))}
      {plan ? <Text style={[txt.small, { textAlign: "center" }]}>Délais vérifiés sur service-public.fr. En cas de doute, ta mairie ou France Services peuvent t’aider gratuitement.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  number: { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.sun, alignItems: "center", justifyContent: "center" },
  numberText: { fontFamily: fonts.titleBold, fontSize: 16, color: colors.ink },
  paper: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
});
