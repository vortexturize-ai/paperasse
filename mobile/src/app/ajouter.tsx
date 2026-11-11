import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, usePreventRemove } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../components/Dialog";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { border, colors, fonts, pop } from "../components/theme";
import { Button, Card, Pill, SpeechBubble, txt } from "../components/ui";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "../lib/categories";
import { getDocument, getSetting } from "../lib/db";
import { feedback } from "../lib/feedback";
import { createDocument, removeDocument } from "../lib/documents";
import { duplicateText, findDuplicate } from "../lib/duplicates";
import { PROBLEM_TEXT } from "../engine/scan";
import { discardPages, discardTemp, prepareImage, preparePdf } from "../lib/files";
import { inspectPhoto, prepareScan, prepareSystemScanPage, systemScan } from "../lib/scanner";
import { withLockSuspended } from "../lib/lock";
import { canReadImages } from "../lib/ocr";
import type { PendingPage } from "../lib/types";
import { Tap } from "../components/Tap";

const MAX_PAGES = 10;
const MAX_TEXT = 50_000;

function SourceTile({
  label,
  icon,
  color,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: color }, pop(4), pressed && styles.pressed, disabled && styles.off]}
    >
      <Icon name={icon} size={26} strokeWidth={2.3} />
      <Text style={[txt.strong, styles.tileLabel]}>{label}</Text>
    </Tap>
  );
}

