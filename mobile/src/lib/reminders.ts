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
