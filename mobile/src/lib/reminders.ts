import { formatDate } from "./text.ts";
import type { DocumentRecord } from "./types.ts";

export const REMINDER_HOUR = 9; // rappels à 9 h, heure du téléphone
/** Jours avant une date limite. */
export const DEADLINE_OFFSETS = [7, 2, 0];
/** Jours avant une expiration (pièce d'identité, contrat, assurance…). */
export const EXPIRY_OFFSETS = [60, 30, 0];

/** Rappels encore à venir pour une date AAAA-MM-JJ. */
export function reminderDates(iso: string, offsets: number[], now = new Date()): { date: Date; daysBefore: number }[] {
  const [y, m, d] = iso.split("-").map(Number);
  return offsets
    .map((daysBefore) => ({ date: new Date(y, m - 1, d - daysBefore, REMINDER_HOUR, 0, 0), daysBefore }))
    .filter(({ date }) => date.getTime() > now.getTime());
}

function when(daysBefore: number): string {
  if (daysBefore === 0) return "aujourd'hui";
  if (daysBefore === 1) return "demain";
  return `dans ${daysBefore} jours`;
}

export interface ReminderPlan {
  date: Date;
  title: string;
  body: string;
}

/** Rappels d'un papier. `discreet` (code secret en place) : rien sur l'écran verrouillé ne dit de quel papier il s'agit. */
export function reminderPlans(
  doc: Pick<DocumentRecord, "deadline" | "deadlineLabel" | "isDone" | "expiryDate" | "title">,
  discreet: boolean,
  now = new Date(),
): ReminderPlan[] {
  const plans: ReminderPlan[] = [];
  if (doc.deadline && !doc.isDone) {
    for (const { date, daysBefore } of reminderDates(doc.deadline, DEADLINE_OFFSETS, now)) {
      plans.push(
        discreet
          ? { date, title: `⏰ Paperasse : à faire ${when(daysBefore)}`, body: "Un papier t'attend. Ouvre Paperasse pour le voir." }
          : { date, title: `⏰ À faire ${when(daysBefore)} (${formatDate(doc.deadline)})`, body: `${doc.deadlineLabel ?? "Date limite"} : ${doc.title}` },
      );
    }
  }
  if (doc.expiryDate) {
    for (const { date, daysBefore } of reminderDates(doc.expiryDate, EXPIRY_OFFSETS, now)) {
      plans.push(
        discreet
          ? { date, title: `📅 Paperasse : un papier expire ${when(daysBefore)}`, body: "Ouvre Paperasse pour le voir." }
          : { date, title: `📅 Expire ${when(daysBefore)} (${formatDate(doc.expiryDate)})`, body: `${doc.title} : pense à le renouveler.` },
      );
    }
  }
  return plans;
}
