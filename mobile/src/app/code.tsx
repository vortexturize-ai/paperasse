import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PinPad } from "../components/PinPad";
import { Screen } from "../components/Screen";
import { colors, tones } from "../components/theme";
import { Button, Card, SpeechBubble, txt } from "../components/ui";
import { pinProblem } from "../engine/secret";
import { getSetting } from "../lib/db";
import { goBack } from "../lib/nav";
import { useNoScreenshots } from "../lib/privacyScreen";
import { useVault } from "../lib/vaultGate";

type Etape = "creer" | "changer" | "retirer" | "panique";
type Stage = "actuel" | "nouveau" | "confirmer" | "fini";

const TITLES: Record<Etape, string> = {
  creer: "Code secret",
  changer: "Changer le code",
  retirer: "Retirer le code",
  panique: "Code panique",
};

const INTRO: Record<Etape, string> = {
  creer:
    "Choisis un code de 4 à 8 chiffres. Je le demanderai à chaque ouverture de Paperasse. Si tu l’oublies, il faudra le verrouillage du téléphone pour rentrer.",
  changer: "Tape d’abord ton code actuel, puis le nouveau.",
  retirer: "Tape ton code pour le retirer. Paperasse restera protégé par le verrouillage du téléphone.",
  panique:
    "Si quelqu’un t’oblige à ouvrir Paperasse, tape ce code à la place du vrai : l’app s’ouvre sur un coffre vide qui a l’air normal. Tes vrais papiers restent chiffrés et cachés.",
};

export default function CodeScreen() {
  const { etape: raw } = useLocalSearchParams<{ etape?: string }>();
  const vault = useVault();
  const db = useSQLiteContext();
  const etape: Etape = raw === "changer" || raw === "retirer" || raw === "panique" ? raw : vault.hasPin ? "changer" : "creer";
  const [stage, setStage] = useState<Stage>(vault.hasPin ? "actuel" : "nouveau");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState("");
  useNoScreenshots(true, "code-reglage");

  const submit = async (typed: string) => {
    setBusy(true);
    setError(null);
    try {
      if (stage === "actuel") {
        if (!(await vault.checkPin(typed))) {
          const m = misses + 1;
          setMisses(m);
          setError(m >= 5 ? "Trop d’erreurs." : "Ce n’est pas ton code actuel.");
          if (m >= 5) goBack();
          return;
        }
        if (etape === "retirer") {
          await vault.removePin();
          setDone("Code retiré. Paperasse reste protégé par le verrouillage du téléphone si tu l’as activé.");
          setStage("fini");
          return;
        }
        setStage("nouveau");
        return;
      }
      if (stage === "nouveau") {
        const problem = pinProblem(typed);
        if (problem) {
          setError(problem);
          return;
        }
        setFirst(typed);
        setStage("confirmer");
        return;
      }
      if (stage === "confirmer") {
        if (typed !== first) {
          setError("Les deux codes ne sont pas pareils. Recommence.");
          setFirst("");
          setStage("nouveau");
          return;
        }
        const refused =
          etape === "panique" ? await vault.setPanic(typed, await getSetting(db, "language")) : await vault.setPin(typed);
        if (refused) {
          setError(refused);
          setFirst("");
          setStage("nouveau");
          return;
        }
        setDone(
          etape === "panique"
            ? "Code panique prêt. Garde-le en tête : il ouvre un coffre vide, sans rien te dire."
            : "Code enregistré. Je te le demanderai à la prochaine ouverture.",
        );
        setStage("fini");
      }
    } finally {
      setPin("");
      setBusy(false);
    }
  };

  if (stage === "fini") {
    return (
      <Screen title={TITLES[etape]} onClose={goBack}>
        <SpeechBubble mood="party">{done}</SpeechBubble>
        <Button label="Terminé" icon="check" variant="sun" size="lg" onPress={goBack} />
      </Screen>
    );
  }

  const prompt =
    stage === "actuel"
      ? "Ton code actuel"
      : stage === "nouveau"
        ? etape === "panique"
          ? "Ton code panique"
          : "Ton nouveau code"
        : "Tape-le encore une fois";

  return (
    <Screen title={TITLES[etape]} onClose={goBack}>
      <Text style={txt.body}>{INTRO[etape]}</Text>
      <Card flat>
        <View style={styles.center}>
          <Text style={txt.strong}>{prompt}</Text>
          <View style={styles.message}>
            {busy ? (
              <ActivityIndicator color={colors.orange} />
            ) : error ? (
              <Text style={[txt.small, { color: tones.red.fg, textAlign: "center" }]}>{error}</Text>
            ) : null}
          </View>
          <PinPad value={pin} onChange={(p) => { setPin(p); setError(null); }} onSubmit={(p) => void submit(p)} disabled={busy} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 10, paddingVertical: 8 },
  message: { minHeight: 36, justifyContent: "center", alignSelf: "stretch" },
});
