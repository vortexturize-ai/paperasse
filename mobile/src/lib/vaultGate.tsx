import { getRandomBytes } from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Mascot, Wordmark } from "../components/Brand";
import { PinPad } from "../components/PinPad";
import { colors, fonts } from "../components/theme";
import { Button } from "../components/ui";
import {
  checkPinAgainst,
  fromHex,
  hashPinAsync,
  lockoutMs,
  parsePinRecord,
  pinProblem,
  toHex,
  verifyPinAsync,
  type PinRecord,
} from "../engine/secret";
import { migrate } from "./db";
import { lockSuspended } from "./suspend";
import { useNoScreenshots } from "./privacyScreen";
import { applyKey, forgetDecoy, prepareVault, seedDecoy, type VaultConfig, type VaultKind } from "./vaultKey";

const RELOCK_AFTER_MS = 60_000;
const STORE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const IDS = {
  secret: "paperasse.code.secret",
  panic: "paperasse.code.panique",
  tries: "paperasse.code.essais",
  bio: "paperasse.code.empreinte",
  salt: "paperasse.code.sel",
};

interface Tries {
  n: number;
  until: number;
}

interface Codes {
  secret: PinRecord | null;
  panic: PinRecord | null;
  bio: boolean;
}

export interface VaultContextValue {
  /** Coffre ouvert. En mode leurre, l'app se comporte comme si c'était le seul coffre. */
  kind: VaultKind;
  encrypted: boolean;
  hasPin: boolean;
  /** Toujours faux dans le coffre leurre (rien ne doit trahir son existence). */
  hasPanic: boolean;
  pinWithBiometrics: boolean;
  checkPin: (pin: string) => Promise<boolean>;
  /** Renvoie un message si le code est refusé, sinon null. */
  setPin: (pin: string) => Promise<string | null>;
  removePin: () => Promise<void>;
  setPanic: (pin: string | null, language: string | null) => Promise<string | null>;
  setPinWithBiometrics: (on: boolean) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const v = useContext(VaultContext);
  if (!v) throw new Error("useVault hors de <VaultGate>");
  return v;
}

async function readCodes(): Promise<Codes> {
  const [s, p, b] = await Promise.all([
    SecureStore.getItemAsync(IDS.secret, STORE),
    SecureStore.getItemAsync(IDS.panic, STORE),
    SecureStore.getItemAsync(IDS.bio, STORE),
  ]);
  const secret = parsePinRecord(s);
  return { secret, panic: secret ? parsePinRecord(p) : null, bio: secret !== null && b === "1" };
}

async function readTries(): Promise<Tries> {
  try {
    const t = JSON.parse((await SecureStore.getItemAsync(IDS.tries, STORE)) ?? "{}") as Partial<Tries>;
    return { n: Number.isInteger(t.n) ? (t.n as number) : 0, until: typeof t.until === "number" ? t.until : 0 };
  } catch {
    return { n: 0, until: 0 };
  }
}

async function writeTries(t: Tries): Promise<void> {
  await SecureStore.setItemAsync(IDS.tries, JSON.stringify(t), STORE);
}

/** Un sel par téléphone, partagé par le code secret et le code panique : un seul calcul par essai. */
async function installSalt(): Promise<Uint8Array> {
  const saved = await SecureStore.getItemAsync(IDS.salt, STORE);
  if (saved && /^[0-9a-f]{32}$/.test(saved)) return fromHex(saved);
  const salt = getRandomBytes(16);
  await SecureStore.setItemAsync(IDS.salt, toHex(salt), STORE);
  return salt;
}

async function newRecord(pin: string): Promise<PinRecord> {
  return hashPinAsync(pin, await installSalt());
}

/** Empreinte au hasard, avec le même sel : même calcul, même durée, qu'il y ait un code panique ou non. */
function decoyRecord(like: PinRecord): PinRecord {
  return { v: 1, salt: like.salt, hash: toHex(getRandomBytes(32)), iter: like.iter };
}

