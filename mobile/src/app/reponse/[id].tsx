import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../../components/Dialog";
import { Screen } from "../../components/Screen";
import { border, colors, fonts } from "../../components/theme";
import { Button, Card, Pill, SpeechBubble, txt } from "../../components/ui";
import { REPLY_GOALS, writeReply, type ReplyGoal } from "../../engine/reply";
import { getDocument, getSetting } from "../../lib/db";
import { withLockSuspended } from "../../lib/lock";
import { todayIso } from "../../lib/text";
import type { DocumentRecord } from "../../lib/types";

// Les numéros qui servent de références dans un courrier (pas le nom, ni l'IBAN).
const REFERENCE_LABELS = [
  "N° allocataire",
  "Numéro fiscal",
  "Référence de l'avis",
  "N° de télépaiement",
  "N° de dossier",
  "N° de contrat",
  "N° client",
  "N° de facture",
  "Référence",
  "Immatriculation",
];

export default function Reply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const dialog = useDialog();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [sender, setSender] = useState("");
  const [goal, setGoal] = useState<ReplyGoal>("delai");
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    (async () => {
      setDoc(await getDocument(db, id));
      setSender((await getSetting(db, "sender")) ?? "");
    })();
  }, [db, id]);

  const generate = () => {
    if (!doc) return;
    setDraft(
      writeReply({
        goal,
        sender,
        issuer: doc.issuer,
        docTitle: doc.title,
        docDate: doc.docDate,
        amount: doc.amountDirection === "a_payer" ? doc.amount : null,
        references: doc.keyFacts.filter((f) => REFERENCE_LABELS.includes(f.label)),
        details,
        today: todayIso(),
      }),
    );
  };

  const copy = async () => {
    await Clipboard.setStringAsync(draft);
    await dialog.alert({ title: "Copié", message: "Le courrier est dans le presse-papiers.", mood: "party" });
  };

  return (
    <Screen title="Écrire une réponse" onClose={() => router.back()}>
      <SpeechBubble mood={draft ? "party" : "happy"}>
        {draft ? "Voilà ! Relis-le et complète ce qui est entre [crochets]." : "Qu’est-ce que tu veux demander ?"}
      </SpeechBubble>

      <View style={styles.pills}>
        {REPLY_GOALS.map((g) => (
          <Pill key={g.id} label={g.label} selected={g.id === goal} onPress={() => setGoal(g.id)} />
        ))}
      </View>
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Précisions (facultatif) : ex. je peux payer 50 € par mois"
        placeholderTextColor={colors.muted}
        multiline
        style={styles.input}
        accessibilityLabel="Précisions pour le courrier"
      />
      {!sender ? <Text style={txt.small}>Astuce : mets tes coordonnées dans Réglages pour qu’elles soient dans le courrier.</Text> : null}
      <Button label="Écrire le courrier" icon="pencil" variant="sun" size="lg" onPress={generate} disabled={!doc} />

      {draft ? (
        <>
          <Card>
            <TextInput value={draft} onChangeText={setDraft} multiline style={styles.draft} accessibilityLabel="Courrier" />
          </Card>
          <View style={styles.row}>
            <Button label="Copier" icon="copy" variant="secondary" size="sm" onPress={() => void copy()} style={styles.flex} />
            <Button
              label="Partager"
              icon="share"
              variant="info"
              size="sm"
              onPress={() => void withLockSuspended(() => Share.share({ message: draft }))}
              style={styles.flex}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: border,
    borderColor: colors.ink,
    padding: 12,
    minHeight: 76,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
  draft: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: "top" },
});
