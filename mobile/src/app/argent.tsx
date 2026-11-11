import { goBack } from "../lib/nav";
import { router } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DateField } from "../components/DateField";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { border, colors, fonts, tones } from "../components/theme";
import { Card, EmptyState, Pill, SectionTitle, txt } from "../components/ui";
import { depositClaim, findMoney } from "../engine/money";
import { formatAmount, formatDate, todayIso } from "../lib/text";
import { useFocusData } from "../lib/useFocusData";
import { loadPapers } from "../lib/vault";
import { Tap } from "../components/Tap";

async function load(db: SQLiteDatabase) {
  return findMoney(await loadPapers(db), todayIso());
}

function euros(s: string): number | null {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
}

export default function MoneyScreen() {
  const { data } = useFocusData(load);
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [keys, setKeys] = useState<string | null>(null);
  const [damages, setDamages] = useState(false);
  const r = euros(rent);
  const d = euros(deposit);
  const claim = r !== null && d !== null && keys ? depositClaim({ rent: r, deposit: d, keysReturned: keys, damages, today: todayIso() }) : null;

  return (
    <Screen title="Argent à récupérer" onBack={goBack}>
      <Text style={txt.small}>Des pistes trouvées dans tes papiers. Rien n’est sûr à 100 % : vérifie chaque fois sur ton relevé de compte.</Text>
      {data && data.length === 0 ? <EmptyState title="Aucune piste pour l’instant" text="Plus tu ajoutes de papiers (remboursements, factures, fiches de paie), plus je trouve." mood="happy" /> : null}
      {(data ?? []).map((l) => (
        <Tap key={l.id} accessibilityRole="button" onPress={() => router.push(`/document/${l.paperIds[l.paperIds.length - 1]}`)}>
          <Card tone="green">
            <View style={styles.row}>
              <Icon name="euro" size={22} color={tones.green.fg} />
              <Text style={[txt.h3, styles.flex, { color: tones.green.fg }]}>{l.title}</Text>
            </View>
            <Text style={txt.body}>{l.detail}</Text>
          </Card>
        </Tap>
      ))}

      <SectionTitle>Mon dépôt de garantie</SectionTitle>
      <Card flat>
        <Text style={txt.body}>Le propriétaire doit le rendre 1 mois après la remise des clés (2 mois s’il y a des dégâts). Sinon : +10 % du loyer par mois de retard commencé.</Text>
        <Text style={txt.strong}>Loyer mensuel hors charges (€)</Text>
        <TextInput value={rent} onChangeText={setRent} keyboardType="decimal-pad" placeholder="620" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Loyer hors charges" />
        <Text style={txt.strong}>Montant du dépôt de garantie (€)</Text>
        <TextInput value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="620" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Dépôt de garantie" />
        <DateField label="Date de remise des clés" value={keys} onChange={setKeys} />
        <View style={styles.pills}>
          <Pill label="Pas de dégâts" selected={!damages} onPress={() => setDamages(false)} />
          <Pill label="Des dégâts notés" selected={damages} onPress={() => setDamages(true)} />
        </View>
        {claim ? (
          <Card tone={claim.late ? "red" : "blue"} flat>
            <Text style={[txt.h3, { color: claim.late ? tones.red.fg : tones.blue.fg }]}>
              {claim.late ? `En retard depuis le ${formatDate(claim.due)}` : `À rendre au plus tard le ${formatDate(claim.due)}`}
            </Text>
            {claim.late ? (
              <Text style={txt.body}>
                {claim.monthsLate} mois de retard : majoration de {formatAmount(claim.penalty)}. Tu peux réclamer {formatAmount(claim.total)}. Ouvre ton bail dans Paperasse puis « Écrire une réponse » → « Réclamer mon dépôt de garantie ».
              </Text>
            ) : (
              <Text style={txt.body}>Pas encore en retard. Je te conseille de noter cette date.</Text>
            )}
          </Card>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: border - 1,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyStrong,
    fontSize: 17,
    color: colors.ink,
  },
});
