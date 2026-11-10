import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { border, colors, fonts, tones } from "../components/theme";
import { Button, Card, SectionTitle, SpeechBubble, txt } from "../components/ui";
import { BackupError, formatRecoveryCode, recoveryCodeProblem, type BackupHeader } from "../engine/backup";
import {
  backupCode,
  cleanBackupCache,
  kitCode,
  peekBackup,
  restoreBackup,
  shareFile,
  writeBackup,
  writeSheet,
  type RestoreReport,
} from "../lib/backup";
import { listAll, listPeople, setSetting } from "../lib/db";
import { WhoPills } from "../components/WhoPills";
import { belongsTo, type Person } from "../engine/people";
import { goBack } from "../lib/nav";
import { useNoScreenshots } from "../lib/privacyScreen";
import { withLockSuspended } from "../lib/suspend";
import { formatDate } from "../lib/text";
import type { DocumentRecord } from "../lib/types";
import { useVault } from "../lib/vaultGate";

type Mode = "sauvegarde" | "restaurer" | "kit";

function errorText(e: unknown): string {
  return e instanceof BackupError || e instanceof Error ? e.message : "Erreur inconnue.";
}

function CodeBox({ code }: { code: string }) {
  return (
    <View style={styles.codeBox} accessible accessibilityLabel={`Clé de secours : ${formatRecoveryCode(code).split("").join(" ")}`}>
      <Text selectable style={styles.code}>
        {formatRecoveryCode(code)}
      </Text>
    </View>
  );
}

export default function BackupScreen() {
  const { mode: raw } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = raw === "restaurer" || raw === "kit" ? raw : "sauvegarde";
  useNoScreenshots(true, "sauvegarde");
  useEffect(() => {
    cleanBackupCache();
    return cleanBackupCache;
  }, []);
  const title = mode === "restaurer" ? "Restaurer" : mode === "kit" ? "Kit d’urgence" : "Sauvegarde";
  return (
    <Screen title={title} onClose={goBack}>
      {mode === "restaurer" ? <Restore /> : mode === "kit" ? <Kit /> : <Backup />}
    </Screen>
  );
}

