import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { feedback, motionReduced } from "../lib/feedback";
import { colors } from "./theme";

const KNOB_TRAVEL = 58 - 2 * 2.5 - 2 * 3 - 24; // largeur - bordures - marges - pastille

/** Interrupteur cartoon (contour épais, pastille blanche) : la pastille glisse avec un petit rebond. */
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
  const [v] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    if (motionReduced()) v.setValue(value ? 1 : 0);
    // Couleur animée : pas de pilote natif pour les couleurs, la pastille suit le même ressort.
    else Animated.spring(v, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 9 }).start();
  }, [value, v]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        feedback(value ? "toggleOff" : "toggleOn");
        onChange(!value);
      }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[styles.track, { backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [colors.line, colors.green] }) }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, KNOB_TRAVEL] }) }] }]} />
      </Animated.View>
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
