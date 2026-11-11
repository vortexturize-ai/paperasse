import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { motionReduced, vibrate } from "../lib/feedback";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { border, colors, fonts } from "./theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "erase", "0", "ok"] as const;

/**
 * Pavé du code secret. Touches qui s'enfoncent avec une vibration légère, mais SANS son : le nombre de chiffres
 * tapés ne s'entend pas autour de soi. `shake` : changer sa valeur fait trembler les points (code refusé).
 */
export function PinPad({
  value,
  onChange,
  onSubmit,
  dark = false,
  disabled = false,
  minLength = 4,
  maxLength = 8,
  shake = 0,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (pin: string) => void;
  dark?: boolean;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  shake?: number;
}) {
  const fg = dark ? "#FFF3D6" : colors.ink;
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!shake) return;
    vibrate("warning");
    if (motionReduced()) return;
    const step = (to: number) => Animated.timing(x, { toValue: to, duration: 45, useNativeDriver: Platform.OS !== "web" });
    Animated.sequence([step(-10), step(10), step(-8), step(8), step(-4), step(0)]).start();
  }, [shake, x]);

  const press = (k: (typeof KEYS)[number]) => {
    if (disabled) return;
    vibrate("key");
    if (k === "erase") onChange(value.slice(0, -1));
    else if (k === "ok") {
      if (value.length >= minLength) onSubmit(value);
    } else if (value.length < maxLength) onChange(value + k);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: x }] }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${value.length} chiffre${value.length > 1 ? "s" : ""} tapé${value.length > 1 ? "s" : ""}`}
      >
        {Array.from({ length: Math.max(minLength, Math.min(maxLength, value.length + (value.length < maxLength ? 1 : 0))) }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: fg, backgroundColor: i < value.length ? (dark ? colors.sun : colors.orange) : "transparent" }]} />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {KEYS.map((k) => {
          const ok = k === "ok";
          const enabled = !disabled && (ok ? value.length >= minLength : k === "erase" ? value.length > 0 : value.length < maxLength);
          return (
            <Tap
              key={k}
              onPress={() => press(k)}
              disabled={!enabled}
              sound={false}
              depth={1}
              shrink={0.92}
              accessibilityRole="button"
              accessibilityLabel={k === "erase" ? "Effacer un chiffre" : ok ? "Valider le code" : k}
              style={[
                styles.key,
                {
                  borderColor: fg,
                  backgroundColor: ok ? colors.sun : dark ? "rgba(255,255,255,0.08)" : colors.card,
                  opacity: enabled ? 1 : 0.35,
                },
              ]}
            >
              {k === "erase" ? (
                <Icon name="erase" size={26} color={fg} />
              ) : ok ? (
                <Icon name="check" size={28} color={colors.ink} strokeWidth={3} />
              ) : (
                <Text style={[styles.digit, { color: fg }]}>{k}</Text>
              )}
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 22, alignSelf: "stretch" },
  dots: { flexDirection: "row", gap: 12, minHeight: 20 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: 300 },
  key: { width: 76, height: 76, borderRadius: 38, borderWidth: border, alignItems: "center", justifyContent: "center" },
  digit: { fontFamily: fonts.title, fontSize: 30 },
});
