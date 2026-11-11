import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { reminderPlans, type ReminderPlan } from "./reminders";
import type { DocumentRecord } from "./types";

const CHANNEL_ID = "echeances";
/** Le navigateur (aperçu web) ne gère pas les rappels locaux. */
export const remindersSupported = Platform.OS !== "web";

// Canal Android « Échéances ». S'il ne peut pas être créé (Expo Go),
// les rappels partent sur le canal par défaut d'Expo plutôt que d'être perdus.
let channelReady: Promise<boolean> = Promise.resolve(false);

/** À appeler une fois l'app affichée (pas au chargement du module : trop tôt pour Expo Go). */
export function setupNotifications(): void {
  if (!remindersSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    channelReady = Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Échéances",
      importance: AndroidImportance.HIGH,
    })
      .then(() => true)
      .catch((e: unknown) => {
        console.log("Canal de notifications « Échéances » indisponible, canal par défaut utilisé.", e);
        return false;
      });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Coffre leurre : aucun rappel (ni les siens, ni ceux du vrai coffre). Code secret : rappels discrets.
let mode = { muted: false, discreet: false };
export function setReminderMode(next: { muted: boolean; discreet: boolean }): void {
  mode = next;
}

/**
 * Remplace les rappels d'un document. Renvoie les nouveaux identifiants à enregistrer.
 * Aucun rappel si le courrier est marqué « traité ». `only` : rappels déjà choisis (plafond du coffre).
 */
export async function scheduleReminders(doc: DocumentRecord, only?: ReminderPlan[]): Promise<string[]> {
  if (!remindersSupported) return [];
  await cancelReminders(doc.notificationIds);
  if (mode.muted) return [];
  const plans = only ?? reminderPlans(doc, mode.discreet);
  if (plans.length === 0 || !(await ensurePermission())) return [];

  const channel = (await channelReady) ? { channelId: CHANNEL_ID } : {};
  const ids: string[] = [];
  for (const p of plans) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { docId: doc.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, ...channel },
      }),
    );
  }
  return ids;
}

/** Tous les rappels programmés sur le téléphone (ceux du vrai coffre compris). */
export async function cancelAllReminders(): Promise<void> {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
}

export async function scheduledReminderIds(): Promise<Set<string>> {
  if (!remindersSupported) return new Set();
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return new Set(all.map((n) => n.identifier));
}

export async function cancelReminders(ids: string[]): Promise<void> {
  if (!remindersSupported) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}
