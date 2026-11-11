import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { feedback, motionReduced, vibrate } from "../lib/feedback";
import { Mascot, type Mood } from "./Brand";
import { border, colors, pop } from "./theme";
import { Button, txt } from "./ui";

interface DialogButton {
  label: string;
  variant?: "primary" | "sun" | "success" | "secondary" | "danger";
}

interface DialogOptions {
  title: string;
  message?: string;
  mood?: Mood;
  buttons?: DialogButton[];
}

interface DialogApi {
  /** Affiche un message. Renvoie l'index du bouton touché. */
  show: (opts: DialogOptions) => Promise<number>;
  alert: (opts: Omit<DialogOptions, "buttons"> & { okLabel?: string }) => Promise<void>;
  confirm: (opts: Omit<DialogOptions, "buttons"> & { confirmLabel: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog doit être utilisé sous <DialogProvider>.");
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<DialogOptions | null>(null);
  const resolver = useRef<((index: number) => void) | null>(null);

  const show = useCallback((opts: DialogOptions) => {
    // Fête : petit carillon ; inquiétude : vibration d'alerte, sans son.
    if (opts.mood === "party") feedback("success");
    else if (opts.mood === "worried") vibrate("warning");
    return new Promise<number>((resolve) => {
      resolver.current?.(-1); // une seule fenêtre à la fois
      resolver.current = resolve;
      setCurrent(opts);
    });
  }, []);

  const close = (index: number) => {
    const resolve = resolver.current;
    resolver.current = null;
    setCurrent(null);
    resolve?.(index);
  };

  const api = useMemo<DialogApi>(
    () => ({
      show,
      alert: async ({ okLabel = "D'accord", ...o }) => {
        await show({ ...o, buttons: [{ label: okLabel, variant: "sun" }] });
      },
      confirm: async ({ confirmLabel, cancelLabel = "Annuler", danger, ...o }) => {
        const i = await show({
          ...o,
          buttons: [
            { label: confirmLabel, variant: danger ? "danger" : "sun" },
            { label: cancelLabel, variant: "secondary" },
          ],
        });
        return i === 0;
      },
    }),
    [show],
  );

  const buttons = current?.buttons ?? [{ label: "D'accord", variant: "sun" as const }];
  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal visible={current !== null} transparent animationType="fade" onRequestClose={() => close(-1)} statusBarTranslucent>
        <View style={styles.backdrop}>
          {current ? (
            <PopIn key={current.title} style={[styles.card, pop(6)]}>
              <View style={styles.mascot}>
                <Mascot size={74} mood={current.mood ?? "happy"} tilt={-6} />
              </View>
              <Text style={[txt.h2, styles.center]}>{current.title}</Text>
              {current.message ? <Text style={[txt.body, styles.center, { color: colors.muted }]}>{current.message}</Text> : null}
              <View style={styles.buttons}>
                {buttons.map((b, i) => (
                  <Button key={b.label} label={b.label} variant={b.variant ?? "secondary"} onPress={() => close(i)} />
                ))}
              </View>
            </PopIn>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

/** La carte arrive avec un petit rebond (le fond, lui, apparaît en fondu). */
function PopIn({ children, style }: { children: ReactNode; style: object[] }) {
  const [v] = useState(() => new Animated.Value(motionReduced() ? 1 : 0));
  useEffect(() => {
    if (motionReduced()) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 14, bounciness: 10 }).start();
  }, [v]);
  return (
    <Animated.View
      style={[...style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }]}
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43, 36, 64, 0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.bg,
    borderRadius: 26,
    borderWidth: border,
    borderColor: colors.ink,
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 20,
    gap: 10,
  },
  mascot: { position: "absolute", top: -42, alignSelf: "center" },
  center: { textAlign: "center" },
  buttons: { gap: 10, marginTop: 8 },
});