export default function AddDocument() {
  const db = useSQLiteContext();
  const dialog = useDialog();
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("autre");
  const [language, setLanguage] = useState("français");
  const [busy, setBusy] = useState<null | "photo" | "save">(null);

  useEffect(() => {
    void getSetting(db, "language").then((l) => l && setLanguage(l));
  }, [db]);

  const room = MAX_PAGES - pages.length;
  const full = room === 0 || busy !== null;
  const hasText = text.trim().length > 0;
  // Les PDF sont lus partout (lecteur maison) ; les photos seulement là où la lecture du téléphone existe.
  const readable = hasText || pages.some((p) => p.mime === "application/pdf") || (canReadImages && pages.some((p) => p.mime.startsWith("image/")));
  const needsManual = pages.length > 0 && !readable;

  const addPages = (more: PendingPage[]) => setPages((p) => [...p, ...more].slice(0, MAX_PAGES));

  // Photo classique + nos vérifications : marche partout, même hors connexion.
  const takePhoto = () => takePlainPhoto();

  // Scanner du téléphone (bords trouvés, page redressée, plusieurs pages) : en plus, car il dépend des services
  // Google (téléchargés au premier usage) et peut manquer, hors connexion par exemple.
  const scanPages = async () => {
    const scan = await systemScan();
    if (scan.pages.length) {
      setBusy("photo");
      try {
        const shots: PendingPage[] = [];
        for (const uri of scan.pages.slice(0, room)) {
          shots.push(await prepareSystemScanPage(uri));
          discardTemp(uri);
        }
        for (const uri of scan.pages.slice(room)) discardTemp(uri);
        addPages(shots);
      } finally {
        setBusy(null);
      }
    } else if (scan.unavailable)
      await dialog.alert({
        title: "Scanner indisponible",
        message: "Le scanner automatique n’est pas disponible sur ce téléphone pour l’instant. Prends le papier en photo : je vérifie la photo et je recadre.",
        mood: "worried",
      });
  };

  const takePlainPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      await dialog.alert({ title: "Appareil photo refusé", message: "Autorise l’appareil photo dans les réglages du téléphone.", mood: "worried" });
      return;
    }
    const res = await withLockSuspended(() => ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }));
    if (res.canceled) return;
    setBusy("photo");
    let retake = false;
    try {
      const shots: PendingPage[] = [];
      for (const a of res.assets) {
        // Scanner intelligent : photo floue, sombre ou avec reflet → on propose de la reprendre ; feuille recadrée.
        const check = await inspectPhoto(a.uri);
        if (check?.problems.length) {
          setBusy(null);
          retake = await dialog.confirm({
            title: "Photo à refaire ?",
            message: check.problems.map((p) => PROBLEM_TEXT[p]).join("\n"),
            confirmLabel: "Reprendre la photo",
            cancelLabel: "Garder",
          });
          setBusy("photo");
          if (retake) {
            discardTemp(a.uri);
            break;
          }
        }
        try {
          shots.push(check ? await prepareScan(a.uri, check.box) : await prepareImage(a.uri, a.width, a.height));
        } finally {
          // La photo pleine taille de l'appareil ne reste pas dans le cache : seule la copie réduite est gardée.
          discardTemp(a.uri);
        }
      }
      addPages(shots);
    } finally {
      setBusy(null);
    }
    if (retake) await takePlainPhoto();
  };

  const pickPhotos = async () => {
    const res = await withLockSuspended(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 1 }),
    );
    if (res.canceled) return;
    setBusy("photo");
    try {
      // Photos de la galerie : recadrées sur la feuille si on la voit nettement, sans autre question.
      const shots: PendingPage[] = [];
      for (const a of res.assets) {
        try {
          const check = await inspectPhoto(a.uri);
          shots.push(check?.box ? await prepareScan(a.uri, check.box) : await prepareImage(a.uri, a.width, a.height));
        } finally {
          discardTemp(a.uri); // copie faite par le sélecteur, jamais la photo de la galerie elle-même
        }
      }
      addPages(shots);
    } finally {
      setBusy(null);
    }
  };

  const pickPdf = async () => {
    const res = await withLockSuspended(() => DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true }));
    if (res.canceled) return;
    try {
      addPages(res.assets.map((a) => preparePdf(a.uri, a.name, a.size)));
    } catch (e) {
      await dialog.alert({ title: "PDF refusé", message: e instanceof Error ? e.message : "Fichier illisible.", mood: "worried" });
    }
  };

  const pasteFromClipboard = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip.trim()) setText(clip.slice(0, MAX_TEXT));
    else await dialog.alert({ title: "Rien à coller", message: "Copie d’abord le texte du courriel ou du SMS.", mood: "sleepy" });
  };

  // Retour Android, geste ou croix : on demande avant de perdre les pages prises.
  const [leaving, setLeaving] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  usePreventRemove((pages.length > 0 || hasText) && busy === null && !leaving, ({ repeat }) => {
    void dialog
      .confirm({
        title: "Abandonner ce papier ?",
        message: "Les pages prises et le texte collé seront perdus.",
        confirmLabel: "Oui, abandonner",
        cancelLabel: "Non, continuer",
        danger: true,
        mood: "worried",
      })
      .then((leave) => {
        if (leave) {
          discardPages(pages); // copies temporaires : rien ne reste dans le cache
          pendingLeave.current = repeat;
          setLeaving(true);
        }
      });
  });
  useEffect(() => {
    if (leaving && pendingLeave.current) {
      const go = pendingLeave.current;
      pendingLeave.current = null;
      go();
    }
  }, [leaving]);

  const save = async () => {
    setBusy("save");
    try {
      const { id, analysisError } = await createDocument(db, pages, {
        read: readable,
        language,
        text: hasText ? text : undefined,
        title: needsManual ? title : undefined,
        category: needsManual ? category : undefined,
      });
      // Déjà dans le coffre ? On propose de garder l'ancien (le nouveau est retiré) ou les deux.
      const dup = await findDuplicate(db, id).catch(() => null);
      if (dup) {
        const choice = await dialog.show({
          ...duplicateText(dup),
          mood: "reading",
          buttons: [
            { label: "Garder l’ancien", variant: "sun" },
            { label: "Garder les deux", variant: "secondary" },
          ],
        });
        const added = choice === 0 ? await getDocument(db, id) : null;
        if (added) {
          await removeDocument(db, added);
          router.replace(`/document/${dup.doc.id}`);
          return;
        }
      }
      if (analysisError) {
        await dialog.alert({
          title: "Je n’ai pas pu lire ce papier",
          message: `${analysisError}\n\nIl est bien rangé : tu peux le renommer et choisir son dossier.`,
          mood: "worried",
        });
      } else feedback("success");
      router.replace(`/document/${id}`);
    } catch (e) {
      await dialog.alert({ title: "Enregistrement impossible", message: e instanceof Error ? e.message : "Erreur inconnue.", mood: "worried" });
      setBusy(null);
    }
  };

  return (
    <Screen title="Ajouter un papier" onClose={() => router.back()}>
      <SpeechBubble mood={busy !== null ? "reading" : "happy"}>
        {busy === "save"
          ? "Je lis ton papier…"
          : busy === "photo"
            ? "Je prépare tes pages…"
            : pasting
            ? "Colle le texte d’un courriel, d’un SMS ou d’une lettre : je le lis tout de suite."
            : "Prends ta lettre en photo, je m’occupe du reste !"}
      </SpeechBubble>

      <Tap
        accessibilityRole="button"
        accessibilityLabel="Prendre en photo"
        accessibilityState={{ disabled: full }}
        disabled={full}
        onPress={() => void takePhoto()}
        style={({ pressed }) => [styles.photo, pop(5), pressed && styles.pressed, full && styles.off]}
      >
        <View style={styles.photoIcon}>
          <Icon name="camera" size={30} strokeWidth={2.3} />
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[txt.h2, { fontSize: 22 }]}>Prendre en photo</Text>
          <Text style={[txt.strong, { fontSize: 14, color: "#3D2300" }]}>Une photo par page</Text>
        </View>
      </Tap>

      <View style={styles.grid}>
        <SourceTile label="Mes photos" icon="image" color={colors.sky} onPress={() => void pickPhotos()} disabled={full} />
        <SourceTile label="Un PDF" icon="file" color={colors.lilac} onPress={() => void pickPdf()} disabled={full} />
        <SourceTile label="Coller un texte" icon="text" color="#B8EBC2" onPress={() => setPasting((p) => !p)} disabled={busy !== null} />
      </View>
      {Platform.OS !== "web" ? (
        <Button label="Scanner automatique (bords redressés)" icon="camera" variant="secondary" size="sm" disabled={full} onPress={() => void scanPages()} />
      ) : null}
      <Button
        label="Plusieurs fichiers ou un ZIP"
        icon="folder"
        variant="secondary"
        size="sm"
        disabled={busy !== null}
        onPress={() => router.replace({ pathname: "/recevoir", params: { source: "fichiers" } })}
      />

      {pasting ? (
        <Card flat>
          <View style={styles.rowBetween}>
            <Text style={[txt.strong, styles.flex]}>Texte du papier</Text>
            <Button label="Coller" icon="copy" variant="info" size="sm" onPress={() => void pasteFromClipboard()} />
          </View>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_TEXT))}
            placeholder="Colle ou écris le texte ici…"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.textArea}
            accessibilityLabel="Texte du papier"
          />
        </Card>
      ) : null}

      {pages.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={txt.small}>
            Pages ajoutées ({pages.length}/{MAX_PAGES})
          </Text>
          <ScrollView horizontal contentContainerStyle={styles.thumbs} showsHorizontalScrollIndicator={false}>
            {pages.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={[styles.thumb, pop(3)]}>
                {p.mime === "application/pdf" ? (
                  <View style={styles.pdf}>
                    <Icon name="file" size={28} />
                    <Text style={[txt.small, { fontSize: 11, textAlign: "center" }]} numberOfLines={2}>
                      {p.name}
                    </Text>
                  </View>
                ) : (
                  <Image source={{ uri: p.uri }} style={styles.thumbImage} accessibilityLabel={`Page ${i + 1}`} />
                )}
                <View style={styles.pageNumber}>
                  <Text style={[txt.strong, { fontSize: 12, lineHeight: 15 }]}>{i + 1}</Text>
                </View>
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer la page ${i + 1}`}
                  onPress={() => {
                    discardTemp(p.uri);
                    setPages((all) => all.filter((_, j) => j !== i));
                  }}
                  style={styles.remove}
                  hitSlop={10}
                >
                  <Icon name="close" size={14} color="#FFFFFF" strokeWidth={3} />
                </Tap>
              </View>
            ))}
            {room > 0 ? (
              <Tap accessibilityRole="button" accessibilityLabel="Ajouter une page" onPress={() => void takePhoto()} style={styles.addPage}>
                <Icon name="plus" size={24} strokeWidth={2.8} />
              </Tap>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {needsManual ? (
        <Card flat>
          <Text style={txt.small}>
            Ici, les photos ne sont pas lues. Donne un nom et un dossier :
          </Text>
          <Text style={txt.strong}>Nom du papier</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. Carte d’identité recto verso"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={txt.strong}>Dossier</Text>
          <View style={styles.pills}>
            {CATEGORY_KEYS.map((k) => (
              <Pill key={k} label={CATEGORIES[k].label} icon={CATEGORIES[k].icon} selected={k === category} onPress={() => setCategory(k)} />
            ))}
          </View>
        </Card>
      ) : null}

      <Button
        label="C’est parti !"
        variant="sun"
        size="lg"
        onPress={() => void save()}
        disabled={(pages.length === 0 && !hasText) || busy === "photo"}
        loading={busy === "save"}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ translateY: 2 }] },
  off: { opacity: 0.5 },
  photo: {
    minHeight: 100,
    borderRadius: 24,
    borderWidth: border,
    borderColor: colors.ink,
    backgroundColor: colors.orange,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
  },
  photoIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    height: 92,
    borderRadius: 22,
    borderWidth: border,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  tileLabel: { textAlign: "center" },
  flex: { flex: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  textArea: {
    minHeight: 150,
    maxHeight: 320,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
  thumbs: { gap: 14, paddingVertical: 6, paddingLeft: 8 },
  thumb: { width: 70, height: 94, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card },
  thumbImage: { width: "100%", height: "100%", borderRadius: 9 },
  pdf: { flex: 1, alignItems: "center", justifyContent: "center", padding: 4, gap: 4 },
  pageNumber: {
    position: "absolute",
    left: -8,
    bottom: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.sun,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    position: "absolute",
    right: -8,
    top: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  addPage: {
    width: 70,
    height: 94,
    borderRadius: 12,
    borderWidth: 2.5,
    borderStyle: "dashed",
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
