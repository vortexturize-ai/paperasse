import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import { useDialog } from "../../components/Dialog";
import { PdfPasswordCard, usePdfPassword } from "../../components/PdfPassword";
import { Screen } from "../../components/Screen";
import { Button, Card, EmptyState, SpeechBubble, txt } from "../../components/ui";
import { isSensitivePaper } from "../../engine/sensitive";
import { shareFile } from "../../lib/backup";
import { getDocument, getFiles } from "../../lib/db";
import { writePaperPdf } from "../../lib/dossierShare";
import { uriFor } from "../../lib/files";
import { goBack } from "../../lib/nav";
import { useNoScreenshots } from "../../lib/privacyScreen";
import { withLockSuspended } from "../../lib/suspend";
import { useFocusData } from "../../lib/useFocusData";

/** Partager un papier : toutes ses pages en un PDF, protégé par un mot de passe si on veut. */
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const dialog = useDialog();
  const load = useCallback(async (database: SQLiteDatabase) => ({ doc: await getDocument(database, id), files: await getFiles(database, id) }), [id]);
  const { data } = useFocusData(load);
  const pw = usePdfPassword(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  useNoScreenshots(true, "partager");

  if (!data) return null;
  const { doc, files } = data;
  if (!doc) {
    return (
      <Screen onClose={goBack}>
        <EmptyState title="Ce papier n’existe plus" />
      </Screen>
    );
  }
  if (files.length === 0) {
    return (
      <Screen title="Partager" onClose={goBack}>
        <EmptyState title="Pas de page à partager" text="Ce papier n’a que du texte : copie-le depuis sa fiche." />
      </Screen>
    );
  }

  const sharePdf = async () => {
    setBusy(true);
    try {
      const r = await writePaperPdf(db, doc, pw.value);
      if (r.skipped.length)
        await dialog.alert({ title: "Une page n’a pas pu être incluse", message: r.skipped.map((s) => `• ${s.reason}`).join("\n"), mood: "worried" });
      await shareFile(r.file, "application/pdf", doc.title);
      setSent(pw.value ?? null);
    } catch (e) {
      await dialog.alert({ title: "Partage impossible", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
    } finally {
      setBusy(false);
    }
  };

  const shareAsIs = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      await dialog.alert({ title: "Partage indisponible sur ce téléphone.", mood: "worried" });
      return;
    }
    const f = files[0];
    await withLockSuspended(() => Sharing.shareAsync(uriFor(f.path), { mimeType: f.mime, dialogTitle: doc.title }));
  };

  return (
    <Screen title="Partager" onClose={goBack}>
      <Text style={txt.h3}>{doc.title}</Text>
      <Text style={txt.small}>
        {files.length > 1 ? `${files.length} pages, réunies dans un seul PDF.` : "1 page, en PDF."}
        {isSensitivePaper(doc) ? " Ce papier contient des données personnelles : protège-le." : ""}
      </Text>
      <PdfPasswordCard state={pw} />
      <Button
        label={pw.on ? "Partager le PDF protégé" : "Partager le PDF"}
        icon={pw.on ? "lock" : "share"}
        variant="sun"
        size="lg"
        loading={busy}
        disabled={Boolean(pw.problem)}
        onPress={() => void sharePdf()}
      />
      {files.length === 1 && !pw.on ? (
        <Button label="Envoyer le fichier tel quel" icon="file" variant="secondary" onPress={() => void shareAsIs()} />
      ) : null}
      {sent ? (
        <Card tone="purple" flat>
          <SpeechBubble mood="happy">Pense à donner le mot de passe à part : {sent}</SpeechBubble>
        </Card>
      ) : null}
    </Screen>
  );
}