function Backup() {
  const db = useSQLiteContext();
  const vault = useVault();
  const dialog = useDialog();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ file: File; papers: number; missing: number } | null>(null);

  useEffect(() => {
    void backupCode(vault.kind).then(setCode);
  }, [vault.kind]);

  const make = async () => {
    if (!code) return;
    setBusy(true);
    try {
      const r = await writeBackup(db, { type: "sauvegarde", code, onProgress: (d, t) => setProgress(t ? `Page ${Math.min(d + 1, t)} sur ${t}…` : "") });
      setResult(r);
    } catch (e) {
      await dialog.alert({ title: "Sauvegarde impossible", message: errorText(e), mood: "worried" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const share = async () => {
    if (!result) return;
    try {
      await shareFile(result.file, "application/octet-stream", "Ranger ma sauvegarde Paperasse");
      await setSetting(db, "backup_last", new Date().toISOString());
    } catch (e) {
      await dialog.alert({ title: "Partage impossible", message: errorText(e), mood: "worried" });
    }
  };

  const printSheet = async () => {
    if (!code) return;
    try {
      const f = await writeSheet({ type: "sauvegarde", code, date: new Date().toISOString().slice(0, 10), fileName: result?.file.name ?? "Paperasse-sauvegarde-….paperasse" });
      await shareFile(f, "application/pdf", "Fiche de secours Paperasse");
    } catch (e) {
      await dialog.alert({ title: "Fiche impossible", message: errorText(e), mood: "worried" });
    }
  };

  const renew = async () => {
    const ok = await dialog.confirm({
      title: "Nouvelle clé de secours ?",
      message: "Les prochaines sauvegardes utiliseront la nouvelle clé. Les anciennes sauvegardes s’ouvrent toujours avec l’ancienne : garde-la tant que tu les gardes.",
      confirmLabel: "Nouvelle clé",
    });
    if (ok) {
      setCode(await backupCode(vault.kind, true));
      setResult(null);
    }
  };

  return (
    <>
      <SpeechBubble mood="happy">
        Je mets tous tes papiers dans un seul fichier chiffré. Range-le où tu veux : Google Drive, iCloud, une clé USB, un mail à
        toi-même. Sans ta clé de secours, personne ne peut l’ouvrir, même pas nous.
      </SpeechBubble>
      <SectionTitle>Ta clé de secours</SectionTitle>
      {code ? <CodeBox code={code} /> : null}
      <Text style={txt.small}>Écris-la sur papier ou imprime la fiche, et garde-la à part du fichier. La même clé sert pour toutes tes sauvegardes.</Text>
      <Button label="Imprimer la fiche de secours" icon="file" variant="secondary" onPress={() => void printSheet()} />

      <SectionTitle>Sauvegarder</SectionTitle>
      {result ? (
        <Card tone="green" flat>
          <Text style={[txt.strong, { color: tones.green.fg }]}>
            Sauvegarde prête : {result.papers} papier{result.papers > 1 ? "s" : ""}.
          </Text>
          {result.missing ? (
            <Text style={[txt.small, { color: tones.green.fg }]}>
              {result.missing} page{result.missing > 1 ? "s" : ""} introuvable{result.missing > 1 ? "s" : ""} sur le téléphone, non incluse
              {result.missing > 1 ? "s" : ""}.
            </Text>
          ) : null}
          <Button label="Ranger le fichier (Drive, iCloud, USB…)" icon="share" variant="sun" onPress={() => void share()} style={{ marginTop: 10 }} />
        </Card>
      ) : (
        <Button label={busy ? progress || "Je prépare…" : "Créer la sauvegarde"} icon="shield" variant="sun" size="lg" loading={busy} onPress={() => void make()} />
      )}
      <Pressable accessibilityRole="button" onPress={() => void renew()} style={styles.link}>
        <Text style={styles.linkText}>Changer de clé de secours</Text>
      </Pressable>
    </>
  );
}

function Restore() {
  const db = useSQLiteContext();
  const [picked, setPicked] = useState<{ uri: string; name: string; header: BackupHeader } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const problem = typed.replace(/[\s-]/g, "").length >= 30 ? recoveryCodeProblem(typed) : null;

  const pick = async () => {
    setError(null);
    const res = await withLockSuspended(() => DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true }));
    if (res.canceled) return;
    const a = res.assets[0];
    try {
      setPicked({ uri: a.uri, name: a.name, header: await peekBackup(a.uri) });
    } catch (e) {
      setPicked(null);
      setError(errorText(e));
    }
  };

  const run = async () => {
    if (!picked) return;
    const p = recoveryCodeProblem(typed);
    if (p) {
      setError(p);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReport(await restoreBackup(db, picked.uri, typed, (d, t) => setProgress(t ? Math.round((100 * d) / t) : 0)));
      try {
        new File(picked.uri).delete();
      } catch {
        // copie temporaire déjà partie
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    const s = (n: number) => (n > 1 ? "s" : "");
    const said =
      (report.added
        ? `${report.added} papier${s(report.added)} ajouté${s(report.added)} (${report.pages} page${s(report.pages)}).`
        : "Tout était déjà sur ce téléphone : rien à ajouter.") +
      (report.skipped ? ` ${report.skipped} déjà présent${s(report.skipped)}, laissé${s(report.skipped)} tel${s(report.skipped)} quel${s(report.skipped)}.` : "");
    return (
      <>
        <SpeechBubble mood={report.added ? "party" : "happy"}>{said}</SpeechBubble>
        <Button label="Voir mes papiers" icon="home" variant="sun" size="lg" onPress={() => router.replace("/")} />
      </>
    );
  }

  return (
    <>
      <Text style={txt.body}>Choisis ton fichier « .paperasse » (sauvegarde ou kit d’urgence), puis tape la clé de secours. Les papiers s’ajoutent : rien n’est effacé.</Text>
      <Button label={picked ? "Choisir un autre fichier" : "Choisir le fichier"} icon="folder" variant={picked ? "secondary" : "sun"} onPress={() => void pick()} />
      {picked ? (
        <Card flat>
          <Text style={txt.strong}>{picked.header.type === "kit" ? "Kit d’urgence" : "Sauvegarde"} du {formatDate(picked.header.cree.slice(0, 10))}</Text>
          <Text style={txt.small} numberOfLines={1}>
            {picked.name}
          </Text>
        </Card>
      ) : null}
      {picked ? (
        <>
          <SectionTitle>Clé de secours</SectionTitle>
          <TextInput
            value={typed}
            onChangeText={(t) => {
              setTyped(t);
              setError(null);
            }}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            importantForAutofill="no"
            style={styles.input}
            accessibilityLabel="Clé de secours"
          />
          {problem ? <Text style={[txt.small, { color: tones.red.fg }]}>{problem}</Text> : null}
          <Button
            label={busy ? `Je restaure… ${progress} %` : "Restaurer"}
            icon="refresh"
            variant="sun"
            size="lg"
            loading={busy}
            disabled={typed.replace(/[\s-]/g, "").length < 30}
            onPress={() => void run()}
          />
        </>
      ) : null}
      {error ? (
        <Card tone="red" flat>
          <Text style={[txt.body, { color: tones.red.fg }]}>{error}</Text>
        </Card>
      ) : null}
    </>
  );
}

const PRESELECT = new Set(["identite", "sante", "banque", "famille", "logement"]);

function Kit() {
  const db = useSQLiteContext();
  const dialog = useDialog();
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [forName, setForName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ code: string; file: File; sheet: File; papers: number } | null>(null);

  useEffect(() => {
    void listAll(db).then((all) => {
      setDocs(all);
      setChosen(new Set(all.filter((d) => d.isFavorite || PRESELECT.has(d.category)).map((d) => d.id)));
    });
    void listPeople(db).then(setPeople);
  }, [db]);

  const titles = useMemo(() => (docs ?? []).filter((d) => chosen.has(d.id)).map((d) => d.title), [docs, chosen]);

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
      const code = kitCode();
      const r = await writeBackup(db, { type: "kit", code, docIds: [...chosen] });
      const sheet = await writeSheet({
        type: "kit",
        code,
        date: new Date().toISOString().slice(0, 10),
        fileName: r.file.name,
        papers: titles,
        forName: forName.trim() || undefined,
        message: message.trim() || undefined,
      });
      setMade({ code, file: r.file, sheet, papers: r.papers });
    } catch (e) {
      await dialog.alert({ title: "Kit impossible", message: errorText(e), mood: "worried" });
    } finally {
      setBusy(false);
    }
  };

  const send = async (f: File, mime: string, t: string) => {
    try {
      await shareFile(f, mime, t);
    } catch (e) {
      await dialog.alert({ title: "Partage impossible", message: errorText(e), mood: "worried" });
    }
  };

  if (made) {
    return (
      <>
        <SpeechBubble mood="party">
          Kit prêt : {made.papers} papier{made.papers > 1 ? "s" : ""}. Donne le fichier et la fiche séparément, par exemple le fichier par mail
          et la fiche imprimée en main propre.
        </SpeechBubble>
        <SectionTitle>Clé de ce kit</SectionTitle>
        <CodeBox code={made.code} />
        <Text style={txt.small}>Elle est aussi sur la fiche. Elle n’est gardée nulle part ailleurs.</Text>
        <Button label="Envoyer le fichier du kit" icon="share" variant="sun" onPress={() => void send(made.file, "application/octet-stream", "Kit d’urgence Paperasse")} />
        <Button label="Imprimer ou envoyer la fiche" icon="file" variant="secondary" onPress={() => void send(made.sheet, "application/pdf", "Fiche du kit d’urgence")} />
      </>
    );
  }

  return (
    <>
      <SpeechBubble mood="happy">
        Prépare un dossier chiffré pour une personne de confiance : si un jour tu as besoin d’aide, ou si quelque chose t’arrive, elle pourra
        ouvrir ces papiers avec Paperasse et la clé de la fiche.
      </SpeechBubble>
      <TextInput value={forName} onChangeText={setForName} placeholder="Pour qui ? (facultatif)" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Pour qui" />
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Un mot pour cette personne (facultatif)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        multiline
        accessibilityLabel="Un mot pour cette personne"
      />
      <SectionTitle>{`Papiers du kit (${chosen.size})`}</SectionTitle>
      {people.length > 0 && docs ? (
        <>
          <Text style={txt.small}>Prendre tous les papiers de :</Text>
          <WhoPills
            people={people}
            value={"aucun"}
            onChange={(w) => setChosen(new Set(docs.filter((d) => belongsTo(d.personId, w)).map((d) => d.id)))}
          />
        </>
      ) : null}
      {docs === null ? null : docs.length === 0 ? (
        <Text style={txt.body}>Aucun papier pour l’instant.</Text>
      ) : (
        <Card flat>
          {docs.map((d) => {
            const on = chosen.has(d.id);
            return (
              <Pressable key={d.id} onPress={() => toggle(d.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.row}>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={16} strokeWidth={3} /> : null}</View>
                <Text style={[txt.body, { flex: 1 }]} numberOfLines={1}>
                  {d.title}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      )}
      <Button label="Créer le kit" icon="shield" variant="sun" size="lg" loading={busy} disabled={chosen.size === 0} onPress={() => void make()} />
    </>
  );
}

const styles = StyleSheet.create({
  codeBox: { borderWidth: border, borderColor: colors.orange, borderRadius: 16, padding: 14, backgroundColor: colors.card },
  code: { fontFamily: "monospace", fontSize: 18, color: colors.ink, textAlign: "center", letterSpacing: 1 },
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
  link: { alignSelf: "center", paddingVertical: 10 },
  linkText: { fontFamily: fonts.bodyStrong, fontSize: 15, color: colors.muted, textDecorationLine: "underline" },
});
