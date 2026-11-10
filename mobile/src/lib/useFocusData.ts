import { useFocusEffect } from "expo-router";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useCallback, useState } from "react";

/**
 * Recharge les données à chaque fois que l'écran revient au premier plan.
 * `load` doit être stable : une fonction du module, ou enveloppée dans useCallback.
 */
export function useFocusData<T>(load: (db: SQLiteDatabase) => Promise<T>): {
  data: T | null;
  reload: () => Promise<void>;
} {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | null>(null);
  const reload = useCallback(async () => setData(await load(db)), [db, load]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { data, reload };
}
