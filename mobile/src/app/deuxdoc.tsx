import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { border, colors, fonts, tones } from "../components/theme";
import { Button, Card, Chip, SectionTitle, SpeechBubble, txt } from "../components/ui";
import { crossCheck, parse2DDoc, type TwoDDoc } from "../engine/twoDDoc";
import { getDocument, getFiles } from "../lib/db";
import { uriFor } from "../lib/files";
import { goBack } from "../lib/nav";
import { useNoScreenshots } from "../lib/privacyScreen";
import { formatDate } from "../lib/text";

type Phase = "searching" | "notFound" | "camera" | "result";

export default function TwoDDocScreen() {
  const { doc: docId } = useLocalSearchParams<{ doc?: string }>();
  const db = useSQLiteContext();
  const [phase, setPhase] = useState<Phase>(docId ? "searching" : "camera");
  const [code, setCode] = useState<TwoDDoc | null>(null);
  const [paperText, setPaperText] = useState<string | null>(null);
  const [notTwoD, setNotTwoD] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  useNoScreenshots(true, "deuxdoc");

  // Sur les photos déjà rangées (Android : la lecture de DataMatrix dans une image n'existe pas sur iOS).
  useEffect(() => {
    if (!docId) return;
    let alive = true;
    (async () => {
      const doc = await getDocument(db, docId);
      const text = doc?.fullText ?? null;
      let found: TwoDDoc | null = null;
      if (Platform.OS === "android") {
        for (const f of await getFiles(db, docId)) {
          if (!f.mime.startsWith("image/")) continue;
          try {
            for (const r of await scanFromURLAsync(uriFor(f.path), ["datamatrix"])) {
              found = parse2DDoc(r.raw ?? r.data) ?? parse2DDoc(r.data);
              if (found) break;
            }
          } catch {
            // image illisible : on essaie la suivante
          }
          if (found) break;
        }
      }
      if (!alive) return;
      setPaperText(text);
      setCode(found);
      setPhase(found ? "result" : "notFound");
    })();
    return () => {
      alive = false;
    };
  }, [db, docId]);

  const check = useMemo(() => (code && paperText ? crossCheck(code, paperText) : null), [code, paperText]);

  const onScan = (data: string) => {
    if (handled.current) return;
    const parsed = parse2DDoc(data);
    if (!parsed) {
      setNotTwoD(true);
      return;
    }
    handled.current = true;
    setCode(parsed);
    setPhase("result");
  };

  if (phase === "searching") {
    return (
      <Screen title="Code 2D-Doc" onClose={goBack}>
        <SpeechBubble mood="reading">Je cherche le code 2D-Doc sur les photos de ton papier…</SpeechBubble>
      </Screen>
    );
  }

  if (phase === "camera" || phase === "notFound") {
    const granted = permission?.granted;
    return (
      <Screen title="Code 2D-Doc" onClose={goBack}>
        {phase === "notFound" ? (
          <SpeechBubble mood="worried">Je n’ai pas trouvé de code 2D-Doc sur les photos. Vise-le directement avec l’appareil photo.</SpeechBubble>
        ) : (
          <Text style={txt.body}>
            Le 2D-Doc est le petit carré de points (en haut ou en bas des factures, avis d’impôt, fiches de paie…). Vise-le : je lis ce qu’il
            contient et je le compare au papier.
          </Text>
        )}
        {phase === "notFound" || !granted ? (
          <Button
            label={granted ? "Viser le code avec l’appareil photo" : "Autoriser l’appareil photo"}
            icon="camera"
            variant="sun"
            onPress={async () => {
              if (!granted) {
                const r = await requestPermission();
                if (!r.granted) return;
              }
              setPhase("camera");
            }}
          />
        ) : null}
        {phase === "camera" && granted ? (
          <View style={styles.cameraBox}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["datamatrix"] }}
              onBarcodeScanned={(r) => onScan(r.raw ?? r.data)}
            />
          </View>
        ) : null}
        {notTwoD ? <Text style={[txt.small, { color: tones.orange.fg }]}>Ce code n’est pas un 2D-Doc officiel.</Text> : null}
      </Screen>
    );
  }

  if (!code) return null;
  return (
    <Screen title="Code 2D-Doc" onClose={goBack}>
      <Card>
        <Text style={txt.h3}>{code.docTypeLabel}</Text>
        <View style={styles.chips}>
          <Chip label="Code lu" tone="green" icon="check" />
          {code.issued ? <Chip label={`Émis le ${formatDate(code.issued)}`} tone="neutral" /> : null}
          {code.signed ? <Chip label={`Signé le ${formatDate(code.signed)}`} tone="neutral" /> : null}
        </View>
        <Text style={txt.small}>
          Autorité {code.authority} · certificat {code.certificate}
          {code.country ? ` · ${code.country}` : ""}
        </Text>
      </Card>

      {check && check.checked > 0 ? (
        check.missing.length === 0 ? (
          <Card tone="green" flat>
            <Text style={[txt.strong, { color: tones.green.fg }]}>
              Le papier correspond à son code : {check.checked} information{check.checked > 1 ? "s" : ""} vérifiée{check.checked > 1 ? "s" : ""}.
            </Text>
          </Card>
        ) : (
          <Card tone="red" flat>
            <Text style={[txt.strong, { color: tones.red.fg }]}>Je ne retrouve pas sur le papier :</Text>
            {check.missing.map((f) => (
              <Text key={f.id} style={[txt.body, { color: tones.red.fg }]}>
                • {f.label} : {f.value}
              </Text>
            ))}
            <Text style={[txt.small, { color: tones.red.fg }]}>
              Relis le papier : la lecture de la photo a pu se tromper. Si l’information est vraiment différente, le papier a peut-être été
              modifié ; demande l’original à l’organisme.
            </Text>
          </Card>
        )
      ) : null}

      <SectionTitle>Ce que dit le code</SectionTitle>
      <Card flat>
        {code.fields.map((f, i) => (
          <View key={`${f.id}-${i}`} style={styles.row}>
            <Text style={[txt.small, styles.label]}>{f.label}</Text>
            <Text style={[txt.strong, styles.value]}>
              {f.value}
              {f.truncated ? " (coupé)" : ""}
            </Text>
          </View>
        ))}
        {code.undecoded ? <Text style={txt.small}>Le reste de ce code n’est pas encore lu par Paperasse.</Text> : null}
      </Card>

      {code.annex.length ? (
        <>
          <SectionTitle>Annexe (non signée)</SectionTitle>
          <Card flat>
            {code.annex.map((f, i) => (
              <Text key={i} style={txt.small}>
                {f.label} : {f.value}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      <Card tone="purple" flat>
        <Text style={[txt.small, { color: tones.purple.fg }]}>
          {code.signature
            ? "Le code porte une signature électronique. Sa vérification demande de télécharger le certificat de l’organisme sur Internet : Paperasse ne le fait pas pour l’instant (tout reste sur ton téléphone). Les applications officielles listées par France Titres la vérifient."
            : "Ce code ne contient pas de signature lisible."}
        </Text>
      </Card>
      <Button label="Scanner un autre code" icon="camera" variant="secondary" onPress={() => {
        handled.current = false;
        setNotTwoD(false);
        setCode(null);
        setPaperText(null);
        setPhase("camera");
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 360, borderRadius: 20, overflow: "hidden", borderWidth: border, borderColor: colors.ink },
  camera: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 6 },
  row: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.muted },
  value: { fontFamily: fonts.bodyStrong },
});
