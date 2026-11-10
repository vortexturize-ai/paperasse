import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Platform } from "react-native";

/** Prévient l'app quand le réglage « bloquer partout » change. */
const listeners = new Set<() => void>();
export const CAPTURE_EVENT = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(): void {
    for (const fn of listeners) fn();
  },
};

/** Bloque les captures tant que `active` est vrai et que l'écran est affiché. Chaque écran a sa clé. */
export function useNoScreenshots(active: boolean, key: string): void {
  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [active, key]);
}
