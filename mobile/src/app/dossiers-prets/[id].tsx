import { goBack } from "../../lib/nav";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { border, colors, fonts, tones } from "../../components/theme";
import { Button, Card, Chip, EmptyState, SectionTitle, txt } from "../../components/ui";
import { shareFile } from "../../lib/backup";
import { writeDossierPdf } from "../../lib/dossierShare";
import { DOSSIERS, prepareDossier, whyNot } from "../../engine/dossiers";
import { formatDate, todayIso } from "../../lib/text";
import { useFocusData } from "../../lib/useFocusData";
import { loadPapers } from "../../lib/vault";

const STATUS = {
  ok: { label: "Prêt", tone: "green" as const },
  incomplet: { label: "Incomplet", tone: "orange" as const },
  manquant: { label: "Manquant", tone: "red" as const },
};

export default function DossierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exists = DOSSIERS.some((d) => d.id === id);
  const load = useCallback(async (db: SQLiteDatabase) => (exists ? prepareDossier(id, await loadPapers(db), todayIso()) : null), [id, exists]);
  const { data } = useFocusData(load);
  const db = useSQLiteContext();
  const dialog = useDialog();
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);

  const sendPdf = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const r = await writeDossierPdf(db, data, recipient);
      if (r.skipped.length)
        await dialog.alert({
          title: "À savoir avant d’envoyer",
          message: r.skipped.map((s) => `• ${s.title} : ${s.reason}`).join("\n"),
          mood: "worried",
        });
      await shareFile(r.file, "application/pdf", data.template.title);
    } catch (e) {
      await dialog.alert({ title: "PDF impossible", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
    } finally {
      setBusy(false);
    }
  };

  if (!exists) {
    return (
      <Screen onBack={goBack}>
        <EmptyState title="Ce dossier n’existe pas" />
      </Screen>
    );
  }
  if (!data) return null;
  return (
    <Screen title={data.template.title} onBack={goBack}>
      <Text style={txt.body}>{data.template.intro}</Text>
      {data.items.map((it) => (
        <Card key={it.requirement.id} flat>
          <View style={styles.row}>
            <Text style={[txt.h3, { flex: 1 }]}>{it.requirement.label}</Text>
            <Chip label={it.requirement.optional && it.status !== "ok" ? "Facultatif" : STATUS[it.status].label} tone={it.requirement.optional && it.status !== "ok" ? "neutral" : STATUS[it.status].tone} />
          </View>
          <Text style={txt.small}>{it.requirement.hint}</Text>
          {it.papers.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/document/${p.id}`)} style={styles.paper}>
              <Icon name="check" size={18} color={tones.green.fg} />
              <Text style={[txt.small, { flex: 1, color: tones.green.fg }]}>{p.title}</Text>
            </Pressable>
          ))}
          {it.tooOld.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/document/${p.id}`)} style={styles.paper}>
              <Icon name="warning" size={18} color={tones.orange.fg} />
              <Text style={[txt.small, { flex: 1, color: tones.orange.fg }]}>
                {p.title} : {(() => {
                  const why = whyNot(p, it.requirement, todayIso());
                  if (why === "perime" && p.expiry) return `périmé depuis le ${formatDate(p.expiry)}`;
                  if (why === "ancien") return "trop ancien";
                  return "ne convient pas pour cette ligne";
                })()}
              </Text>
            </Pressable>
          ))}
        </Card>
      ))}
      {data.template.forbidden ? (
        <>
          <SectionTitle>On n’a pas le droit de te demander</SectionTitle>
          <Card tone="purple" flat>
            {data.template.forbidden.map((f, i) => (
              <Text key={i} style={[txt.body, { color: tones.purple.fg }]}>• {f}</Text>
            ))}
            <Text style={[txt.small, { color: tones.purple.fg }]}>Si on te les réclame, tu peux refuser. Tu peux aussi le signaler à l’ADIL de ton département (conseils gratuits).</Text>
          </Card>
        </>
      ) : null}
      {data.items.some((i) => i.papers.length > 0) ? (
        <>
          <SectionTitle>Envoyer le dossier</SectionTitle>
          <Card flat>
            <Text style={txt.body}>
              Toutes les pièces en un seul PDF, avec un filigrane sur chaque page : « {data.template.purpose}
              {recipient.trim() ? ` — ${recipient.trim()}` : ""} — {formatDate(todayIso())} ». Personne ne pourra les réutiliser pour autre chose.
            </Text>
            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Pour qui ? (agence, banque…) facultatif"
              placeholderTextColor={colors.muted}
              maxLength={60}
              style={styles.input}
              accessibilityLabel="Destinataire du dossier"
            />
            <Button label="Créer le PDF avec filigrane" icon="share" variant="sun" loading={busy} onPress={() => void sendPdf()} />
            {data.missing ? <Text style={txt.small}>Les pièces manquantes seront listées en première page.</Text> : null}
          </Card>
        </>
      ) : null}
      <Text style={[txt.small, { textAlign: "center" }]}>Source : {data.template.source}.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  paper: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: border,
    borderColor: colors.ink,
    padding: 12,
    marginVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
});
