import { addDuration, daysBetween, findDates } from "./dates.ts";
import { fold, hasAny } from "./normalize.ts";
import { latest, paperDate, type Paper } from "./vault.ts";

export interface CalendarEvent {
  date: string;
  title: string;
  detail: string;
  certainty: "exact" | "approx";
  paperId: string | null;
  kind: "echeance" | "expiration" | "controle_technique" | "assurance" | "impots" | "actualisation" | "essai" | "caf";
}

function nextYearly(month: number, day: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return thisYear >= today ? thisYear : `${y + 1}${thisYear.slice(4)}`;
}

/** Date de 1re immatriculation (case B de la carte grise). */
function firstRegistration(text: string): string | null {
  const f = fold(text);
  const m = f.match(/(?:^|\n)\s*b\.?\s+(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/) ?? f.match(/premiere immatriculation\s*:?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/);
  return m ? (findDates(m[1])[0]?.iso ?? null) : null;
}

/** Prochain contrôle technique d'une voiture : avant ses 4 ans, puis tous les 2 ans. */
export function nextTechnicalInspection(firstReg: string, today: string): string {
  let due = addDuration(firstReg, 4, "an");
  while (due < today) due = addDuration(due, 2, "an");
  return due;
}

function trialEnd(text: string): { start: string; end: string } | null {
  const f = fold(text).replace(/\n/g, " ");
  const start = f.match(/(?:a compter du|a partir du|debutera le|date d'embauche\s*:?)\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}|\d{1,2}(?:er)? [a-z]+ \d{4})/);
  const trial = f.match(/periode d'essai[^.]{0,60}?(\d{1,2}|un|une|deux|trois|quatre)\s+(mois|semaines?|jours?)/);
  if (!start || !trial) return null;
  const iso = findDates(start[1])[0]?.iso;
  if (!iso) return null;
  const n = ({ un: 1, une: 1, deux: 2, trois: 3, quatre: 4 } as Record<string, number>)[trial[1]] ?? Number(trial[1]);
  const unit = trial[2].startsWith("mois") ? "mois" : trial[2].startsWith("semaine") ? "semaine" : "jour";
  return { start: iso, end: addDuration(iso, n, unit) };
}

export function adminCalendar(papers: Paper[], today: string, horizonDays = 365): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const add = (e: CalendarEvent) => {
    const d = daysBetween(today, e.date);
    if (d >= -30 && d <= horizonDays) out.push(e);
  };

  for (const p of papers) {
    // Dates limites écrites sur les papiers pas encore traités.
    if (p.deadline && !p.done) add({ date: p.deadline, title: p.title, detail: "Date limite écrite sur le papier.", certainty: "exact", paperId: p.id, kind: "echeance" });
    // Pièces d'identité : expiration.
    if (p.expiry && ["piece_identite", "titre_de_sejour", "permis_de_conduire"].includes(p.type)) {
      add({ date: p.expiry, title: `Fin de validité : ${p.title}`, detail: p.type === "titre_de_sejour" ? "Prépare le renouvellement plusieurs mois avant." : "Pense au renouvellement (rendez-vous en mairie parfois long).", certainty: "exact", paperId: p.id, kind: "expiration" });
    }
  }

  // Contrôle technique, d'après la carte grise.
  for (const p of latest(papers, ["carte_grise"])) {
    const reg = firstRegistration(p.text);
    if (reg) {
      add({ date: nextTechnicalInspection(reg, today), title: "Contrôle technique", detail: "À faire au plus tard à cette date (dans les 6 mois avant les 4 ans de la voiture, puis tous les 2 ans). Si ton dernier contrôle est plus récent, la date suit celui-ci.", certainty: "approx", paperId: p.id, kind: "controle_technique" });
    }
  }

  // Assurances : échéance, et droit de résilier à tout moment après 1 an (auto, habitation).
  const insurances = papers.filter((p) => p.type === "attestation_assurance" || (p.type === "facture" && hasAny(fold(p.text), ["avis d'echeance", "cotisation annuelle"]) && hasAny(fold(p.text), ["assurance"])));
  for (const p of insurances) {
    const end = p.expiry ?? (p.deadline && p.type === "facture" ? p.deadline : null);
    if (!end) continue;
    const isAutoOrHome = hasAny(fold(p.text), ["habitation", "automobile", "auto", "vehicule", "carte verte", "multirisque"]);
    add({ date: end, title: `Échéance d'assurance : ${p.issuer ?? p.title}`, detail: isAutoOrHome ? "Après 1 an de contrat, tu peux résilier à tout moment, sans frais : compare les prix avant l'échéance." : "Vérifie le nouveau prix avant de renouveler.", certainty: "exact", paperId: p.id, kind: "assurance" });
  }

  // Impôts : déclaration de revenus chaque printemps, taxe foncière à l'automne.
  if (papers.some((p) => p.type === "avis_imposition" || p.type === "fiche_de_paie")) {
    add({ date: nextYearly(4, 15, today), title: "Déclaration de revenus", detail: "Ouverte au printemps (en général d'avril à début juin) : dates exactes selon ton département sur impots.gouv.fr. Même si tu n'as pas d'impôt à payer, la déclaration ouvre des droits.", certainty: "approx", paperId: null, kind: "impots" });
  }
  if (papers.some((p) => p.type === "avis_imposition" && hasAny(fold(p.text), ["taxe fonciere"]))) {
    add({ date: nextYearly(10, 15, today), title: "Taxe foncière", detail: "À payer en général à la mi-octobre : la date exacte est sur l'avis (fin août dans ton espace impots.gouv.fr).", certainty: "approx", paperId: null, kind: "impots" });
  }

  // France Travail : actualisation mensuelle si un courrier récent montre une inscription.
  const ft = latest(papers, ["courrier_administratif", "attestation_employeur"]).find((p) => p.organisme === "francetravail" && daysBetween(paperDate(p), today) <= 183);
  if (ft) {
    // Fenêtre du 28 au 15 du mois suivant : la prochaine clôture est le 15 de ce mois-ci, ou du mois prochain.
    const day = Number(today.slice(8, 10));
    const month = day <= 15 ? today.slice(0, 7) : addDuration(`${today.slice(0, 7)}-01`, 1, "mois").slice(0, 7);
    add({ date: `${month}-15`, title: "Actualisation France Travail", detail: "Chaque mois, entre le 28 et le 15 du mois suivant, sinon tu n'es pas payé.", certainty: "exact", paperId: ft.id, kind: "actualisation" });
  }

  // Contrat : fin de la période d'essai.
  for (const p of latest(papers, ["contrat_de_travail"]).slice(0, 2)) {
    const t = trialEnd(p.text);
    if (t) add({ date: t.end, title: "Fin de la période d'essai", detail: "Après cette date, le contrat ne peut plus être rompu aussi facilement (si l'essai n'a pas été renouvelé).", certainty: "approx", paperId: p.id, kind: "essai" });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