async function biometricsReady(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Au démarrage : sans code secret, on ouvre tout de suite le vrai coffre ; avec, on attend le code. */
async function boot(): Promise<{ codes: Codes; tries: Tries; bio: boolean; cfg: VaultConfig | null }> {
  const codes = await readCodes();
  const tries = await readTries();
  const bio = await biometricsReady();
  return { codes, tries, bio, cfg: codes.secret ? null : await prepareVault("reel") };
}

function waitLabel(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.ceil(s / 60)} min`;
}

export function VaultGate({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<Codes | null>(null);
  const [cfg, setCfg] = useState<VaultConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pin, setPinValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState<Tries>({ n: 0, until: 0 });
  const [bioReady, setBioReady] = useState(false);
  const backgroundSince = useRef<number | null>(null);
  const autoBio = useRef(false);

  const open = useCallback(
    async (kind: VaultKind) => {
      if (cfg?.kind === kind) {
        setLocked(false);
        return;
      }
      setCfg(await prepareVault(kind));
      setLocked(false);
    },
    [cfg],
  );

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    boot().then(
      (b) => {
        if (!alive) return;
        setCodes(b.codes);
        setTries(b.tries);
        setBioReady(b.bio);
        if (b.cfg) setCfg(b.cfg);
        else setLocked(true);
      },
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Après une minute en arrière-plan, on redemande le code.
  useEffect(() => {
    if (!codes?.secret || !cfg) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") backgroundSince.current = lockSuspended() ? null : Date.now();
      if (state === "active" && backgroundSince.current !== null) {
        const away = Date.now() - backgroundSince.current;
        backgroundSince.current = null;
        if (away > RELOCK_AFTER_MS) {
          setPinValue("");
          setMessage(null);
          autoBio.current = false;
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [codes?.secret, cfg]);

  const unlockWithBiometrics = useCallback(
    async (allowDeviceCode: boolean) => {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: allowDeviceCode ? "Prouve que c’est toi" : "Ouvrir Paperasse",
        cancelLabel: "Annuler",
        disableDeviceFallback: !allowDeviceCode,
      });
      if (!res.success) return false;
      await writeTries({ n: 0, until: 0 });
      setTries({ n: 0, until: 0 });
      await open("reel");
      return true;
    },
    [open],
  );

  const submit = async (typed: string) => {
    if (!codes?.secret || busy) return;
    const now = Date.now();
    const current = await readTries();
    if (now < current.until) {
      setTries(current);
      setMessage(`Trop d’essais. Réessaie dans ${waitLabel(current.until - now)}.`);
      setPinValue("");
      return;
    }
    setBusy(true);
    try {
      // Un seul calcul pour les deux codes (même sel) : même durée, qu'il y ait un code panique ou non.
      const [real, panic] = await checkPinAgainst(typed, [codes.secret, codes.panic ?? decoyRecord(codes.secret)]);
      if (real || panic) {
        await writeTries({ n: 0, until: 0 });
        setTries({ n: 0, until: 0 });
        setMessage(null);
        setPinValue("");
        await open(real ? "reel" : "leurre");
        return;
      }
      const n = current.n + 1;
      const next = { n, until: Date.now() + lockoutMs(n) };
      await writeTries(next);
      setTries(next);
      const wait = lockoutMs(n);
      setMessage(wait > 0 ? `Code incorrect. Réessaie dans ${waitLabel(wait)}.` : "Code incorrect.");
      setPinValue("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setBusy(false);
    }
  };

  // Empreinte proposée d'elle-même une fois, si la personne l'a choisie.
  useEffect(() => {
    if (locked && codes?.bio && bioReady && !autoBio.current) {
      autoBio.current = true;
      void unlockWithBiometrics(false);
    }
  }, [locked, codes?.bio, bioReady, unlockWithBiometrics]);

  const value = useMemo<VaultContextValue>(() => {
    const kind = cfg?.kind ?? "reel";
    const decoy = kind === "leurre";
    const refresh = async () => setCodes(await readCodes());
    return {
      kind,
      encrypted: Boolean(cfg?.key),
      hasPin: Boolean(codes?.secret),
      hasPanic: !decoy && Boolean(codes?.panic),
      pinWithBiometrics: !decoy && Boolean(codes?.bio),
      // Dans le leurre, « le code » est le code panique : c'est le seul que l'app connaît là.
      checkPin: async (p) => verifyPinAsync(p, decoy ? (codes?.panic ?? null) : (codes?.secret ?? null)),
      setPin: async (p) => {
        const problem = pinProblem(p);
        if (problem) return problem;
        const other = decoy ? codes?.secret : codes?.panic;
        if (other && (await verifyPinAsync(p, other))) return decoy ? "Choisis un autre code." : "Ce code est déjà ton code panique. Choisis-en un autre.";
        await SecureStore.setItemAsync(decoy ? IDS.panic : IDS.secret, JSON.stringify(await newRecord(p)), STORE);
        await refresh();
        return null;
      },
      removePin: async () => {
        if (decoy) return;
        await SecureStore.deleteItemAsync(IDS.secret, STORE);
        await SecureStore.deleteItemAsync(IDS.panic, STORE);
        await SecureStore.deleteItemAsync(IDS.bio, STORE);
        await SecureStore.deleteItemAsync(IDS.tries, STORE);
        await SecureStore.deleteItemAsync(IDS.salt, STORE);
        await forgetDecoy().catch(() => undefined);
        await refresh();
      },
      setPanic: async (p, language) => {
        if (decoy || !codes?.secret) return "Choisis d’abord un code secret.";
        if (p === null) {
          await SecureStore.deleteItemAsync(IDS.panic, STORE);
          await forgetDecoy().catch(() => undefined);
          await refresh();
          return null;
        }
        const problem = pinProblem(p);
        if (problem) return problem;
        if (await verifyPinAsync(p, codes.secret)) return "Le code panique doit être différent de ton code secret.";
        await seedDecoy(language);
        await SecureStore.setItemAsync(IDS.panic, JSON.stringify(await newRecord(p)), STORE);
        await refresh();
        return null;
      },
      setPinWithBiometrics: async (on) => {
        if (decoy) return;
        if (on) {
          const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Ouvrir aussi avec l’empreinte", cancelLabel: "Annuler" });
          if (!res.success) return;
          await SecureStore.setItemAsync(IDS.bio, "1", STORE);
        } else await SecureStore.deleteItemAsync(IDS.bio, STORE);
        await refresh();
      },
    };
  }, [cfg, codes]);

  // onInit doit rester stable : SQLiteProvider rouvre la base dès qu'il change.
  const cfgKey = cfg?.key ?? null;
  const onInit = useCallback(
    async (db: SQLiteDatabase) => {
      await applyKey(db, cfgKey);
      await migrate(db);
    },
    [cfgKey],
  );

  const showPin = codes?.secret != null && (locked || !cfg);
  useNoScreenshots(showPin, "code-secret");

  return (
    <VaultContext.Provider value={value}>
      {cfg ? (
        <SQLiteProvider
          key={cfg.databaseName}
          databaseName={cfg.databaseName}
          onInit={onInit}
        >
          {children}
        </SQLiteProvider>
      ) : null}
      {failed ? (
        <View style={styles.screen}>
          <Mascot size={96} mood="worried" />
          <Text style={styles.title}>Je n’arrive pas à ouvrir ton coffre</Text>
          <Text style={styles.text}>Tes papiers ne sont pas effacés. Redémarre le téléphone puis réessaie.</Text>
          <Button label="Réessayer" icon="refresh" variant="sun" size="lg" onPress={() => {
              setFailed(null);
              setAttempt((a) => a + 1);
            }}
            style={styles.button}
          />
        </View>
      ) : showPin ? (
        <View style={styles.screen}>
          <Wordmark size={34} upper onDark />
          <Text style={styles.title}>Tape ton code</Text>
          <View style={styles.message}>
            {busy ? <ActivityIndicator color={colors.sun} /> : message ? <Text style={styles.text}>{message}</Text> : null}
          </View>
          <PinPad dark value={pin} onChange={(p) => { setPinValue(p); setMessage(null); }} onSubmit={(p) => void submit(p)} disabled={busy} />
          <View style={styles.links}>
            {codes?.bio && bioReady ? (
              <Pressable accessibilityRole="button" onPress={() => void unlockWithBiometrics(false)} style={styles.link}>
                <Text style={styles.linkText}>Utiliser l’empreinte</Text>
              </Pressable>
            ) : null}
            {tries.n >= 3 ? (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  if (!(await unlockWithBiometrics(true)))
                    setMessage("Il faut le verrouillage du téléphone (code, schéma ou empreinte) pour prouver que c’est toi.");
                }}
                style={styles.link}
              >
                <Text style={styles.linkText}>Code oublié ?</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : !cfg ? (
        <View style={styles.screen} />
      ) : null}
    </VaultContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy,
    gap: 14,
    padding: 28,
  },
  title: { fontFamily: fonts.title, fontSize: 24, color: "#FFF3D6", textAlign: "center" },
  text: { fontFamily: fonts.body, fontSize: 16, color: "#FFF3D6", textAlign: "center" },
  message: { minHeight: 44, justifyContent: "center", alignSelf: "stretch" },
  button: { alignSelf: "stretch" },
  links: { flexDirection: "row", gap: 18, minHeight: 44, alignItems: "center" },
  link: { paddingVertical: 10, paddingHorizontal: 6 },
  linkText: { fontFamily: fonts.bodyStrong, fontSize: 16, color: colors.sun, textDecorationLine: "underline" },
});
