import { ScrollView, StyleSheet } from "react-native";
import type { Person, Who } from "../engine/people";
import { Pill } from "./ui";

export function WhoPills({ people, value, onChange, withAll = false }: { people: Person[]; value: Who; onChange: (w: Who) => void; withAll?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {withAll ? <Pill label="Tout le monde" selected={value === "tous"} onPress={() => onChange("tous")} /> : null}
      <Pill label="Moi" selected={value === "moi"} onPress={() => onChange("moi")} />
      {people.map((p) => (
        <Pill key={p.id} label={p.name} selected={value === p.id} onPress={() => onChange(p.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
});
