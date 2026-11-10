import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
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
            <View style={[styles.card, pop(6)]} accessibilityViewIsModal accessibilityRole="alert">
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
            </View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
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
