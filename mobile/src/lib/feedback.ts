import { requireOptionalNativeModule } from "expo";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Sons et vibrations de l'interface. Discrets par construction : sons courts et doux (assets/sounds, fabriqués par
 * scripts/render-sounds.mjs), jamais en mode silencieux sur iPhone, jamais par-dessus la musique (mélangés), et
 * coupables dans les réglages. Si le module audio manque (ancienne app installée), tout reste muet sans planter.
 */
export type Sound = "tap" | "select" | "toggleOn" | "toggleOff" | "pop" | "success";
export type Haptic = "light" | "select" | "key" | "success" | "warning" | "medium";

const SOURCES: Record<Sound, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  select: require("../../assets/sounds/select.wav"),
  toggleOn: require("../../assets/sounds/toggleOn.wav"),
  toggleOff: require("../../assets/sounds/toggleOff.wav"),
  pop: require("../../assets/sounds/pop.wav"),
  success: require("../../assets/sounds/success.wav"),
};

/** Vibration qui accompagne chaque son. */
const HAPTIC_OF: Record<Sound, Haptic> = { tap: "light", select: "select", toggleOn: "select", toggleOff: "select", pop: "medium", success: "success" };

const VOLUME = 0.6;

interface Player {
  volume: number;
  play(): void;
  seekTo(seconds: number): Promise<void>;
}
interface AudioApi {
  createAudioPlayer(source: number): Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean; interruptionMode: "mixWithOthers" }): Promise<void>;
}

let prefs = { sound: true, haptics: true };
let audio: AudioApi | null | undefined;
const players = new Map<Sound, Player>();
const lastPlayed = new Map<Sound, number>();

/** Réglages « Sons » et « Vibrations » (lus dans le coffre à l'ouverture, changés dans Réglages). */
export function setFeedbackPrefs(next: Partial<typeof prefs>): void {
  prefs = { ...prefs, ...next };
}

export function feedbackPrefs(): Readonly<typeof prefs> {
  return prefs;
}

function audioApi(): AudioApi | null {
  if (audio !== undefined) return audio;
  audio = null;
  if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoAudio")) return audio;
  try {
    // Chargé seulement si le module natif est là : sinon expo-audio plante dès l'import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement à la demande, voir ci-dessus
    audio = require("expo-audio") as AudioApi;
    void audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
  } catch {
    audio = null;
  }
  return audio;
}

function playerFor(sound: Sound): Player | null {
  const api = audioApi();
  if (!api) return null;
  let p = players.get(sound);
  if (!p) {
    try {
      p = api.createAudioPlayer(SOURCES[sound]);
      p.volume = VOLUME;
      players.set(sound, p);
    } catch {
      return null;
    }
  }
  return p;
}

/** Charge les sons à l'avance : le premier appui sonne tout de suite. */
export function preloadSounds(): void {
  if (!prefs.sound) return;
  for (const s of Object.keys(SOURCES) as Sound[]) playerFor(s);
}

export function vibrate(kind: Haptic): void {
  if (!prefs.haptics || Platform.OS === "web") return;
  try {
    if (Platform.OS === "android") {
      // Retour du système : il suit le réglage « vibrations au toucher » du téléphone.
      const map: Record<Haptic, Haptics.AndroidHaptics> = {
        light: Haptics.AndroidHaptics.Context_Click,
        select: Haptics.AndroidHaptics.Clock_Tick,
        key: Haptics.AndroidHaptics.Keyboard_Tap,
        medium: Haptics.AndroidHaptics.Virtual_Key,
        success: Haptics.AndroidHaptics.Confirm,
        warning: Haptics.AndroidHaptics.Reject,
      };
      void Haptics.performAndroidHapticsAsync(map[kind]).catch(() => undefined);
      return;
    }
    const done =
      kind === "select" || kind === "key"
        ? Haptics.selectionAsync()
        : kind === "success"
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : kind === "warning"
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            : Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void done.catch(() => undefined);
  } catch {
    // pas de moteur de vibration
  }
}

/** Son + vibration d'un geste. Un même son n'est pas rejoué à moins de 40 ms d'intervalle. */
export function feedback(sound: Sound): void {
  vibrate(HAPTIC_OF[sound]);
  if (!prefs.sound) return;
  const now = Date.now();
  if (now - (lastPlayed.get(sound) ?? 0) < 40) return;
  lastPlayed.set(sound, now);
  const p = playerFor(sound);
  if (!p) return;
  try {
    void p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    // lecture impossible : on reste muet
  }
}

/** « Réduire les animations » du téléphone : suivi pour couper les mouvements décoratifs. */
let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => (reduceMotion = on))
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.("reduceMotionChanged", (on: boolean) => (reduceMotion = on));

export function motionReduced(): boolean {
  return reduceMotion;
}
