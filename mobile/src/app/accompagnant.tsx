import type { File } from "expo-file-system";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { border, colors, fonts, tones } from "../components/theme";
import { Button, Card, Pill, SectionTitle, SpeechBubble, txt } from "../components/ui";
import { WhoPills } from "../components/WhoPills";
import { COMPANION_PURPOSES } from "../engine/dossierPdf";
import { belongsTo, ownerName, type Person, type Who } from "../engine/people";
import { shareFile } from "../lib/backup";
import { CATEGORIES, categoryOf } from "../lib/categories";
import { listAll, listPeople } from "../lib/db";
import { writeCompanionPdf } from "../lib/dossierShare";
import { goBack } from "../lib/nav";
import { useNoScreenshots } from "../lib/privacyScreen";
import { formatDate, todayIso } from "../lib/text";
import type { DocumentRecord } from "../lib/types";

/** Titre du dossier selon la personne concernée. */
function dossierTitle(who: Who, people: Person[]): string {
  if (who === "tous") return "Dossier — papiers de la famille";
  if (who === "moi") return "Dossier — mes papiers";
  return `Dossier — papiers de ${ownerName(who, people)}`;
}

/**
 * Dossier pour un accompagnant (assistante sociale, CCAS, France Services…) : les papiers choisis en un seul PDF,
 * résumé de chaque papier en première page, filigrane « motif — destinataire — date » partout.
 */
export default function CompanionScreen() {
  const db = useSQLiteContext();
  const dialog = useDialog();
  useNoScreenshots(true, "accompagnant");
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [who, setWho] = useState<Who>("moi");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState<string>(COMPANION_PURPOSES[0]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ file: File; pages: number } | null>(null);

  useEffect(() => {
    void Promise.all([listAll(db), listPeople(db)]).then(([all, ps]) => {
      setDocs(all);
      setPeople(ps);
      const start: Who = ps.length ? "moi" : "tous";
      setWho(start);
      setChosen(new Set(all.filter((d) => belongsTo(d.personId, start)).map((d) => d.id)));
    });
  }, [db]);

  const shown = useMemo(() => (docs ?? []).filter((d) => belongsTo(d.personId, who)), [docs, who]);
  const selected = useMemo(() => shown.filter((d) => chosen.has(d.id)), [shown, chosen]);

  const chooseWho = (w: Who) => {
    setWho(w);
    setChosen(new Set((docs ?? []).filter((d) => belongsTo(d.personId, w)).map((d) => d.id)));
  };

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const make = async () => {
    setBusy(true);
    try {
      const r = await writeCompanionPdf(db, { title: dossierTitle(who, people), purpose, recipient: recipient.trim(), papers: selected });
      if (r.skipped.length)
        await dialog.alert({
          title: "À savoir avant d’envoyer",
          message: r.skipped.map((s) => `• ${s.title} : ${s.reason}`).join("\n"),
          mood: "worried",
        });
      setMade({ file: r.file, pages: r.pages });
    } catch (e) {
      await dialog.alert({ title: "PDF impossible", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!made) return;
    try {
      await shareFile(made.file, "application/pdf", "Dossier pour un accompagnant");
    } catch (e) {
      await dialog.alert({ title: "Partage impossible", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
    }
  };

  // Même forme que le filigrane du PDF (JJ/MM/AAAA).
  const mark = [purpose, recipient.trim(), todayIso().split("-").reverse().join("/")].filter(Boolean).join(" — ");

  if (made) {
    return (
      <Screen title="Dossier prêt" onClose={goBack}>
        <SpeechBubble mood="party">
          {made.pages} page{made.pages > 1 ? "s" : ""}, avec le résumé des papiers en première page et le filigrane « {mark} » partout.
        </SpeechBubble>
        <Button label="Envoyer le dossier" icon="share" variant="sun" size="lg" onPress={() => void send()} />
        <Button label="Refaire un dossier" icon="refresh" variant="secondary" onPress={() => setMade(null)} />
        <Text style={[txt.small, { textAlign: "center" }]}>
          Le filigrane dit à qui et pour quoi ce dossier a été remis : il ne peut pas servir à autre chose sans que ça se voie.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen title="Dossier pour un accompagnant" onClose={goBack}>
      <SpeechBubble mood="happy">
        Une assistante sociale, le CCAS ou France Services a besoin de tes papiers ? Choisis-les : je fais un seul PDF, avec un résumé
        de chacun en première page et un filigrane à son nom.
      </SpeechBubble>

      {people.length > 0 ? (
        <>
          <SectionTitle>Les papiers de</SectionTitle>
          <WhoPills people={people} value={who} onChange={chooseWho} withAll />
        </>
      ) : null}

      <SectionTitle>Pour qui ?</SectionTitle>
      <TextInput
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Ex. Mme Martin, assistante sociale (facultatif)"
        placeholderTextColor={colors.muted}
        maxLength={60}
        style={styles.input}
        accessibilityLabel="Destinataire du dossier"
      />
      <SectionTitle>Pour quoi ?</SectionTitle>
      <View style={styles.pills}>
        {COMPANION_PURPOSES.map((p) => (
          <Pill key={p} label={p.replace(/^Uniquement pour /, "")} selected={p === purpose} onPress={() => setPurpose(p)} />
        ))}
      </View>

      <SectionTitle>{`Papiers du dossier (${selected.length})`}</SectionTitle>
      {docs === null ? null : shown.length === 0 ? (
        <Text style={txt.body}>Aucun papier pour cette personne.</Text>
      ) : (
        <Card flat>
          {shown.map((d) => {
            const on = chosen.has(d.id);
            const cat = CATEGORIES[categoryOf(d.category)];
            return (
              <Pressable key={d.id} onPress={() => toggle(d.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.row}>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={16} strokeWidth={3} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={txt.body} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={txt.small} numberOfLines={1}>
                    {[cat.label, d.issuer, d.docDate ? formatDate(d.docDate) : null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      <Card tone="purple" flat>
        <Text style={[txt.small, { color: tones.purple.fg }]}>
          Filigrane sur chaque page : « {mark} ». Donne seulement ce qui est demandé : un accompagnant n’a pas besoin de tout ton coffre.
        </Text>
      </Card>
      <Button label="Créer le PDF avec filigrane" icon="share" variant="sun" size="lg" loading={busy} disabled={selected.length === 0} onPress={() => void make()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: border,
    borderColor: colors.ink,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.sun },
});
