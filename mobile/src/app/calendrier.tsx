import { goBack } from "../lib/nav";
import { router } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { colors, fonts, pop, tones } from "../components/theme";
import { Card, Chip, EmptyState, deadlineChip, txt } from "../components/ui";
import { adminCalendar, type CalendarEvent } from "../engine/calendar";
import { calendarParts, todayIso } from "../lib/text";
import { useFocusData } from "../lib/useFocusData";
import { loadPapers } from "../lib/vault";

const ICONS: Record<CalendarEvent["kind"], IconName> = {
  echeance: "clock",
  expiration: "idcard",
  controle_technique: "car",
  assurance: "shield",
  impots: "receipt",
  actualisation: "briefcase",
  essai: "briefcase",
  caf: "mail",
};

async function load(db: SQLiteDatabase) {
  return adminCalendar(await loadPapers(db), todayIso());
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function CalendarScreen() {
  const { data } = useFocusData(load);
  const groups: [string, CalendarEvent[]][] = [];
  for (const e of data ?? []) {
    const key = `${MONTHS[Number(e.date.slice(5, 7)) - 1]} ${e.date.slice(0, 4)}`;
    const g = groups.find(([k]) => k === key);
    if (g) g[1].push(e);
    else groups.push([key, [e]]);
  }
  return (
    <Screen title="Mon calendrier" onBack={goBack}>
      <Text style={txt.small}>Toutes les dates qui comptent, trouvées dans tes papiers. « Environ » : la date exacte est sur le site officiel.</Text>
      {data && data.length === 0 ? (
        <EmptyState title="Rien de prévu pour l’instant" text="Ajoute tes papiers (carte grise, assurance, avis d’impôt, contrat…) : je calcule les dates pour toi." />
      ) : null}
      {groups.map(([month, events]) => (
        <View key={month} style={{ gap: 10 }}>
          <Text style={txt.h2}>{month}</Text>
          {events.map((e, i) => (
            <Pressable
              key={`${e.date}-${i}`}
              disabled={!e.paperId}
              accessibilityRole={e.paperId ? "button" : undefined}
              onPress={() => e.paperId && router.push(`/document/${e.paperId}`)}
            >
              <Card flat style={styles.event}>
                <View style={[styles.day, pop(2)]}>
                  <Text style={styles.dayMonth}>{calendarParts(e.date).month}</Text>
                  <Text style={styles.dayNumber}>{calendarParts(e.date).day}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.row}>
                    <Icon name={ICONS[e.kind]} size={18} />
                    <Text style={[txt.strong, { flex: 1 }]}>{e.title}</Text>
                  </View>
                  <Text style={txt.small}>{e.detail}</Text>
                  <View style={styles.row}>
                    <Chip {...deadlineChip(e.date)} />
                    {e.certainty === "approx" ? <Chip label="environ" tone="neutral" /> : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  event: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  day: { width: 56, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card, overflow: "hidden" },
  dayMonth: { backgroundColor: tones.red.fg, color: "#FFFFFF", textAlign: "center", fontFamily: fonts.bodyStrong, fontSize: 11, paddingVertical: 2 },
  dayNumber: { textAlign: "center", fontFamily: fonts.titleBold, fontSize: 24, lineHeight: 34, color: colors.ink },
});
