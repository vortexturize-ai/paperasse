import { useLocalSearchParams } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback } from "react";
import { FlatList, Platform, StyleSheet } from "react-native";
import { Screen } from "../../components/Screen";
import { DocCard, EmptyState, IconTile } from "../../components/ui";
import { CATEGORIES, categoryOf } from "../../lib/categories";
import { listByCategory } from "../../lib/db";
import { goBack } from "../../lib/nav";
import type { DocumentRecord } from "../../lib/types";
import { useFocusData } from "../../lib/useFocusData";

const keyOf = (d: DocumentRecord) => d.id;
const renderDoc = ({ item }: { item: DocumentRecord }) => <DocCard doc={item} />;

/** Liste d'un dossier : virtualisée, pour rester fluide avec des centaines de papiers. */
export default function Folder() {
  const { categorie } = useLocalSearchParams<{ categorie: string }>();
  const key = categoryOf(categorie);
  const cat = CATEGORIES[key];
  const load = useCallback((db: SQLiteDatabase) => listByCategory(db, key), [key]);
  const { data } = useFocusData(load);

  return (
    <Screen title={cat.label} onBack={goBack} right={<IconTile icon={cat.icon} tone={cat.tone} size={44} />} scroll={false} bottomSpace={0}>
      <FlatList
        data={data ?? []}
        keyExtractor={keyOf}
        renderItem={renderDoc}
        contentContainerStyle={styles.list}
        ListEmptyComponent={data ? <EmptyState title="Ce dossier est vide" text="Je range ici tout seul les papiers qui vont dans ce dossier." /> : undefined}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14, paddingBottom: 32, paddingTop: 2 },
});
