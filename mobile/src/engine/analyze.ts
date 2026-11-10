import { DOC_TYPES, type DocType, type Urgency } from "../lib/categories.ts";
import type { Analysis } from "../lib/types.ts";
import { amountAfterLabel, mainAmount, type AmountDirection } from "./amounts.ts";
import { classify } from "./classify.ts";
import {
  addDuration, daysBetween, findDates, findDurations, findPartialDates, resolvePartial, type DateMention,
} from "./dates.ts";
import { formatDateIn, WORDS, type Ctx, type Intent, type Lang } from "./i18n.ts";
import { detectIssuer, guessSender, ISSUERS, type Issuer } from "./issuers.ts";
import { parseMrz } from "./mrz.ts";
import { after, before, cleanText, flat, fold, hasAny, indexOfWord, lastIndexOfWord, lines, sentenceAt } from "./normalize.ts";
import { findReferences, type KeyFact } from "./references.ts";
import { detectScam, type ScamReport } from "./scam.ts";

export interface EngineOptions {
  today: string; // AAAA-MM-JJ
  language: Lang;
}

export interface EngineResult extends Analysis {
  confiance: number;
  organisme: string | null;
  intention: Intent;
  /** Signes d'arnaque (null si aucun). */
  arnaque: ScamReport | null;
}

const DEADLINE_CUES: [string, number][] = [
  ["au plus tard le", 10],
  ["date limite de paiement", 10],
  ["date limite", 9],
  ["avant le", 9],
  ["a payer avant", 10],
  ["a regler avant", 10],
  ["a retourner avant", 10],
  ["a renvoyer avant", 10],
  ["date d'exigibilite", 9],
  ["exigible le", 9],
  ["a payer le", 8],
  ["au plus tard", 7],
  ["date d'echeance", 7],
  ["echeance", 5],
  ["convoque le", 8],
  ["convoquee le", 8],
  ["rendez-vous le", 8],
  ["se presenter le", 8],
  ["audience du", 8],
  ["sera preleve le", 4],
  ["jusqu'au", 4],
];

