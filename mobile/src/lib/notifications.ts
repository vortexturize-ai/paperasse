import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { DEADLINE_OFFSETS, EXPIRY_OFFSETS, reminderDates } from "./reminders";
import { formatDate } from "./text";
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

function when(daysBefore: number): string {
  if (daysBefore === 0) return "aujourd'hui";
  if (daysBefore === 1) return "demain";
  return `dans ${daysBefore} jours`;
}

/**
 * Remplace les rappels d'un document. Renvoie les nouveaux identifiants à enregistrer.
 * Aucun rappel si le courrier est marqué « traité ».
 */
export async function scheduleReminders(doc: DocumentRecord): Promise<string[]> {
  if (!remindersSupported) return [];
  await cancelReminders(doc.notificationIds);
  const plans: { date: Date; title: string; body: string }[] = [];

  if (doc.deadline && !doc.isDone) {
    for (const { date, daysBefore } of reminderDates(doc.deadline, DEADLINE_OFFSETS)) {
      plans.push({
        date,
        title: `⏰ À faire ${when(daysBefore)} (${formatDate(doc.deadline)})`,
        body: `${doc.deadlineLabel ?? "Date limite"} : ${doc.title}`,
      });
    }
  }
  if (doc.expiryDate) {
    for (const { date, daysBefore } of reminderDates(doc.expiryDate, EXPIRY_OFFSETS)) {
      plans.push({
        date,
        title: `📅 Expire ${when(daysBefore)} (${formatDate(doc.expiryDate)})`,
        body: `${doc.title} : pense à le renouveler.`,
      });
    }
  }
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

export async function cancelReminders(ids: string[]): Promise<void> {
  if (!remindersSupported) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}
