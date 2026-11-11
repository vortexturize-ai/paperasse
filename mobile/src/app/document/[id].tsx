import { goBack } from "../../lib/nav";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DocInsights, ScamBanner } from "../../components/DocInsights";
import { useDialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { border, colors, fonts, pop, tones } from "../../components/theme";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconTile,
  Pill,
  SectionTitle,
  SpeechBubble,
  deadlineChip,
  txt,
} from "../../components/ui";
import { CATEGORIES, CATEGORY_KEYS, URGENCY, categoryOf, docTypeLabel, type Category } from "../../lib/categories";
import { getDocument, getFiles, getSetting, listPeople, setDocumentPerson, updateDocument } from "../../lib/db";
import { WhoPills } from "../../components/WhoPills";
import { rememberCategory, removeDocument, runAnalysis, setDone } from "../../lib/documents";
import { openPreview, uriFor } from "../../lib/files";
import { withLockSuspended } from "../../lib/lock";
import { canReadImages } from "../../lib/ocr";
import { calendarParts, capitalize, daysUntil, formatAmount, formatDate, relativeDays, todayIso } from "../../lib/text";
import { useFocusData } from "../../lib/useFocusData";
import { langFromName } from "../../engine/i18n";
import { essentials, speechText, type EasyInput } from "../../engine/easyRead";
import { detectScam } from "../../engine/scam";
import { isSensitivePaper } from "../../engine/sensitive";
import { EasyCard, ListenButton } from "../../components/Listen";
import { useNoScreenshots } from "../../lib/privacyScreen";

