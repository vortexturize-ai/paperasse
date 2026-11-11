import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useDialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { border, colors, fonts } from "../../components/theme";
import { Toggle } from "../../components/Toggle";
import { Button, Card, Pill, SectionTitle, txt } from "../../components/ui";
import { LANGUAGE_NAMES } from "../../engine/i18n";
import { addPerson, getSetting, listPeople, removePerson, setSetting } from "../../lib/db";
import { MAX_PEOPLE, RELATIONS, checkName, type Person, type Relation } from "../../engine/people";
import { insertDemoDocuments } from "../../lib/demo";
import { useLock } from "../../lib/lock";
import { ensurePermission, remindersSupported } from "../../lib/notifications";
import { canReadImages } from "../../lib/ocr";
import { CAPTURE_EVENT } from "../../lib/privacyScreen";
import { formatDate } from "../../lib/text";
import { useVault } from "../../lib/vaultGate";

const LANGUAGES = Object.values(LANGUAGE_NAMES);

export default function Settings() {
  const db = useSQLiteContext();
  const lock = useLock();
  const dialog = useDialog();
  const [language, setLanguage] = useState("français");
  const [sender, setSender] = useState("");
  const [captureEverywhere, setCaptureEverywhere] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [easyRead, setEasyRead] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [newName, setNewName] = useState("");
  const [newRelation, setNewRelation] = useState<Relation>("enfant");
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const vault = useVault();

  useEffect(() => {
    (async () => {
      setLanguage((await getSetting(db, "language")) ?? "français");
      setSender((await getSetting(db, "sender")) ?? "");
      setCaptureEverywhere((await getSetting(db, "capture_block")) === "1");
      setEasyRead((await getSetting(db, "easy_read")) === "1");
    })();
  }, [db]);

  // Relue à chaque retour sur l'onglet (après une sauvegarde).
  useFocusEffect(
    useCallback(() => {
      void getSetting(db, "backup_last").then(setLastBackup);
      void listPeople(db).then(setPeople);
    }, [db]),
  );

  const addProche = async () => {
    if (people.length >= MAX_PEOPLE) {
      setPeopleError(`${MAX_PEOPLE} proches au plus.`);
      return;
    }
    const r = checkName(newName, people.map((x) => x.name));
    if ("problem" in r) {
      setPeopleError(r.problem);
      return;
    }
    await addPerson(db, r.name, newRelation);
    setNewName("");
    setPeopleError(null);
    setPeople(await listPeople(db));
  };

  const removeProche = async (person: Person) => {
    const ok = await dialog.confirm({
      title: `Retirer ${person.name} ?`,
      message: "Ses papiers restent dans le coffre : ils reviennent dans les tiens.",
      confirmLabel: "Retirer",
    });
    if (!ok) return;
    await removePerson(db, person.id);
    setPeople(await listPeople(db));
  };

  const chooseCapture = async (on: boolean) => {
    setCaptureEverywhere(on);
    await setSetting(db, "capture_block", on ? "1" : "0");
    CAPTURE_EVENT.emit();
  };

  const removePanic = async () => {
    const ok = await dialog.confirm({
      title: "Retirer le code panique ?",
      message: "Le coffre vide qui va avec sera effacé. Tes vrais papiers ne bougent pas.",
      confirmLabel: "Retirer",
    });
    if (ok) await vault.setPanic(null, null);
  };

  const chooseLanguage = async (l: string) => {
    setLanguage(l);
    await setSetting(db, "language", l);
  };

  const addDemo = async () => {
    const n = await insertDemoDocuments(db);
    await dialog.alert({ title: "Exemples ajoutés", message: `${n} papiers fictifs ajoutés.`, mood: "party" });
  };

  const askNotifications = async () => {
    const ok = await ensurePermission();
    await dialog.alert(
      ok
        ? { title: "Rappels activés", message: "Je te préviendrai avant chaque date limite.", mood: "party" }
        : { title: "Rappels refusés", message: "Active les notifications de Paperasse dans les réglages du téléphone.", mood: "worried" },
    );
  };

  return (
    <Screen title="Réglages">
      <SectionTitle>Sécurité</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Icon name="shield" size={26} />
          <View style={styles.flex}>
            <Text style={txt.strong}>{vault.encrypted ? "Coffre chiffré" : "Coffre non chiffré ici"}</Text>
            <Text style={txt.small}>
              {vault.encrypted
                ? "Tes papiers sont chiffrés (AES-256). La clé reste dans la puce de sécurité du téléphone."
                : "Le chiffrement marche dans l’app installée, pas dans Expo Go ni le navigateur."}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={txt.strong}>{vault.hasPin ? "Code secret activé" : "Code secret"}</Text>
            <Text style={txt.small}>
              {vault.hasPin
                ? "Demandé à l’ouverture et après 1 minute sans utiliser l’app. Les rappels ne montrent plus le nom de tes papiers."
                : "Un code à toi pour ouvrir Paperasse, en plus du verrouillage du téléphone."}
            </Text>
          </View>
        </View>
        {vault.hasPin ? (
          <View style={styles.buttons}>
            <Button label="Changer le code" icon="pencil" variant="secondary" onPress={() => router.push("/code?etape=changer")} />
            {vault.kind === "reel" ? (
              <Button label="Retirer le code" icon="close" variant="secondary" onPress={() => router.push("/code?etape=retirer")} />
            ) : null}
          </View>
        ) : (
          <Button label="Choisir un code" icon="lock" variant="sun" onPress={() => router.push("/code?etape=creer")} />
        )}
        {vault.hasPin && vault.kind === "reel" && lock.available ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={txt.strong}>Ouvrir aussi avec l’empreinte</Text>
              <Text style={txt.small}>Plus rapide. L’empreinte ouvre toujours le vrai coffre.</Text>
            </View>
            <Toggle value={vault.pinWithBiometrics} onChange={(on) => void vault.setPinWithBiometrics(on)} label="Ouvrir aussi avec l’empreinte" />
          </View>
        ) : null}
      </Card>

      {vault.hasPin && vault.kind === "reel" ? (
        <Card tone="purple" flat>
          <Text style={txt.strong}>Code panique {vault.hasPanic ? "prêt" : ""}</Text>
          <Text style={txt.small}>
            Un second code qui ouvre un coffre vide, qui a l’air normal. Si quelqu’un t’oblige à ouvrir Paperasse, tape celui-là : tes
            vrais papiers restent chiffrés et cachés, et leurs rappels se taisent.
          </Text>
          <View style={styles.buttons}>
            <Button
              label={vault.hasPanic ? "Changer le code panique" : "Choisir un code panique"}
              icon="shield"
              variant="secondary"
              onPress={() => router.push("/code?etape=panique")}
            />
            {vault.hasPanic ? (
              <Button label="Retirer" icon="close" variant="secondary" onPress={() => void removePanic()} />
            ) : null}
          </View>
        </Card>
      ) : null}

      {!vault.hasPin ? (
        <Card>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={txt.strong}>Verrouiller avec Face ID ou l’empreinte</Text>
              <Text style={txt.small}>
                {lock.available
                  ? "Demandé à l’ouverture et après 1 minute sans utiliser l’app."
                  : "Aucun verrouillage biométrique sur ce téléphone."}
              </Text>
            </View>
            <Toggle
              value={lock.enabled}
              disabled={!lock.available}
              onChange={(on) => void lock.setEnabled(on)}
              label="Verrouillage biométrique"
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={txt.strong}>Bloquer les captures d’écran partout</Text>
            <Text style={txt.small}>
              Toujours bloquées sur les pièces sensibles (identité, banque, santé, numéros personnels). Ici : dans toute l’app.
            </Text>
          </View>
          <Toggle value={captureEverywhere} onChange={(on) => void chooseCapture(on)} label="Bloquer les captures d’écran partout" />
        </View>
      </Card>

      <SectionTitle>Famille et proches</SectionTitle>
      <Card>
        <Text style={txt.small}>
          Range aussi les papiers de tes enfants, de ton conjoint ou d’un parent que tu aides. Chacun a les siens, tout reste sur ce
          téléphone.
        </Text>
        {people.map((person) => (
          <View key={person.id} style={styles.row}>
            <View style={styles.flex}>
              <Text style={txt.strong}>{person.name}</Text>
              <Text style={txt.small}>{RELATIONS[person.relation]}</Text>
            </View>
            <Button label="Retirer" variant="secondary" size="sm" onPress={() => void removeProche(person)} />
          </View>
        ))}
        <TextInput
          value={newName}
          onChangeText={(t) => {
            setNewName(t);
            setPeopleError(null);
          }}
          placeholder="Prénom d’un proche"
          placeholderTextColor={colors.muted}
          maxLength={40}
          style={[styles.input, { minHeight: 0, marginTop: 10 }]}
          accessibilityLabel="Prénom d’un proche"
        />
        <View style={styles.pills}>
          {(Object.keys(RELATIONS) as Relation[]).map((r) => (
            <Pill key={r} label={RELATIONS[r]} selected={newRelation === r} onPress={() => setNewRelation(r)} />
          ))}
        </View>
        {peopleError ? <Text style={[txt.small, { color: colors.red }]}>{peopleError}</Text> : null}
        <Button label="Ajouter ce proche" icon="family" variant="secondary" onPress={() => void addProche()} style={{ marginTop: 8 }} />
      </Card>

      <SectionTitle>Sauvegarde</SectionTitle>
      <Card>
        <Text style={txt.strong}>Sauvegarde chiffrée</Text>
        <Text style={txt.small}>
          {lastBackup
            ? `Dernière sauvegarde : ${formatDate(lastBackup.slice(0, 10))}.`
            : "Aucune sauvegarde pour l’instant : si tu perds ce téléphone, tes papiers sont perdus."}{" "}
          Un fichier que toi seul peux ouvrir, à ranger où tu veux.
        </Text>
        <View style={styles.buttons}>
          <Button label="Sauvegarder mes papiers" icon="shield" variant="sun" onPress={() => router.push("/sauvegarde")} />
          <Button label="Restaurer une sauvegarde" icon="refresh" variant="secondary" onPress={() => router.push("/sauvegarde?mode=restaurer")} />
          <Button label="Kit d’urgence pour un proche" icon="family" variant="secondary" onPress={() => router.push("/sauvegarde?mode=kit")} />
        </View>
      </Card>

      <SectionTitle>Lecture</SectionTitle>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={txt.strong}>Mode facile à lire</Text>
            <Text style={txt.small}>
              L’essentiel de chaque papier en gros, en quelques lignes, avec un bouton pour l’écouter. Pour agrandir tout le texte,
              augmente aussi la taille du texte dans les réglages du téléphone.
            </Text>
          </View>
          <Toggle
            value={easyRead}
            onChange={(on) => {
              setEasyRead(on);
              void setSetting(db, "easy_read", on ? "1" : "0");
            }}
            label="Mode facile à lire"
          />
        </View>
      </Card>

      <SectionTitle>Langue des explications</SectionTitle>
      <Text style={txt.small}>Je t’explique tes papiers dans cette langue. D’autres langues arrivent.</Text>
      <View style={styles.pills}>
        {LANGUAGES.map((l) => (
          <Pill key={l} label={l} selected={l === language} onPress={() => void chooseLanguage(l)} />
        ))}
      </View>

      <SectionTitle>Mes coordonnées</SectionTitle>
      <TextInput
        value={sender}
        onChangeText={setSender}
        onBlur={() => void setSetting(db, "sender", sender.trim())}
        placeholder={"Prénom Nom\nAdresse\nCode postal Ville"}
        placeholderTextColor={colors.muted}
        multiline
        style={styles.input}
        accessibilityLabel="Mes coordonnées pour les courriers"
      />
      <Text style={txt.small}>Pour signer tes courriers. Gardées sur ce téléphone.</Text>

      {remindersSupported ? (
        <>
          <SectionTitle>Rappels</SectionTitle>
          <Button label="Autoriser les rappels" icon="bell" variant="secondary" onPress={() => void askNotifications()} />
        </>
      ) : null}

      {__DEV__ ? (
        <>
          <SectionTitle>Développement</SectionTitle>
          <Button label="Ajouter des papiers d’exemple" icon="plus" variant="info" onPress={() => void addDemo()} />
          <Text style={txt.small}>
            Visible seulement en développement. Lecture des photos : {canReadImages ? "disponible" : "absente ici (Expo Go ou navigateur)"}.
          </Text>
        </>
      ) : null}

      <SectionTitle>Confidentialité</SectionTitle>
      <Card tone="purple" flat>
        <Text style={txt.body}>
          Tout se passe sur ton téléphone : la lecture des photos, le rangement, les explications et les courriers.
          Rien n’est envoyé sur Internet, il n’y a pas de compte, et l’app marche hors connexion.
        </Text>
        <Text style={txt.small}>Paperasse n’est pas un conseiller juridique : vérifie toujours les dates sur le papier.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  buttons: { gap: 8, marginTop: 10 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: border,
    borderColor: colors.ink,
    padding: 12,
    minHeight: 96,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
});
