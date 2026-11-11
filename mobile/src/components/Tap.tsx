import { useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import { feedback, motionReduced, type Sound } from "../lib/feedback";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const native = Platform.OS !== "web";

export type TapProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  children?: ReactNode;
  /** Son joué à l'appui (avec sa vibration) ; false : silencieux. */
  sound?: Sound | false;
  /** Enfoncement en pixels et réduction de taille pendant l'appui (effet autocollant). */
  depth?: number;
  shrink?: number;
};

/**
 * Pressable qui s'enfonce et rebondit (ressort, animé côté natif), avec un petit son et une vibration.
 * Remplace Pressable partout où l'on touche : même API, même style.
 */
export function Tap({ style, children, sound = "tap", depth = 2, shrink = 0.97, onPress, onPressIn, onPressOut, disabled, ...rest }: TapProps) {
  const [v] = useState(() => new Animated.Value(0));
  const [pressed, setPressed] = useState(false);
  const spring = (to: number) => {
    if (motionReduced()) {
      v.setValue(to);
      return;
    }
    Animated.spring(v, { toValue: to, useNativeDriver: native, speed: to ? 50 : 18, bounciness: to ? 0 : 12 }).start();
  };
  const resolved = typeof style === "function" ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        spring(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        spring(0);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (sound) feedback(sound);
        onPress?.(e);
      }}
      style={[
        resolved,
        {
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, depth] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, shrink] }) },
          ],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