const EXPIRY_CUES = ["date d'expiration", "expire le", "valable jusqu'au", "date de fin de validite", "fin de validite", "valide jusqu'au", "date de validite", "valable du", "periode de validite"];
const BIRTH_CUES = ["naissance", "ne le", "nee le", "ne(e) le", "ne (e) le", "ne a", "nee a"];
const DOC_DATE_CUES = [", le ", "fait a", "fait le", "date :", "date d'envoi", "date d'edition", "edite le", "emis le", "etabli le", "etablie le", "imprime le", "en date du", "date de la facture", "date de facture", "date d'emission", "date de l'avis", "date d'etablissement", "date de mise en recouvrement", "date du rapport", "realisee le", "realise le", "courrier du", "facture du", "delivre le", "date de delivrance", "le "];
// Dates qui ne sont ni celle du papier ni une limite : un texte de loi cité (« loi n° 78-17 du 6 janvier 1978 »),
// une embauche, une ancienneté.
const LEGAL_REF = /(?:\b(?:loi|decret|ordonnance|arrete|directive|reglement|code)\b[^.]{0,30}|\bn° ?[\d\-./]+ )du\s*$/;
const NOT_DOC_DATE = ["entree", "date d'entree", "anciennete", "embauche", "date d'embauche", "depuis le", "depuis"];
// Un délai qui ne court que si quelque chose arrive (« en cas d'accident, dans les 48 heures ») : jamais une date limite.
const EVENT_DELAY = /\b(?:en cas d'(?:accident|absence|arret|maladie|hospitalisation|changement|perte|vol|empechement)|tout accident|tout changement|a compter du jour ou|de sa delivrance|s'il est|s'il n'est|s'ils|s'elle|lorsque|lorsqu'|nonobstant)/;
// Un délai pour contester : une vraie date, mais seulement comptée depuis la date écrite du courrier.
const RECOURSE_DELAY = /\b(?:en cas de desaccord|si vous (?:souhaitez|le souhaitez|desirez|n'etes pas d'accord|contestez)|vous disposez|vous pouvez|recours|contester|contestation|faire appel)/;
// Un papier sans date dont toutes les dates sont vieilles : un délai relatif ne se compte pas depuis aujourd'hui.
const OLD_PAPER_DAYS = 120;

const SEVERE = [
  "commissaire de justice", "commissaires de justice", "huissier", "saisie de vos", "saisie sur", "saisie-attribution", "saisie attribution",
  "saisie des remunerations", "proces-verbal de saisie", "saisie-vente", "expulsion", "tribunal", "injonction", "coupure",
  "reduite puis suspendue", "reduction de puissance", "suspension de la fourniture", "poursuites", "mise en demeure", "commandement de payer",
];
// « Sans réponse de votre part » figure aussi dans les premiers courriers : ce n'est pas une relance.
const RELANCE = [
  "relance", "dernier rappel", "deuxieme rappel", "second rappel", "rappel de paiement", "mise en demeure", "nous n'avons pas recu",
  "facture impayee", "reste impayee", "restee impayee", "n'a pas ete reglee", "n'a pas ete payee", "malgre nos precedents", "malgre nos relances",
];
const INDU = ["trop-percu", "trop percu", "indu", "vous devez rembourser", "remboursement de la somme", "percu a tort", "de trop entre"];
const RDV = [
  "rendez-vous", "convocation", "vous etes convoque", "vous etes attendu", "nous vous convoquons", "entretien prealable", "audience du", "a l'audience",
];
// Une demande, pas un papier qui « peut valoir justificatif » ni un formulaire qui « transmet » des informations.
const SEND_DOC = [
  "pieces justificatives", "piece justificative", "justificatif demande", "justificatifs demandes", "justificatif suivant", "justificatifs suivants",
  "envoyer le justificatif", "envoyer les justificatifs", "envoyer un justificatif", "demande de justificatif", "demande de justificatifs",
  "merci de nous faire parvenir", "nous faire parvenir", "nous le faire parvenir", "nous la faire parvenir", "nous les faire parvenir", "nous envoyer", "merci de nous envoyer",
  "merci de nous retourner", "nous retourner", "nous adresser", "nous transmettre", "merci de transmettre", "veuillez transmettre",
  "documents suivants", "renvoyer", "renvoyez", "retournez", "envoyez-nous", "adressez-nous", "nous fournir", "a fournir", "veuillez fournir",
  "merci de fournir", "devez fournir", "devez nous fournir",
];
const PAY = ["a payer", "a regler", "montant du :", "reste a payer", "solde du", "somme due", "regler la somme", "payer la somme", "commandement de payer"];
const RIGHTS = ["vous avez droit", "notification de droits", "montant de votre aide", "vos droits", "nous vous versons", "sera verse", "attestation de droits", "vous beneficiez", "votre allocation", "bourse"];
const AUTO_DEBIT = ["sera preleve", "seront preleve", "prelevement automatique", "preleve le", "par prelevement", "prelevement le", "preleves automatiquement", "vous etes mensualise", "mensualisation", "preleve sur votre compte", "prelevement sur votre compte", "sera prelevee le"];
const PAID = ["paye le", "payee le", "paye par", "payee par", "deja paye", "deja regle", "reglee le", "regle le", "acquittee", "montant regle", "paiement recu", "nous avons bien recu votre paiement"];
// Un rendez-vous a une heure : « le mercredi 18 novembre 2026 à 14 h 30 ».
const APPOINTMENT_TIME = /^\s*,?\s*(?:a|des)\s+\d{1,2}\s*h/;
const AFTER_DEADLINE = /^[\s,]*(?:au plus tard|dernier delai|delai de rigueur)/;
const BETWEEN = /entre le\s.{4,30}?\set(?: le)?\s*$/;

const ID_TYPES: DocType[] = ["piece_identite", "titre_de_sejour", "permis_de_conduire"];
const EMPLOYER_PAPERS: DocType[] = ["fiche_de_paie", "attestation_employeur"];
const SOCIAL_BODIES = ["msa", "urssaf", "francetravail", "cpam", "retraite", "dgfip", "caf"];
const NO_TODO: DocType[] = ["fiche_de_paie", "contrat_de_travail", "cv", "diplome", "bail", "quittance_loyer", "releve_bancaire", "ordonnance", "certificat_scolarite", "attestation_employeur", "carte_grise", "ticket_garantie", "devis"];

interface DatedFacts {
  docDate: string | null;
  deadline: string | null;
  deadlineQuote: string | null;
  /** La date limite vient d'un délai (« dans les 15 jours »), pas d'une date écrite. */
  deadlineRelative: boolean;
  expiry: string | null;
}

/** Un indice placé juste avant la date, pas au milieu d'un mot (« simple » ne contient pas « le »). */
function cueBefore(ctx: string, cue: string): boolean {
  let i = ctx.indexOf(cue);
  while (i !== -1) {
    if (!/[a-z]/.test(cue[0]) || i === 0 || !/[a-z0-9]/.test(ctx[i - 1])) return true;
    i = ctx.indexOf(cue, i + 1);
  }
  return false;
}

/** La phrase repliée qui contient la position. */
function foldedSentence(f: string, index: number): string {
  const start = Math.max(f.lastIndexOf(". ", index), f.lastIndexOf("; ", index), index - 300);
  let end = f.indexOf(". ", index);
  if (end === -1 || end - index > 300) end = Math.min(f.length, index + 300);
  return f.slice(Math.max(0, start), end);
}

function scoreCue(context: string, cues: [string, number][]): number {
  let best = 0;
  for (const [cue, weight] of cues) {
    const pos = lastIndexOfWord(context, cue);
    if (pos === -1) continue;
    const distance = context.length - (pos + cue.length);
    best = Math.max(best, weight - distance / 12);
  }
  return best;
}

interface Candidate {
  iso: string;
  index: number;
  score: number;
}

function datedFacts(text: string, f: string, today: string, rdvLetter: boolean): DatedFacts {
  const legal = (d: DateMention) => LEGAL_REF.test(before(f, d.index, 50));
  const dates = findDates(f).filter((d) => !legal(d));
  const isBirth = (i: number) => hasAny(before(f, i, 30), BIRTH_CUES);
  const isExpiry = (i: number) => hasAny(before(f, i, 40), EXPIRY_CUES);
  const notDocDate = (i: number) => hasAny(before(f, i, 25), NOT_DOC_DATE);

  let expiry: string | null = null;
  for (const d of dates) if (isExpiry(d.index) && (!expiry || d.iso > expiry)) expiry = d.iso;

  // Chaque date reçoit une note « date limite » d'après les mots autour.
  const deadlineScore = (index: number, length: number): number => {
    let s = scoreCue(before(f, index, 45), DEADLINE_CUES);
    const next = after(f, index + length, 24);
    if (AFTER_DEADLINE.test(next)) s = Math.max(s, 9);
    if (BETWEEN.test(before(f, index, 45))) s = Math.max(s, 9);
    if (rdvLetter && APPOINTMENT_TIME.test(next)) s = Math.max(s, 8);
    return s;
  };
  const hasTime = (d: DateMention) => APPOINTMENT_TIME.test(after(f, d.index + d.length, 24));
  const scored = new Map<DateMention, number>();
  for (const d of dates) if (!isBirth(d.index) && !isExpiry(d.index)) scored.set(d, deadlineScore(d.index, d.length));

  // Date du courrier : la première date annoncée comme telle, sinon une date en haut de page.
  // Jamais la date limite la plus probable, ni une date nettement annoncée comme limite.
  let likelyDeadline: DateMention | null = null;
  for (const [d, s] of scored) if (s > 2 && (!likelyDeadline || s > scored.get(likelyDeadline)!)) likelyDeadline = d;
  const plausibleDoc = (d: DateMention) =>
    !isBirth(d.index) && !isExpiry(d.index) && !notDocDate(d.index) && d !== likelyDeadline && (scored.get(d) ?? 0) < 7 && d.iso <= today;
  let docDate: string | null = null;
  for (const d of dates) {
    if (!plausibleDoc(d)) continue;
    const ctx = before(f, d.index, 25);
    if (DOC_DATE_CUES.some((c) => cueBefore(ctx, c))) {
      docDate = d.iso;
      break;
    }
  }
  if (!docDate) {
    const firstThird = Math.max(400, Math.floor(f.length / 3));
    docDate = dates.find((d) => d.index < firstThird && plausibleDoc(d))?.iso ?? null;
  }

  // Une date avec une heure, APRÈS la date du courrier, est un rendez-vous (« venir la retirer le jeudi
  // 19 novembre à 9 h 30 ») ; avant, c'est l'heure d'un fait (« infraction le 01/11 à 16 h 42 »).
  for (const [d, s] of scored) if (s < 8 && hasTime(d) && d.iso > (docDate ?? today)) scored.set(d, 8);

  // Date limite : la mieux notée, jamais avant la date du courrier ; à égalité, la plus proche.
  // Sans date de courrier, on compte depuis aujourd'hui, sauf si toutes les dates du papier sont vieilles.
  const newest = dates.reduce<string | null>((m, d) => (d.iso <= today && (!m || d.iso > m) ? d.iso : m), null);
  const anchor = docDate ?? (newest && daysBetween(newest, today) > OLD_PAPER_DAYS ? null : today);

  const candidates: Candidate[] = [];
  for (const [d, score] of scored) if (score > 2 && (!docDate || d.iso >= docDate)) candidates.push({ iso: d.iso, index: d.index, score });
  // « avant le 27 novembre » : l'année est celle du courrier (ou la suivante).
  for (const p of findPartialDates(f)) {
    if (isBirth(p.index) || !anchor) continue;
    const score = deadlineScore(p.index, p.length);
    if (score <= 2) continue;
    const iso = docDate ? resolvePartial(p, docDate, 0) : resolvePartial(p, anchor, 60);
    if (iso) candidates.push({ iso, index: p.index, score });
  }
  let best: Candidate | null = null;
  for (const c of candidates) if (!best || c.score > best.score || (c.score === best.score && c.iso < best.iso)) best = c;

  let deadline = best?.iso ?? null;
  let quote = best ? sentenceAt(text, best.index) : null;
  let deadlineRelative = false;

  // Pas de date écrite mais un délai : « dans un délai de 15 jours » à partir de la date du courrier.
  if (!deadline && anchor) {
    const dur = findDurations(f).find((x) => {
      const s = foldedSentence(f, x.index);
      return !EVENT_DELAY.test(s) && (docDate !== null || !RECOURSE_DELAY.test(s));
    });
    const due = dur ? addDuration(anchor, dur.amount, dur.unit) : null;
    // Un délai écoulé depuis des mois sur un vieux papier ne demande plus rien.
    if (dur && due && daysBetween(due, today) <= OLD_PAPER_DAYS) {
      deadline = due;
      quote = sentenceAt(text, dur.index);
      deadlineRelative = true;
    }
  }
  return { docDate, deadline, deadlineQuote: quote, deadlineRelative, expiry };
}

/** Date d'une fiche de paie : la plus récente (fin de période, paiement), jamais l'entrée ni la naissance. */
function payslipDate(f: string, today: string): string | null {
  let best: string | null = null;
  for (const d of findDates(f)) {
    const ctx = before(f, d.index, 30);
    if (d.iso > today || hasAny(ctx, BIRTH_CUES) || hasAny(ctx, NOT_DOC_DATE) || LEGAL_REF.test(before(f, d.index, 50))) continue;
    if (!best || d.iso > best) best = d.iso;
  }
  return best;
}

/** Permis de conduire européen : 4a. = délivré le, 4b. = valable jusqu'au. */
function licenceDates(f: string): { issued: string | null; expiry: string | null } {
  let issued: string | null = null;
  let expiry: string | null = null;
  for (const d of findDates(f)) {
    const ctx = before(f, d.index, 6);
    if (/4a\.?\s*$/.test(ctx)) issued ??= d.iso;
    if (/4b\.?\s*$/.test(ctx)) expiry ??= d.iso;
  }
  return { issued, expiry };
}

const UNIT_WORDS: Record<string, Record<Lang, [one: string, many: string]>> = {
  mois: { fr: ["mois", "mois"], en: ["month", "months"], es: ["mes", "meses"], ar: ["شهر", "أشهر"] },
  semaine: { fr: ["semaine", "semaines"], en: ["week", "weeks"], es: ["semana", "semanas"], ar: ["أسبوع", "أسابيع"] },
  jour: { fr: ["jour", "jours"], en: ["day", "days"], es: ["día", "días"], ar: ["يوم", "أيام"] },
};

function trialPeriod(f: string, lang: Lang): string | null {
  const m = f.match(/periode d'essai[^.\n]{0,40}?(\d{1,2}|un|une|deux|trois|quatre|six)\s+(mois|semaines?|jours?)/);
  if (!m) return null;
  const n = ({ un: "1", une: "1", deux: "2", trois: "3", quatre: "4", six: "6" } as Record<string, string>)[m[1]] ?? m[1];
  const unit = m[2].startsWith("semaine") ? "semaine" : m[2].startsWith("jour") ? "jour" : "mois";
  return `${n} ${UNIT_WORDS[unit][lang][n === "1" ? 0 : 1]}`;
}

const MONTH_NAMES = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

function payslipPeriod(f: string, lang: Lang): string | null {
  const named = f.match(new RegExp(`(?:mois|periode|paie|salaire)\\s*(?:de|du|d'|:|-)?\\s*(${MONTH_NAMES.join("|")})\\s+(\\d{4})`));
  if (named) return `${WORDS[lang].months[MONTH_NAMES.indexOf(named[1])]} ${named[2]}`;
  const m = f.match(/periode\s*(?:du|:)?\s*/);
  const from = m?.index !== undefined ? findDates(f.slice(m.index, m.index + 60))[0] : findDates(f)[0];
  if (!from) return null;
  const [y, mo] = from.iso.split("-").map(Number);
  return `${WORDS[lang].months[mo - 1]} ${y}`;
}

/** Le net réellement versé : « net payé », sinon « net à payer » qui n'est pas « avant impôt ». */
function payslipNet(f: string): number | null {
  for (const label of ["net paye", "net a payer au salarie", "net verse"]) {
    const v = amountAfterLabel(f, label);
    if (v !== null) return v;
  }
  let i = f.indexOf("net a payer");
  while (i !== -1) {
    if (!/^\s*avant impot/.test(f.slice(i + 11, i + 30))) {
      const v = amountAfterLabel(f.slice(i), "net a payer");
      if (v !== null) return v;
    }
    i = f.indexOf("net a payer", i + 1);
  }
  return amountAfterLabel(f, "net a payer");
}

function detectIntent(f: string, amount: AmountDirection | null, hasDeadline: boolean): Intent {
  if (hasAny(f, RELANCE)) return "relance";
  if (hasAny(f, INDU)) return "indu";
  if (hasAny(f, RDV)) return "rdv";
  if (hasAny(f, SEND_DOC)) return "envoyer_document";
  if (amount === "a_payer" || hasAny(f, PAY)) return "payer";
  if (hasAny(f, RIGHTS) || amount === "a_recevoir") return "droits";
  return hasDeadline ? "repondre" : "info";
}

function urgencyOf(toDo: boolean, daysLeft: number | null, severe: boolean, intent: Intent, expiryDays: number | null): Urgency {
  if (severe && toDo) return "haute";
  if (toDo && daysLeft !== null) {
    if (daysLeft <= 3) return "haute";
    if (daysLeft <= 10) return "moyenne";
    return intent === "relance" ? "moyenne" : "faible";
  }
  if (expiryDays !== null && expiryDays <= 60) return expiryDays < 0 ? "haute" : "moyenne";
  if (toDo) return intent === "relance" ? "moyenne" : "faible";
  return "aucune";
}

function uniq(items: (string | null | undefined | false)[]): string[] {
  return [...new Set(items.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

const DGFIP = ISSUERS.find((i) => i.id === "dgfip") as Issuer;

export function analyzeText(rawText: string, opts: EngineOptions): EngineResult {
  const lang = opts.language;
  const w = WORDS[lang];
  const text = cleanText(rawText);
  const folded = fold(text);
  const f = flat(folded); // indices cherchés par-dessus les retours à la ligne
  const textLines = lines(text);

  const mrz = parseMrz(textLines, Number(opts.today.slice(0, 4)));

  // Expéditeur : l'organisme reconnu, sauf s'il n'est cité que dans le corps et que l'en-tête donne un autre nom
  // (« prise en charge par l'Assurance Maladie » sur une facture d'hôpital, « cotisations URSSAF » sur une fiche de paie).
  const issuerMatch = detectIssuer(folded);
  let issuer: Issuer | null = issuerMatch?.issuer ?? null;
  let headerName: string | null = null;
  if (issuerMatch && !issuerMatch.inHeader) {
    headerName = guessSender(textLines, { strict: true, company: false });
    if (headerName) issuer = null;
  }

  const cls = classify(f, mrz, issuer, folded);
  const type = cls.type;
  const isPayslip = type === "fiche_de_paie";
  if (!issuer && !headerName && type === "avis_imposition") issuer = DGFIP; // un avis d'impôt vient toujours des Finances publiques
  // La MSA ou l'Urssaf citées sur une fiche de paie (cotisations, caisse) ne sont pas l'employeur.
  if (issuer && EMPLOYER_PAPERS.includes(type) && SOCIAL_BODIES.includes(issuer.id)) {
    const social = issuer;
    issuer = null;
    headerName = guessSender(textLines.filter((l) => !social.patterns.some((p) => indexOfWord(fold(l), p) !== -1)), { company: true });
  }

  const rdvLetter = hasAny(f, RDV);
  const dated = datedFacts(text, f, opts.today, rdvLetter);
  // Une clause d'un contrat ou d'une attestation (« dans les 48 heures ») n'est pas une date limite.
  if (dated.deadlineRelative && (NO_TODO.includes(type) || cls.info)) {
    dated.deadline = null;
    dated.deadlineQuote = null;
  }
  let docDate = isPayslip ? payslipDate(f, opts.today) ?? dated.docDate : dated.docDate;
  let expiry = mrz?.expiryDate ?? dated.expiry;
  if (type === "permis_de_conduire") {
    const lic = licenceDates(f);
    docDate = lic.issued ?? docDate;
    expiry = lic.expiry ?? expiry;
  }
  // Une attestation pour France Travail ou un contrat listent des salaires et des taux : pas un montant du papier.
  const listsWages = (type === "attestation_employeur" && cls.info) || type === "contrat_de_travail";
  let amount = isPayslip || listsWages ? null : mainAmount(f, false);
  // Le revenu fiscal de référence n'est pas une somme à payer ni à recevoir : pas de montant mis en avant.
  if (type === "avis_imposition" && amount?.direction === "information") amount = null;
  if (cls.info && type === "autre" && amount) amount = { ...amount, direction: "information" };
  const facts: KeyFact[] = findReferences(text, f);

  // Informations propres à certains papiers.
  const net = isPayslip ? payslipNet(f) : null;
  const payslipAmount = isPayslip ? (net !== null ? { value: net, direction: "a_recevoir" as const } : mainAmount(f, true)) : null;
  if (isPayslip) {
    const brut = amountAfterLabel(f, "salaire brut");
    const imposable = amountAfterLabel(f, "net imposable");
    if (brut !== null) facts.push({ label: "Salaire brut", valeur: WORDS.fr.amount(brut) });
    if (net !== null) facts.push({ label: "Net à payer", valeur: WORDS.fr.amount(net) });
    if (imposable !== null) facts.push({ label: "Net imposable", valeur: WORDS.fr.amount(imposable) });
  }
  if (mrz) {
    if (mrz.documentNumber) facts.push({ label: "N° du document", valeur: mrz.documentNumber });
    if (mrz.surname) facts.push({ label: "Nom", valeur: `${mrz.surname}${mrz.givenNames ? ` ${mrz.givenNames}` : ""}` });
  }
  const trial = type === "contrat_de_travail" ? trialPeriod(f, lang) : null;
  if (trial && lang === "fr") facts.push({ label: "Période d'essai", valeur: trial });

  const mainMoney = payslipAmount ?? amount;
  const severe = hasAny(f, SEVERE);
  const autoDebit = hasAny(f, AUTO_DEBIT);
  const paid = hasAny(f, PAID);
  const actionable: Intent[] = ["payer", "envoyer_document", "rdv", "indu", "relance", "repondre"];
  const detected = detectIntent(f, amount?.direction ?? null, dated.deadline !== null);
  const intent: Intent = cls.info && actionable.includes(detected) ? "info" : detected;
  const daysLeft = dated.deadline ? daysBetween(opts.today, dated.deadline) : null;
  const expiryDays = expiry && ID_TYPES.includes(type) ? daysBetween(opts.today, expiry) : null;

  let toDo = actionable.includes(intent);
  if (NO_TODO.includes(type)) toDo = false;
  // Une facture est à traiter si elle reste à payer (pas prélevée, pas déjà réglée) ou si c'est une relance.
  if (type === "facture") toDo = !paid && ((amount?.direction === "a_payer" && !autoDebit) || intent === "relance" || severe);
  if (type === "amende") toDo = amount?.direction === "a_payer" || dated.deadline !== null || actionable.includes(intent);
  if (type === "avis_imposition") toDo = (amount?.direction === "a_payer" && !autoDebit) || intent === "relance";
  if (ID_TYPES.includes(type)) toDo = expiryDays !== null && expiryDays <= 180;
  if (cls.info) toDo = false;

  // Un CV n'a pas d'expéditeur : la société citée est un ancien employeur.
  const sender = type === "cv" ? null : issuer?.name ?? headerName ?? (type === "autre" && !cls.label ? null : guessSender(textLines, { strict: type === "courrier_administratif" }));

  const ctx: Ctx = {
    issuer: sender,
    site: issuer?.site ?? null,
    amount: mainMoney ? w.amount(mainMoney.value) : null,
    deadline: dated.deadline ? formatDateIn(lang, dated.deadline) : null,
    expiry: expiry ? formatDateIn(lang, expiry) : null,
    period: isPayslip ? payslipPeriod(f, lang) : null,
    net: net !== null ? w.amount(net) : null,
    trial,
  };

  let resume: string;
  const useIntent = toDo && ["courrier_administratif", "autre", "document_sante", "attestation_assurance"].includes(type);
  if (useIntent || (type === "courrier_administratif" && intent !== "info")) {
    resume = w.intent[intent](ctx);
  } else {
    switch (type) {
      case "fiche_de_paie": resume = w.type.fiche_de_paie(ctx); break;
      case "contrat_de_travail": resume = w.type.contrat_de_travail(ctx); break;
      case "avis_imposition":
        resume = amount?.direction === "a_payer" ? w.type.avis_payer(ctx) : amount?.direction === "a_recevoir" ? w.type.avis_recevoir(ctx) : w.type.avis_info;
        break;
      case "facture": resume = w.type.facture(ctx); break;
      case "amende": resume = w.type.amende(ctx); break;
      case "quittance_loyer": resume = w.type.quittance(ctx); break;
      case "bail": resume = w.type.bail; break;
      case "attestation_assurance": resume = w.type.assurance(ctx); break;
      case "releve_bancaire": resume = w.type.releve(ctx); break;
      case "piece_identite":
      case "titre_de_sejour":
      case "permis_de_conduire": {
        const label = mrz?.kind === "passeport" ? w.docLabel.passeport : w.docLabel[type];
        resume = w.type.identite(ctx, label) + (expiryDays !== null && expiryDays < 0 ? w.type.expired : expiryDays !== null && expiryDays <= 180 ? w.type.soon : "");
        break;
      }
      case "carte_grise": resume = w.type.carte_grise; break;
      case "document_sante": resume = w.type.sante(ctx); break;
      case "ordonnance": resume = w.type.ordonnance; break;
      case "devis": resume = w.type.devis(ctx); break;
      case "ticket_garantie": resume = w.type.ticket(ctx); break;
      case "certificat_scolarite": resume = w.type.scolarite; break;
      case "diplome": resume = w.type.diplome; break;
      case "cv": resume = w.type.cv; break;
      case "attestation_employeur": resume = w.type.employeur; break;
      case "courrier_administratif": resume = w.intent.info(ctx); break;
      default: resume = issuer ? w.intent[intent](ctx) : w.type.autre;
    }
  }

  const a = w.actions;
  const when = ctx.deadline ? a.beforeDate(ctx.deadline) : null;
  let actions: string[] = [];
  if (toDo) {
    if (type === "amende") actions = uniq([issuer?.id === "antai" ? a.payFine : ctx.site ? a.payOnline(ctx.site) : a.payLetter, when, a.askDelay]);
    else if (type === "avis_imposition") actions = uniq([a.payTax, when, a.askDelay]);
    else if (type === "facture") actions = uniq([ctx.site ? a.payOnline(ctx.site) : a.payLetter, when, intent === "relance" ? a.askDelay : null]);
    else if (type === "piece_identite") actions = [a.renewId];
    else if (type === "titre_de_sejour") actions = [a.renewPermit];
    else if (type === "permis_de_conduire") actions = [a.renewLicence];
    else {
      switch (intent) {
        case "payer": actions = uniq([ctx.site ? a.payOnline(ctx.site) : a.payLetter, when, a.askDelay]); break;
        case "envoyer_document": actions = uniq([a.prepareDoc, ctx.site ? a.sendOnline(ctx.site) : a.sendLetter, when, a.keepCopy]); break;
        case "rdv": actions = [a.rdvNote, a.rdvPapers, a.rdvWarn]; break;
        case "indu": actions = [a.checkAmount, a.schedule, a.contest]; break;
        case "relance":
        case "repondre": actions = uniq([a.readQuote, ctx.site ? a.answerOnline(ctx.site) : a.answerLetter, when]); break;
        default: actions = [];
      }
    }
    if (severe) actions = uniq([...actions, a.getHelp]);
  }

  const month = (docDate ?? opts.today).slice(0, 7);
  const label = mrz?.kind === "passeport" ? "Passeport" : cls.label ?? DOC_TYPES[type];
  const titre = type === "autre" && !sender && !cls.label ? `${month} Papier` : `${ID_TYPES.includes(type) ? "" : `${month} `}${label}${sender ? ` – ${sender}` : ""}`;

  const scam = detectScam(text);
  const warnings = uniq([
    scam.level === "suspect" && w.scam.suspect,
    text.replace(/\s/g, "").length < 40 && w.warnings.unreadable,
    cls.confidence < 0.35 && text.length >= 40 && w.warnings.unsure,
    mrz && !mrz.checksOk && w.warnings.mrz,
  ]);

  const urgence = urgencyOf(toDo, daysLeft, severe, intent, expiryDays);

  // Arnaque probable : jamais « à payer », aucun rappel, aucun organisme prêté au fraudeur. Seulement les bons réflexes.
  if (scam.level === "arnaque_probable") {
    return {
      type_document: "autre",
      categorie: "autre",
      titre: `${month} Arnaque probable`,
      emetteur: null,
      date_document: docDate,
      resume: w.scam.warning,
      a_traiter: false,
      actions: w.scam.actions,
      urgence: "aucune",
      date_limite: null,
      date_limite_objet: null,
      date_limite_extrait: null,
      date_expiration: null,
      montant: null,
      montant_sens: null,
      infos_cles: [],
      mots_cles: ["arnaque"],
      texte: text,
      avertissement: w.scam.warning,
      confiance: 1,
      organisme: null,
      intention: "info",
      arnaque: scam,
    };
  }

  return {
    type_document: type,
    categorie: cls.category,
    titre: titre.trim(),
    emetteur: sender,
    date_document: docDate,
    resume,
    a_traiter: toDo,
    actions,
    urgence,
    date_limite: dated.deadline,
    date_limite_objet: dated.deadline ? w.objet[intent] : null,
    date_limite_extrait: dated.deadlineQuote,
    date_expiration: expiry,
    montant: mainMoney?.value ?? null,
    montant_sens: mainMoney?.direction ?? null,
    infos_cles: facts.slice(0, 10),
    mots_cles: uniq([sender, DOC_TYPES[type], cls.label, issuer?.id, severe && "urgent", intent !== "info" && intent]),
    texte: text,
    avertissement: warnings.length ? warnings.join(" ") : null,
    confiance: cls.confidence,
    organisme: issuer?.id ?? null,
    intention: intent,
    arnaque: scam.level === "aucun" ? null : scam,
  };
}

// Petite aide pour les tests et le débogage : ce que le moteur a vu autour d'une position.
export function debugContext(folded: string, index: number): string {
  return `${before(folded, index, 30)}⟨${after(folded, index, 30)}⟩`;
}