const STEP_COLORS = [colors.orange, "#38B6FF", colors.green, colors.sun, colors.lilac];

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const dialog = useDialog();
  const load = useCallback(
    async (database: SQLiteDatabase) => ({
      doc: await getDocument(database, id),
      files: await getFiles(database, id),
      easy: (await getSetting(database, "easy_read")) === "1",
      people: await listPeople(database),
      lang: langFromName(await getSetting(database, "language")),
    }),
    [id],
  );
  const { data, reload } = useFocusData(load);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("autre");
  const [showText, setShowText] = useState(false);
  const loadedDoc = data?.doc ?? null;
  const sensitive = useMemo(() => (loadedDoc ? isSensitivePaper(loadedDoc) : false), [loadedDoc]);
  useNoScreenshots(sensitive, `papier-${id}`);
  const easyLang = data?.lang ?? "fr";
  const easy = useMemo(() => {
    if (!loadedDoc || loadedDoc.analysisStatus !== "done") return null;
    const input: EasyInput = {
      kind: docTypeLabel(loadedDoc.docType),
      issuer: loadedDoc.issuer,
      summary: loadedDoc.summary,
      actions: loadedDoc.actions,
      toDo: loadedDoc.toDo,
      isDone: loadedDoc.isDone,
      amount: loadedDoc.amount,
      amountDirection: loadedDoc.amountDirection,
      deadline: loadedDoc.deadline,
      expiry: loadedDoc.expiryDate,
      scam: loadedDoc.fullText ? detectScam(loadedDoc.fullText).level === "arnaque_probable" : false,
    };
    return { lines: essentials(input, easyLang, todayIso()), speech: speechText(input, easyLang, todayIso()) };
  }, [loadedDoc, easyLang]);

  if (!data) return null;
  const { doc, files } = data;
  if (!doc) {
    return (
      <Screen onBack={goBack}>
        <EmptyState title="Ce papier n’existe plus" />
      </Screen>
    );
  }

  const cat = CATEGORIES[categoryOf(doc.category)];
  const analyzed = doc.analysisStatus === "done";
  const late = doc.deadline !== null && daysUntil(doc.deadline) < 0 && !doc.isDone;
  // On peut (re)lire si les photos sont lisibles ici, ou si le texte est déjà connu (texte collé, lecture précédente).
  const canRead = Boolean(doc.fullText?.trim()) || (canReadImages && files.some((f) => f.mime.startsWith("image/")));
  // Explication en arabe : texte aligné à droite et lu de droite à gauche.
  const textDir = langFromName(doc.analysisLang) === "ar" ? styles.rtl : null;

  const analyzeNow = async () => {
    setAnalyzing(true);
    try {
      await runAnalysis(db, doc.id, (await getSetting(db, "language")) ?? "français");
    } catch (e) {
      await dialog.alert({ title: "Je n’ai pas pu lire ce papier", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
    } finally {
      setAnalyzing(false);
      await reload();
    }
  };

  const toggleDone = async () => {
    const done = !doc.isDone;
    await setDone(db, doc, done);
    await reload();
    if (done) await dialog.alert({ title: "Bravo !", message: "Un papier de moins à gérer. J’ai arrêté ses rappels.", mood: "party", okLabel: "Super" });
  };

  const share = async () => {
    if (files.length === 0) return;
    if (!(await Sharing.isAvailableAsync())) {
      await dialog.alert({ title: "Partage indisponible sur ce téléphone.", mood: "worried" });
      return;
    }
    const first = files[0];
    await withLockSuspended(() => Sharing.shareAsync(uriFor(first.path), { mimeType: first.mime, dialogTitle: doc.title }));
  };

  const startEdit = () => {
    setEditTitle(doc.title);
    setEditCategory(categoryOf(doc.category));
    setEditing(true);
  };

  const saveEdit = async () => {
    await rememberCategory(db, doc, editCategory);
    await updateDocument(db, doc.id, { title: editTitle.trim() || doc.title, category: editCategory });
    setEditing(false);
    await reload();
  };

  const confirmDelete = async () => {
    const ok = await dialog.confirm({
      title: "Supprimer ce papier ?",
      message: "Les pages et la fiche seront effacées de ce téléphone. Impossible d’annuler.",
      confirmLabel: "Supprimer",
      danger: true,
      mood: "worried",
    });
    if (!ok) return;
    await removeDocument(db, doc);
    goBack();
  };

  return (
    <Screen title={docTypeLabel(doc.docType)} onBack={goBack}>
      {editing ? (
        <Card>
          <Text style={txt.strong}>Nom</Text>
          <TextInput value={editTitle} onChangeText={setEditTitle} style={styles.input} accessibilityLabel="Nom du papier" />
          <Text style={txt.strong}>Dossier</Text>
          <View style={styles.pills}>
            {CATEGORY_KEYS.map((k) => (
              <Pill
                key={k}
                label={CATEGORIES[k].label}
                icon={CATEGORIES[k].icon}
                selected={k === editCategory}
                onPress={() => setEditCategory(k)}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Button label="Annuler" variant="secondary" size="sm" onPress={() => setEditing(false)} style={styles.flex} />
            <Button label="Enregistrer" variant="sun" size="sm" onPress={() => void saveEdit()} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <Card tone={cat.tone}>
          <View style={styles.headTop}>
            <IconTile icon={cat.icon} tone="neutral" size={52} />
            {doc.toDo && !doc.isDone && doc.urgency === "haute" ? (
              <View style={styles.urgent}>
                <Text style={styles.urgentText}>URGENT</Text>
              </View>
            ) : doc.toDo && !doc.isDone ? (
              <Chip label={URGENCY[doc.urgency].label} tone={URGENCY[doc.urgency].tone} />
            ) : doc.toDo ? (
              <Chip label="C'est fait" tone="green" icon="check" />
            ) : null}
          </View>
          <Text style={txt.h1}>{doc.title}</Text>
          <Text style={[txt.small, { color: "#4A4361" }]}>
            {[doc.issuer, doc.docDate ? `du ${formatDate(doc.docDate)}` : null, `dossier ${cat.label}`]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Card>
      )}

      {files.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={txt.small}>
            {files.length > 1 ? `Les ${files.length} pages` : "La page"}
          </Text>
          <ScrollView horizontal contentContainerStyle={styles.pages} showsHorizontalScrollIndicator={false}>
            {files.map((f, i) => (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir la page ${i + 1}`}
                onPress={() => void withLockSuspended(() => openPreview(f.path)).catch(() => undefined)}
                style={[styles.page, pop(3)]}
              >
                {f.mime === "application/pdf" ? (
                  <View style={styles.pdf}>
                    <Icon name="file" size={30} />
                    <Text style={[txt.small, { fontSize: 12 }]}>Ouvrir</Text>
                  </View>
                ) : (
                  <Image source={{ uri: uriFor(f.path) }} style={styles.pageImage} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!analyzed ? (
        <Card>
          <SpeechBubble mascotSize={54} mood={doc.analysisStatus === "error" ? "worried" : "sleepy"}>
            {doc.analysisStatus === "error" ? "Je n’ai pas réussi à lire ce papier." : "Je n’ai pas encore lu ce papier."}
          </SpeechBubble>
          {canRead ? (
            <Button label="Lire maintenant" icon="refresh" variant="sun" onPress={() => void analyzeNow()} loading={analyzing} />
          ) : null}
        </Card>
      ) : null}

      {doc.warning ? (
        <Card tone="yellow" flat>
          <View style={styles.row}>
            <Icon name="warning" size={22} color={tones.yellow.fg} />
            <Text style={[txt.body, styles.flex, { color: tones.yellow.fg }]}>{doc.warning}</Text>
          </View>
        </Card>
      ) : null}

      {easy && data.easy ? <EasyCard lines={easy.lines} speech={easy.speech} lang={easyLang} /> : null}

      {analyzed ? <ScamBanner text={doc.fullText} /> : null}

      {doc.summary ? (
        <SpeechBubble title="En bref">
          <Text style={[txt.strong, textDir]}>{doc.summary}</Text>
        </SpeechBubble>
      ) : null}
      {easy && !data.easy ? <ListenButton text={easy.speech} lang={easyLang} /> : null}

      {doc.deadline ? (
        <Card tone={late ? "red" : "orange"}>
          <View style={styles.deadline}>
            <View style={styles.calendar}>
              <Text style={styles.calendarMonth}>{calendarParts(doc.deadline).month}</Text>
              <Text style={styles.calendarDay}>{calendarParts(doc.deadline).day}</Text>
            </View>
            <View style={[styles.flex, { gap: 6 }]}>
              <Text style={txt.h3}>
                {doc.deadlineLabel ? capitalize(doc.deadlineLabel) : "Date limite"} avant le {formatDate(doc.deadline)}
              </Text>
              {!doc.isDone ? <Chip {...deadlineChip(doc.deadline)} icon="clock" onTint /> : null}
            </View>
          </View>
          {doc.deadlineQuote ? (
            <>
              <Text style={[txt.small, styles.quote]}>« {doc.deadlineQuote} »</Text>
              <Text style={[txt.small, { color: "#6B3A00" }]}>Vérifie cette phrase sur ta lettre.</Text>
            </>
          ) : null}
        </Card>
      ) : doc.deadlineQuote ? (
        <Card tone="orange">
          <Text style={txt.h3}>Délai à calculer</Text>
          <Text style={[txt.small, styles.quote]}>« {doc.deadlineQuote} »</Text>
        </Card>
      ) : null}

      {doc.actions.length > 0 ? (
        <>
          <SectionTitle>Ce que tu dois faire</SectionTitle>
          <Card>
            {doc.actions.map((a, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: STEP_COLORS[i % STEP_COLORS.length] }]}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={[txt.body, styles.flex, { paddingTop: 5 }, textDir]}>{a}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {doc.toDo ? (
        doc.isDone ? (
          <Button label="Remettre dans « À faire »" variant="secondary" onPress={() => void toggleDone()} />
        ) : (
          <Button label="C’est fait !" icon="check" variant="success" size="lg" onPress={() => void toggleDone()} />
        )
      ) : null}

      {doc.amount !== null ? (
        <Card flat>
          <View style={styles.row}>
            <IconTile icon="euro" tone={doc.amountDirection === "a_recevoir" ? "green" : "orange"} size={40} />
            <Text style={[txt.h3, styles.flex]}>
              {formatAmount(doc.amount)}
              {doc.amountDirection === "a_payer" ? " à payer" : doc.amountDirection === "a_recevoir" ? " à recevoir" : ""}
            </Text>
          </View>
        </Card>
      ) : null}

      {doc.expiryDate ? (
        <Card tone="blue" flat>
          <View style={styles.row}>
            <Icon name="calendar" size={24} color={tones.blue.fg} />
            <View style={[styles.flex, { gap: 2 }]}>
              <Text style={[txt.h3, { color: tones.blue.fg }]}>Valable jusqu’au {formatDate(doc.expiryDate)}</Text>
              <Text style={[txt.small, { color: tones.blue.fg }]}>
                Expire {relativeDays(doc.expiryDate)}. Je te préviens 60 et 30 jours avant.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {doc.keyFacts.length > 0 ? (
        <Card flat>
          <Text style={txt.h3}>Infos utiles</Text>
          {doc.keyFacts.map((k, i) => (
            <View key={i} style={styles.fact}>
              <Text style={[txt.small, styles.flex]}>{k.label}</Text>
              <Text style={[txt.strong, styles.factValue]} selectable>
                {k.valeur}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {data.people.length > 0 ? (
        <>
          <SectionTitle>Papier de</SectionTitle>
          <WhoPills
            people={data.people}
            value={doc.personId ?? "moi"}
            onChange={async (w) => {
              await setDocumentPerson(db, doc.id, w === "moi" || w === "tous" ? null : w);
              await reload();
            }}
          />
        </>
      ) : null}

      {analyzed ? <DocInsights doc={doc} lang={langFromName(doc.analysisLang)} /> : null}

      {files.some((f) => f.mime.startsWith("image/")) ? (
        <Button
          label="Vérifier le code 2D-Doc"
          icon="shield"
          variant="secondary"
          onPress={() => router.push({ pathname: "/deuxdoc", params: { doc: doc.id } })}
        />
      ) : null}

      {doc.fullText ? (
        <Pressable onPress={() => setShowText((s) => !s)} accessibilityRole="button" accessibilityState={{ expanded: showText }}>
          <Card flat>
            <View style={styles.row}>
              <Icon name="text" size={20} />
              <Text style={[txt.h3, styles.flex]}>Texte du papier</Text>
              <Text style={txt.small}>{showText ? "Cacher" : "Voir"}</Text>
            </View>
            {showText ? (
              <Text style={txt.body} selectable>
                {doc.fullText}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      <View style={{ gap: 12, marginTop: 4 }}>
        {analyzed ? (
          <Button label="Écrire une réponse" icon="pencil" variant="secondary" onPress={() => router.push(`/reponse/${doc.id}`)} />
        ) : null}
        <View style={styles.row}>
          <Button label="Partager" icon="share" variant="info" size="sm" onPress={() => void share()} style={styles.flex} />
          <Button label="Supprimer" icon="trash" variant="danger" size="sm" onPress={() => void confirmDelete()} style={styles.flex} />
        </View>
        {!editing ? <Button label="Renommer ou changer de dossier" variant="secondary" size="sm" onPress={startEdit} /> : null}
        {analyzed && canRead ? (
          <Button label="Relire le papier" icon="refresh" variant="secondary" size="sm" onPress={() => void analyzeNow()} loading={analyzing} />
        ) : null}
      </View>
      <Text style={[txt.small, { textAlign: "center" }]}>
        Lu et expliqué sur ton téléphone. Vérifie toujours les dates et les montants sur le papier.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  headTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  urgent: {
    backgroundColor: colors.red,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  urgentText: { fontFamily: fonts.bodyStrong, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.5 },
  pages: { gap: 12, paddingVertical: 4 },
  page: {
    width: 76,
    height: 100,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  pageImage: { width: "100%", height: "100%" },
  pdf: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  deadline: { flexDirection: "row", alignItems: "center", gap: 14 },
  calendar: {
    width: 70,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    overflow: "hidden",
    alignItems: "stretch",
  },
  calendarMonth: {
    backgroundColor: colors.red,
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: fonts.bodyStrong,
    fontSize: 13,
    paddingVertical: 3,
    letterSpacing: 1,
  },
  calendarDay: { textAlign: "center", fontFamily: fonts.titleBold, fontSize: 32, lineHeight: 44, color: colors.ink },
  quote: { fontStyle: "italic", color: "#6B3A00" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: fonts.titleBold, fontSize: 17, color: colors.ink },
  fact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  factValue: { flexShrink: 1, textAlign: "right" },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: border - 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
});
