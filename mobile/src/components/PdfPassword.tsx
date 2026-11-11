import * as Clipboard from "expo-clipboard";
import { getRandomBytes } from "expo-crypto";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { newPdfPassword, pdfPasswordProblem } from "../engine/pdfEncrypt";
import { Toggle } from "./Toggle";
import { border, colors, fonts, tones } from "./theme";
import { Button, Card, txt } from "./ui";

export interface PdfPasswordState {
  on: boolean;
  setOn: (on: boolean) => void;
  password: string;
  setPassword: (p: string) => void;
  renew: () => void;
  /** Raison du refus, ou null (toujours null quand la protection est coupée). */
  problem: string | null;
  /** Mot de passe à utiliser, ou undefined si le PDF part sans protection. */
  value: string | undefined;
}

const fresh = () => newPdfPassword(getRandomBytes(12));

/** Mot de passe d'ouverture d'un PDF partagé : proposé tout fait, modifiable. */
export function usePdfPassword(defaultOn = true): PdfPasswordState {
  const [on, setOn] = useState(defaultOn);
  const [password, setPassword] = useState(fresh);
  const problem = on ? pdfPasswordProblem(password) : null;
  return { on, setOn, password, setPassword, renew: () => setPassword(fresh()), problem, value: on && !problem ? password : undefined };
}

export function PdfPasswordCard({ state }: { state: PdfPasswordState }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(state.password);
    setCopied(true);
  };
  return (
    <Card flat tone={state.on ? "purple" : undefined}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={txt.strong}>Protéger par un mot de passe</Text>
          <Text style={txt.small}>Sans lui, personne ne peut ouvrir le PDF, même s’il est envoyé à la mauvaise adresse.</Text>
        </View>
        <Toggle value={state.on} onChange={state.setOn} label="Protéger le PDF par un mot de passe" />
      </View>
      {state.on ? (
        <>
          <TextInput
            value={state.password}
            onChangeText={(t) => {
              state.setPassword(t);
              setCopied(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            importantForAutofill="no"
            maxLength={64}
            style={styles.input}
            accessibilityLabel="Mot de passe du PDF"
          />
          {state.problem ? <Text style={[txt.small, { color: tones.red.fg }]}>{state.problem}</Text> : null}
          <View style={styles.row}>
            <Button label={copied ? "Copié" : "Copier"} icon={copied ? "check" : "copy"} variant="secondary" size="sm" onPress={() => void copy()} style={styles.flex} />
            <Button
              label="Autre"
              icon="refresh"
              variant="secondary"
              size="sm"
              onPress={() => {
                state.renew();
                setCopied(false);
              }}
              style={styles.flex}
            />
          </View>
          <Text style={[txt.small, { color: tones.purple.fg }]}>
            Donne le mot de passe par un autre moyen que le fichier : un SMS, un appel, ou de vive voix.
          </Text>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: border - 1,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyStrong,
    fontSize: 20,
    letterSpacing: 1,
    color: colors.ink,
    textAlign: "center",
  },
});
