import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { border, colors, fonts, pop } from "../../components/theme";
import { DocCard, EmptyState } from "../../components/ui";
import { searchDocuments } from "../../lib/db";
import type { DocumentRecord } from "../../lib/types";

export default function Search() {
  const db = useSQLiteContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentRecord[]>([]);
  // Mot cherché pour les résultats affichés : évite « rien trouvé » pendant la frappe.
  const [searched, setSearched] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchDocuments(db, query);
      if (!cancelled) {
        setResults(found);
        setSearched(query);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [db, query]);

  return (
    <Screen title="Chercher">
      <View style={[styles.field, pop(4)]}>
        <Icon name="search" size={22} strokeWidth={2.6} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ex. CAF, fiche de paie, bail…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Chercher dans mes papiers"
        />
      </View>
      {results.map((d) => (
        <DocCard key={d.id} doc={d} showDeadline={false} />
      ))}
      {results.length === 0 && searched === query ? (
        query.trim() ? (
          <EmptyState title="Je n’ai rien trouvé" text="Essaie un autre mot : qui a envoyé le papier, son type, un montant…" />
        ) : (
          <EmptyState title="Je cherche dans tout le texte" text="Même dans les papiers pris en photo, avec ou sans accents." />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: border,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, paddingVertical: 12 },
});
