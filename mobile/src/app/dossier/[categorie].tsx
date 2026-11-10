import { router, useLocalSearchParams } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback } from "react";
import { Screen } from "../../components/Screen";
import { DocCard, EmptyState, IconTile } from "../../components/ui";
import { CATEGORIES, categoryOf } from "../../lib/categories";
import { listByCategory } from "../../lib/db";
import { useFocusData } from "../../lib/useFocusData";

export default function Folder() {
  const { categorie } = useLocalSearchParams<{ categorie: string }>();
  const key = categoryOf(categorie);
  const cat = CATEGORIES[key];
  const load = useCallback((db: SQLiteDatabase) => listByCategory(db, key), [key]);
  const { data } = useFocusData(load);

  return (
    <Screen title={cat.label} onBack={() => router.back()} right={<IconTile icon={cat.icon} tone={cat.tone} size={44} />}>
      {(data ?? []).map((d) => (
        <DocCard key={d.id} doc={d} />
      ))}
      {data && data.length === 0 ? (
        <EmptyState title="Ce dossier est vide" text="Je range ici tout seul les papiers qui vont dans ce dossier." />
      ) : null}
    </Screen>
  );
}
