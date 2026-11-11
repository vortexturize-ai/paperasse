import { Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from "@expo-google-fonts/nunito";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useSQLiteContext } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { Mascot, Wordmark } from "../components/Brand";
import { DialogProvider } from "../components/Dialog";
import { colors, fonts } from "../components/theme";
import { getSetting } from "../lib/db";
import { LockGate } from "../lib/lock";
import { remindersSupported, setupNotifications } from "../lib/notifications";
import { CAPTURE_EVENT, useNoScreenshots } from "../lib/privacyScreen";
import { VaultGate } from "../lib/vaultGate";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Prépare les rappels et ouvre la fiche du papier quand on touche un rappel. */
function ReminderTaps() {
  useEffect(() => {
    setupNotifications();
    if (!remindersSupported) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const docId = response?.notification.request.content.data?.docId;
      if (typeof docId === "string") requestAnimationFrame(() => router.push(`/document/${docId}`));
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}

/** Réglage « Bloquer les captures d'écran partout » (sinon : seulement sur les papiers sensibles). */
function ScreenshotGuard() {
  const db = useSQLiteContext();
  const [everywhere, setEverywhere] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () => void getSetting(db, "capture_block").then((v) => alive && setEverywhere(v === "1"));
    read();
    const sub = CAPTURE_EVENT.subscribe(read);
    return () => {
      alive = false;
      sub();
    };
  }, [db]);
  useNoScreenshots(everywhere, "partout");
  return null;
}

/**
 * Rideau opaque dès que l'app n'est plus au premier plan : l'aperçu du sélecteur d'apps (iOS, Android)
 * montre la mascotte, jamais un papier. Retiré dès le retour dans l'app.
 */
function PrivacyCurtain() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => setHidden(state !== "active"));
    return () => sub.remove();
  }, []);
  if (!hidden) return null;
  return (
    <View style={styles.curtain} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Mascot size={96} tilt={-6} />
      <Wordmark size={34} upper onDark />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={styles.root}>
      <VaultGate>
        <LockGate>
          <ScreenshotGuard />
          <DialogProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerShadowVisible: false,
                headerTintColor: colors.ink,
                headerTitleStyle: { color: colors.ink, fontFamily: fonts.title, fontSize: 20 },
                contentStyle: { backgroundColor: colors.bg },
                headerBackButtonDisplayMode: "minimal",
                // Chaque écran dessine son propre en-tête (composant Screen).
                headerShown: false,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="ajouter" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="document/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="dossier/[categorie]" options={{ headerShown: false }} />
              <Stack.Screen name="reponse/[id]" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="code" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="sauvegarde" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="deuxdoc" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="accompagnant" options={{ headerShown: false, presentation: "modal" }} />
            </Stack>
            <ReminderTaps />
          </DialogProvider>
        </LockGate>
      </VaultGate>
      <PrivacyCurtain />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  curtain: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    zIndex: 1000,
    elevation: 1000,
  },
});
