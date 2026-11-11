import { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { findTerms } from "../engine/glossary";
import type { Lang } from "../engine/i18n";
import { checkPayslip } from "../engine/payslip";
import { exposureSummary, findPersonalData, redactText } from "../engine/privacy";
import { keepAdvice } from "../engine/retention";
import { detectScam } from "../engine/scam";
import { DOC_TYPES, type DocType } from "../lib/categories";
import { withLockSuspended } from "../lib/lock";
import { formatDate, todayIso } from "../lib/text";
import type { DocumentRecord } from "../lib/types";
import { organismeOf } from "../lib/vault";
import { useDialog } from "./Dialog";
import { Icon } from "./Icon";
import { colors, fonts, tones } from "./theme";
import { Button, Card, txt } from "./ui";
import { Tap } from "./Tap";

/** Bandeau rouge quand le texte ressemble à une arnaque, avec les raisons. */
export function ScamBanner({ text }: { text: string | null }) {
  const report = useMemo(() => (text ? detectScam(text) : null), [text]);
  if (!report || report.level === "aucun") return null;
  const probable = report.level === "arnaque_probable";
  return (
    <Card tone={probable ? "red" : "yellow"}>
      <View style={styles.row}>
        <Icon name="warning" size={26} color={probable ? tones.red.fg : tones.yellow.fg} />
        <Text style={[txt.h3, styles.flex, { color: probable ? tones.red.fg : tones.yellow.fg }]}>
          {probable ? "Arnaque probable" : "Message suspect"}
        </Text>
      </View>
      {report.reasons.map((r, i) => (
        <Text key={i} style={[txt.body, { color: probable ? tones.red.fg : tones.yellow.fg }]}>• {r}</Text>
      ))}
    </Card>
  );
}

export function DocInsights({ doc, lang }: { doc: DocumentRecord; lang: Lang }) {
  const dialog = useDialog();
  const [showPersonal, setShowPersonal] = useState(false);
  const text = doc.fullText ?? "";
  const type = (doc.docType in DOC_TYPES ? doc.docType : "autre") as DocType;

  const personal = useMemo(() => findPersonalData(text), [text]);
  const summary = exposureSummary(personal);
  const terms = useMemo(() => findTerms(text), [text]);
  const payslip = useMemo(() => (type === "fiche_de_paie" ? checkPayslip(text, doc.docDate) : []), [type, text, doc.docDate]);
  const keep = keepAdvice({ type, organisme: organismeOf(doc), docDate: doc.docDate, expiry: doc.expiryDate, text }, todayIso());

  const shareMasked = async () => {
    const masked = redactText(text, personal, "moyenne");
    await withLockSuspended(() => Share.share({ title: doc.title, message: `${doc.title}\n\n${masked}` }));
  };

  return (
    <>
      {payslip.length > 0 ? (
        <Card flat>
          <View style={styles.row}>
            <Icon name="check" size={22} />
            <Text style={[txt.h3, styles.flex]}>Ta fiche de paie vérifiée</Text>
          </View>
          {payslip.map((f, i) => (
            <View key={i} style={styles.line}>
              <Icon name={f.level === "ok" ? "check" : "warning"} size={18} color={f.level === "ok" ? tones.green.fg : tones.orange.fg} />
              <Text style={[txt.body, styles.flex]}>{f.text}</Text>
            </View>
          ))}
          <Text style={txt.small}>Calculs refaits sur ton téléphone. En cas de doute, demande à ton employeur, au CSE ou à l’inspection du travail.</Text>
        </Card>
      ) : null}

      {summary.total > 0 ? (
        <Card flat>
          <Tap accessibilityRole="button" accessibilityState={{ expanded: showPersonal }} onPress={() => setShowPersonal((s) => !s)}>
            <View style={styles.row}>
              <Icon name="shield" size={22} color={summary.high ? tones.red.fg : colors.ink} />
              <View style={styles.flex}>
                <Text style={txt.h3}>Bouclier vie privée</Text>
                <Text style={txt.small}>
                  {summary.total} donnée{summary.total > 1 ? "s" : ""} personnelle{summary.total > 1 ? "s" : ""} sur ce papier
                  {summary.high ? `, dont ${summary.high} très sensible${summary.high > 1 ? "s" : ""}` : ""}.
                </Text>
              </View>
              <Text style={txt.small}>{showPersonal ? "Cacher" : "Voir"}</Text>
            </View>
          </Tap>
          {showPersonal
            ? personal.map((p, i) => (
                <View key={i} style={styles.fact}>
                  <Text style={[txt.small, styles.flex]}>{p.label}</Text>
                  <Text style={[txt.strong, { color: p.sensitivity === "haute" ? tones.red.fg : colors.ink }]}>{p.masked}</Text>
                </View>
              ))
            : null}
          <Button label="Partager le texte en masquant mes données" icon="shield" variant="info" size="sm" onPress={() => void shareMasked()} />
          <Text style={txt.small}>Avant d’envoyer une photo de ce papier, demande-toi si la personne a vraiment besoin de tous ces numéros.</Text>
        </Card>
      ) : null}

      <Card flat tone={keep.canDiscard ? "green" : undefined}>
        <View style={styles.row}>
          <Icon name="hourglass" size={22} />
          <Text style={[txt.h3, styles.flex]}>
            {keep.forever ? "À garder toute ta vie" : keep.canDiscard ? "Tu peux le jeter" : keep.until ? `À garder jusqu’au ${formatDate(keep.until)}` : "Combien de temps le garder ?"}
          </Text>
        </View>
        <Text style={txt.body}>{keep.rule}</Text>
        {keep.canDiscard ? <Text style={txt.small}>La version numérique peut rester dans Paperasse si tu veux.</Text> : null}
      </Card>

      {terms.length > 0 ? (
        <Card flat>
          <View style={styles.row}>
            <Icon name="book" size={22} />
            <Text style={[txt.h3, styles.flex]}>Les mots difficiles</Text>
          </View>
          <View style={styles.chips}>
            {terms.map((t) => (
              <Tap
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Expliquer : ${t.word}`}
                onPress={() => void dialog.alert({ title: t.word, message: t.def[lang], mood: "reading", okLabel: "Compris" })}
                style={({ pressed }) => [styles.term, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.termText}>{t.word}</Text>
              </Tap>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  fact: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 2, borderStyle: "dashed", borderTopColor: colors.line, paddingTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  term: { backgroundColor: tones.blue.bg, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5 },
  termText: { fontFamily: fonts.bodyStrong, fontSize: 14, color: tones.blue.fg },
});
