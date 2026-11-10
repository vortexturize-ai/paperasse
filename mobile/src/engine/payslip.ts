import { amountAfterLabel } from "./amounts.ts";
import { fold } from "./normalize.ts";

/** SMIC horaire brut en métropole (sources : service-public.fr, info.gouv.fr). À compléter à chaque revalorisation. */
export const SMIC_HORAIRE: { from: string; rate: number }[] = [
  { from: "2024-01-01", rate: 11.65 },
  { from: "2024-11-01", rate: 11.88 },
  { from: "2026-01-01", rate: 12.02 },
  { from: "2026-06-01", rate: 12.31 },
];

export function smicAt(iso: string): number | null {
  let rate: number | null = null;
  for (const s of SMIC_HORAIRE) if (s.from <= iso) rate = s.rate;
  return rate;
}

export interface PayslipFinding {
  level: "ok" | "a_verifier";
  text: string;
}

const NUM = String.raw`(\d{1,3}(?:[ .]\d{3})*,\d{2,4}|\d+[.,]\d{2,4})`;

/** « 1 835,21 » → 1835.21 ; « 12,105 » → 12.105 (un taux horaire peut avoir 3 ou 4 décimales). */
function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `period` = n'importe quel jour du mois de paie (AAAA-MM-JJ), pour choisir le bon SMIC. */
export function checkPayslip(text: string, period: string | null): PayslipFinding[] {
  const f = fold(text).replace(/\n(?=[^\n])/g, "\n");
  const findings: PayslipFinding[] = [];

  // Taux horaire de base : « Salaire de base 151,67 h 12,10 1 835,21 » ou « Taux horaire : 12,10 ».
  const base = f.match(new RegExp(String.raw`salaire de base[^\n]*?${NUM}\s*h\s+${NUM}`)) ;
  const rate = base ? num(base[2]) : num(f.match(new RegExp(String.raw`taux horaire\s*:?\s*${NUM}`))?.[1]);
  const smic = period ? smicAt(period) : null;
  if (rate !== null && smic !== null && rate > 3 && rate < 200) {
    if (rate + 0.005 < smic) {
      findings.push({ level: "a_verifier", text: `Taux horaire de ${fr(rate)} € : en dessous du SMIC (${fr(smic)} € brut de l'heure à cette date). Vérifie avec ton employeur ou ta convention collective (apprentis et jeunes ont des règles à part).` });
    } else {
      findings.push({ level: "ok", text: `Taux horaire de ${fr(rate)} € : au moins le SMIC (${fr(smic)} €).` });
    }
  }

  // Heures supplémentaires : « Heures supplémentaires 25 % 8,00 h 15,13 ».
  for (const m of f.matchAll(new RegExp(String.raw`heures? supp?(?:lementaires?)?\.?[^\n]*?(25|50)\s*%[^\n]*?${NUM}\s*h\s+${NUM}`, "g"))) {
    const pct = Number(m[1]);
    const hsRate = num(m[3]);
    if (rate !== null && hsRate !== null) {
      const min = rate * (1 + pct / 100);
      findings.push(hsRate + 0.01 < min
        ? { level: "a_verifier", text: `Heures supplémentaires à ${pct} % payées ${fr(hsRate)} € de l'heure : il faudrait au moins ${fr(min)} €.` }
        : { level: "ok", text: `Heures supplémentaires à ${pct} % bien majorées.` });
    }
  }

  // Brut − cotisations = net avant impôt (à quelques euros près s'il y a d'autres lignes).
  const brut = amountAfterLabel(f, "salaire brut") ?? amountAfterLabel(f, "total brut");
  const cotis = amountAfterLabel(f, "cotisations salariales") ?? amountAfterLabel(f, "total des cotisations");
  const netAvant = amountAfterLabel(f, "net a payer avant impot");
  if (brut !== null && cotis !== null && netAvant !== null) {
    const gap = Math.round((brut - cotis - netAvant) * 100) / 100;
    findings.push(Math.abs(gap) <= 1
      ? { level: "ok", text: "Brut − cotisations = net avant impôt : le calcul tombe juste." }
      : { level: "a_verifier", text: `Écart de ${fr(Math.abs(gap))} € entre « brut − cotisations » et le net avant impôt. Ça peut venir de lignes normales (tickets-restaurant, avantage en nature, acompte) : vérifie qu'elles sont bien sur la fiche.` });
  }
  return findings;
}
