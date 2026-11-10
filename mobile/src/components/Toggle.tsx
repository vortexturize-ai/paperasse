import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "./theme";

/** Interrupteur cartoon (contour épais, pastille blanche). */
export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={[styles.track, { backgroundColor: value ? colors.green : colors.line, opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={[styles.knob, { alignSelf: value ? "flex-end" : "flex-start" }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 58,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: colors.ink,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 2.5, borderColor: colors.ink },
});
