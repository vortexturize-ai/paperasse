import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useIncomingShare, type ResolvedSharePayload } from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { tones } from "../components/theme";
import { Button, Card, EmptyState, Pill, SpeechBubble, txt } from "../components/ui";
import { getSetting } from "../lib/db";
import { feedback } from "../lib/feedback";
import { importItems, kindOf, type ImportReport, type IncomingItem } from "../lib/importer";
import { withLockSuspended } from "../lib/lock";
import { goBack } from "../lib/nav";

const ICONS: Record<string, IconName> = { image: "image", pdf: "file", text: "text", zip: "folder" };

function fromPayload(p: ResolvedSharePayload): IncomingItem | null {
  if (p.contentType === "text" || (!p.contentUri && p.value)) return { uri: "", mime: "text/plain", name: "Texte partagé", text: p.value };
  if (!p.contentUri) return null;
  return { uri: p.contentUri, mime: p.contentMimeType ?? p.mimeType ?? "", name: p.originalName ?? "fichier" };
}

export default function ReceiveScreen() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const db = useSQLiteContext();
  const share = useIncomingShare();
  const [picked, setPicked] = useState<IncomingItem[]>([]);
  const [together, setTogether] = useState(true);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const askedPicker = useRef(false);

  const shared = useMemo(
    () => share.resolvedSharedPayloads.map(fromPayload).filter((x): x is IncomingItem => x !== null),
    [share.resolvedSharedPayloads],
  );
  const items = source === "fichiers" ? picked : shared;
  const images = items.filter((i) => kindOf(i) === "image").length;

  const pick = async () => {
    const res = await withLockSuspended(() =>
      DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*", "application/zip", "text/plain"], multiple: true, copyToCacheDirectory: true }),
    );
    if (!res.canceled) setPicked(res.assets.map((a) => ({ uri: a.uri, mime: a.mimeType ?? "", name: a.name })));
  };

  useEffect(() => {
    if (source === "fichiers" && !askedPicker.current) {
      askedPicker.current = true;
      void pick();
    }
  }, [source]);

  const run = async () => {
    setBusy(true);
    try {
      const language = (await getSetting(db, "language")) ?? "français";
      const r = await importItems(db, items, { together, language });
      setReport(r);
      if (r.created.length) feedback("success");
      if (source !== "fichiers") share.clearSharedPayloads();
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    const one = report.created.length === 1;
    return (
      <Screen title="C’est rangé" onClose={() => router.replace("/")}>
        <SpeechBubble mood={report.created.length ? "party" : "worried"}>
          {report.created.length
            ? `${report.created.length} papier${one ? "" : "s"} rangé${one ? "" : "s"} et lu${one ? "" : "s"} sur ton téléphone.`
            : "Je n’ai rien pu ranger."}
        </SpeechBubble>
        {report.failed.length + report.skipped.length > 0 ? (
          <Card flat tone="yellow">
            {[...report.failed, ...report.skipped].map((f, i) => (
              <Text key={i} style={[txt.small, { color: tones.yellow.fg }]}>• {f.name} : {f.reason}</Text>
            ))}
          </Card>
        ) : null}
        {one ? <Button label="Voir le papier" variant="sun" onPress={() => router.replace(`/document/${report.created[0]}`)} /> : null}
        <Button label="Retour à l’accueil" variant="secondary" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  return (
    <Screen title={source === "fichiers" ? "Importer" : "Reçu dans Paperasse"} onBack={goBack}>
      {source !== "fichiers" && share.isResolving ? <SpeechBubble mood="reading">Je regarde ce que tu m’as envoyé…</SpeechBubble> : null}
      {source !== "fichiers" && share.error ? (
        <Card tone="red" flat>
          <Text style={[txt.body, { color: tones.red.fg }]}>Je n’ai pas pu ouvrir ce qui a été partagé. Réessaie depuis l’autre app.</Text>
        </Card>
      ) : null}
      {items.length === 0 && !share.isResolving ? (
        source === "fichiers" ? (
          <>
            <EmptyState title="Choisis tes fichiers" text="Photos, PDF, ou une archive ZIP (par exemple l’export de ton ancien coffre-fort). Je range tout d’un coup." mood="happy" />
            <Button label="Choisir des fichiers" icon="folder" variant="sun" onPress={() => void pick()} />
          </>
        ) : (
          <EmptyState title="Rien à ranger" text="Partage un papier depuis Mail, WhatsApp ou Fichiers, en choisissant Paperasse." />
        )
      ) : null}
      {items.length > 0 ? (
        <>
          <Card flat>
            {items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Icon name={ICONS[kindOf(it) ?? "pdf"] ?? "file"} size={20} />
                <Text style={[txt.body, { flex: 1 }]} numberOfLines={1}>{it.text !== undefined ? `« ${it.text.slice(0, 60)}${it.text.length > 60 ? "…" : ""} »` : it.name}</Text>
              </View>
            ))}
          </Card>
          {images > 1 ? (
            <View style={styles.pills}>
              <Pill label="Un seul papier (pages)" selected={together} onPress={() => setTogether(true)} />
              <Pill label="Un papier par photo" selected={!together} onPress={() => setTogether(false)} />
            </View>
          ) : null}
          <Button label={`Ranger ${items.length > 1 ? `les ${items.length}` : "dans Paperasse"}`} icon="check" variant="sun" size="lg" loading={busy} onPress={() => void run()} />
          <Text style={[txt.small, { textAlign: "center" }]}>Tout est lu et rangé sur ton téléphone. Rien n’est envoyé sur Internet.</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
