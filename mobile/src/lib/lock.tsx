import * as LocalAuthentication from "expo-local-authentication";
import { useSQLiteContext } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { getSetting, setSetting } from "./db";
import { lockSuspended } from "./suspend";
import { useVault } from "./vaultGate";
import { Mascot, Wordmark } from "../components/Brand";
import { colors, fonts } from "../components/theme";
import { Button } from "../components/ui";

/** Temps en arrière-plan avant de redemander le déverrouillage. */
const RELOCK_AFTER_MS = 60_000;

interface LockContextValue {
  enabled: boolean;
  available: boolean;
  setEnabled: (on: boolean) => Promise<void>;
}

const LockContext = createContext<LockContextValue>({
  enabled: false,
  available: false,
  setEnabled: async () => undefined,
});

export function useLock(): LockContextValue {
  return useContext(LockContext);
}

export { withLockSuspended } from "./suspend";

async function biometricsReady(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/**
 * Cache l'app derrière un écran de déverrouillage (Face ID, empreinte ou code du téléphone).
 * Activé par défaut quand le téléphone a un verrouillage biométrique.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const vault = useVault();
  // Avec un code secret, c'est la porte du coffre qui verrouille : ce verrou-ci se met en retrait.
  const pinAtStart = useRef(vault.hasPin);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(true);
  const backgroundSince = useRef<number | null>(null);
  const active = enabled && !vault.hasPin;

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: "Déverrouiller Paperasse",
      cancelLabel: "Annuler",
    });
    if (res.success) setLocked(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await biometricsReady();
      const saved = await getSetting(db, "lock_enabled");
      if (!alive) return;
      setAvailable(ok);
      const on = ok && saved !== "0";
      const lockNow = on && !pinAtStart.current;
      setEnabledState(on);
      setLocked(lockNow);
      setReady(true);
      if (lockNow) void unlock();
    })();
    return () => {
      alive = false;
    };
  }, [db, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (!active) return;
      if (state === "background") backgroundSince.current = lockSuspended() ? null : Date.now();
      if (state === "active" && backgroundSince.current !== null) {
        const away = Date.now() - backgroundSince.current;
        backgroundSince.current = null;
        if (away > RELOCK_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [active, unlock]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        // On vérifie que la personne sait déverrouiller avant d'activer.
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Activer le verrouillage" });
        if (!res.success) return;
      }
      await setSetting(db, "lock_enabled", on ? "1" : "0");
      setEnabledState(on);
    },
    [db],
  );

  // L'app reste montée sous l'écran de verrouillage : on retrouve la même page après.
  return (
    <LockContext.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {!ready ? <View style={styles.screen} /> : null}
      {ready && locked && active ? (
        <View style={styles.screen}>
          <Mascot size={110} tilt={-8} />
          <Wordmark size={40} upper onDark />
          <Text style={styles.title}>Tes papiers sont protégés</Text>
          <Button label="Déverrouiller" icon="lock" variant="sun" size="lg" onPress={() => void unlock()} style={styles.button} />
        </View>
      ) : null}
    </LockContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    gap: 18,
    padding: 32,
  },
  title: { fontFamily: fonts.body, fontSize: 17, color: "#FFF3D6" },
  button: { alignSelf: "stretch" },
});
