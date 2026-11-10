import { editDistance, fold, indexOfWord } from "./normalize.ts";

export type ScamLevel = "aucun" | "suspect" | "arnaque_probable";

export interface ScamLink {
  url: string;
  domain: string;
  official: boolean;
  /** Organisme dont le lien prend l'apparence, s'il n'est pas le sien. */
  impersonates: string | null;
}

export interface ScamReport {
  level: ScamLevel;
  score: number;
  reasons: string[];
  links: ScamLink[];
}

interface Brand {
  name: string;
  /** Mots qui désignent l'organisme dans un message (texte replié). */
  words: string[];
  /** Mots qui, dans un nom de domaine, imitent l'organisme. */
  lure: string[];
  domains: string[];
}

// Domaines officiels. Un sous-domaine d'un domaine officiel est officiel (« www.ameli.fr », « assure.ameli.fr »).
const BRANDS: Brand[] = [
  { name: "l'Assurance Maladie (Ameli)", words: ["ameli", "assurance maladie", "carte vitale", "cpam"], lure: ["ameli", "vitale", "cpam", "assurancemaladie"], domains: ["ameli.fr"] },
  { name: "la CAF", words: ["caf", "allocations familiales"], lure: ["caf", "allocationsfamiliales"], domains: ["caf.fr", "mon-enfant.fr"] },
  { name: "les impôts", words: ["impots", "finances publiques", "dgfip", "remboursement d'impot"], lure: ["impots", "impot", "dgfip", "financespubliques"], domains: ["impots.gouv.fr"] },
  { name: "l'ANTAI (amendes)", words: ["antai", "avis de contravention", "amende"], lure: ["antai", "amendes", "amende", "contravention"], domains: ["antai.gouv.fr", "amendes.gouv.fr"] },
  { name: "Mon Compte Formation (CPF)", words: ["cpf", "compte formation", "moncompteformation"], lure: ["cpf", "moncompteformation", "compteformation"], domains: ["moncompteformation.gouv.fr"] },
  { name: "France Travail", words: ["france travail", "pole emploi"], lure: ["francetravail", "france-travail", "poleemploi", "pole-emploi"], domains: ["francetravail.fr", "pole-emploi.fr"] },
  { name: "l'ANTS (carte grise, permis, papiers)", words: ["ants", "carte grise", "certificat d'immatriculation", "crit'air", "vignette"], lure: ["ants", "cartegrise", "critair"], domains: ["ants.gouv.fr", "certificat-air.gouv.fr"] },
  { name: "La Poste / Colissimo / Chronopost", words: ["la poste", "colissimo", "chronopost", "votre colis", "livraison de votre colis", "livraison suspendue", "echec de livraison"], lure: ["laposte", "colissimo", "chronopost"], domains: ["laposte.fr", "laposte.net", "colissimo.fr", "chronopost.fr"] },
  { name: "l'Urssaf", words: ["urssaf"], lure: ["urssaf"], domains: ["urssaf.fr"] },
  { name: "l'Assurance retraite", words: ["assurance retraite", "carsat"], lure: ["lassuranceretraite", "carsat"], domains: ["lassuranceretraite.fr", "info-retraite.fr"] },
  { name: "ta banque", words: ["votre banque", "conseiller bancaire", "service fraude", "votre compte bancaire", "credit agricole", "banque postale", "bnp", "societe generale", "caisse d'epargne", "lcl", "credit mutuel"], lure: ["creditagricole", "bnp", "bnpparibas", "societegenerale", "labanquepostale", "caisseepargne", "lcl", "creditmutuel", "banquepopulaire"], domains: ["credit-agricole.fr", "labanquepostale.fr", "mabanque.bnpparibas", "bnpparibas", "societegenerale.fr", "caisse-epargne.fr", "lcl.fr", "creditmutuel.fr", "banquepopulaire.fr"] },
  { name: "EDF / Engie (énergie)", words: ["edf", "engie", "cheque energie"], lure: ["edf", "engie", "chequeenergie"], domains: ["edf.fr", "engie.fr", "chequeenergie.gouv.fr"] },
];

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "urlz.fr", "rebrand.ly", "shorturl.at", "s.id", "tiny.cc", "ow.ly", "rb.gy", "t.ly", "lnkd.in"];
const RISKY_TLDS = ["xyz", "top", "online", "site", "shop", "click", "live", "support", "help", "info", "pw", "cc", "ru", "cn", "icu", "buzz", "cyou", "rest", "monster", "sbs", "lol", "quest"];

// Autres sites publics officiels souvent cités dans les vrais courriers.
const OTHER_OFFICIAL = [
  "service-public.fr", "service-public.gouv.fr", "msa.fr", "mon-enfant.fr", "monespacesante.fr", "agirc-arrco.fr",
  "net-entreprises.fr", "info-retraite.fr", "labanquepostale.fr", "legifrance.gouv.fr",
];

// Toute adresse « *.gouv.fr » est officielle.
function isOfficial(domain: string): boolean {
  if (domain === "gouv.fr" || domain.endsWith(".gouv.fr")) return true;
  const all = [...OTHER_OFFICIAL, ...BRANDS.flatMap((b) => b.domains)];
  return all.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// URL (http, www) ou nom de domaine nu (« ameli-remboursement.com »). Bornés : pas de blocage possible.
const URL = /(?:https?:\/\/|www\.)[^\s<>"')\]]{2,200}|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,4}(?:fr|com|net|org|eu|info|xyz|top|online|site|shop|click|live|support|help|pw|cc|ru|cn|icu|buzz|cyou|io|me|co|app|link|ly|gl|gd|at|id|sbs|lol|quest|rest|monster|fi|de|it|es|be|ch|uk|us|biz|tk|ml|ga|cf|gq|vip|work|fun|space|website|store|tech|cloud|cam|mobi|win|bid|loan|men|stream|download)(?![a-z0-9-])(?:\/[^\s<>"')\]]{0,200})?/gi;

function domainOf(url: string): string {
  const s = url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  return s.split(/[/?#:]/)[0].replace(/\.$/, "");
}

/** Cherche un mot-appât dans un nom de domaine : « ameli-remboursement.com » imite Ameli.
 *  Mots courts (« caf », « cpf ») : seulement en mot entier, pour ne pas viser « cafedelaplace.fr » ni « amelie-boutique.fr ». */
function luredBrand(domain: string): { name: string } | null {
  const name = domain.replace(/\.[a-z]+$/, "");
  const tokens = name.split(/[.-]/);
  const joined = name.replace(/[.-]/g, "");
  const hit = (l: string) => {
    const lure = l.replace(/-/g, "");
    if (tokens.includes(lure)) return true;
    if (lure.length >= 6 && tokens.some((t) => t.startsWith(lure))) return true;
    return lure.length >= 7 && joined.includes(lure);
  };
  for (const b of BRANDS) if (b.lure.some(hit)) return b;
  if (tokens.some((t) => t === "gouv" || t.startsWith("gouv"))) return { name: "un site officiel de l'État (.gouv.fr)" };
  return null;
}

const CREDENTIALS = [
  "numero de carte", "numero de votre carte", "cryptogramme", "date d'expiration de votre carte", "code de confirmation",
  "code recu par sms", "code que vous allez recevoir", "communiquez-nous le code", "transmettez le code", "donnez le code",
  "communiquer le code", "mot de passe", "vos identifiants", "validez votre identite", "confirmez vos informations",
  "mettre a jour vos informations", "verifier vos informations", "mettez a jour vos coordonnees bancaires",
];
const PAY_BY_LINK = [
  "frais de livraison", "frais de reexpedition", "frais de port", "frais de dedouanement", "regler les frais", "payer les frais",
  "cliquez sur le lien", "cliquez ici", "en cliquant sur", "via le lien", "suivez ce lien", "lien ci-dessous", "rendez-vous sur",
  "payez", "reglez", "de frais", "connectez-vous", "identifiez-vous",
];
const URGENCY = [
  "dernier avis", "dernier rappel avant", "sous 24h", "sous 24 h", "sous 48h", "immediatement", "sans delai", "aujourd'hui avant minuit",
  "sera suspendu", "sera bloque", "sera desactive", "sera supprime", "expire aujourd'hui", "expirent", "avant suppression", "action requise",
  "connexion inhabituelle", "activite suspecte", "derniere relance",
];
const BAIT = [
  "vous avez droit a un remboursement", "remboursement en attente", "remboursement de", "vous etes eligible", "gagne", "felicitations",
  "vos droits cpf", "solde cpf", "colis en attente", "colis bloque", "livraison suspendue", "nouvelle carte vitale", "carte vitale expire",
];
const COUPONS = ["pcs", "transcash", "neosurf", "paysafecard", "bitcoin", "crypto-monnaie", "western union", "coupon recharge", "carte cadeau"];
const PREMIUM_PHONE = /(?<!\d)08\s?9\d(?:[\s.]?\d{2}){3}(?!\d)/;

/** Sur un long papier scanné, « tmpats.gouv.fi » ou « seruice-public.fr » sont l'adresse officielle mal lue
 *  (pas un piège : les arnaques arrivent par SMS ou mail courts). */
function misreadOfficial(raw: string): boolean {
  const domain = raw.replace(/[;,]/g, ".");
  // « gouv.fi », « gouv.tr » : le « fr » mal lu (« gouv.co » reste suspect).
  const tld = domain.match(/(?:^|\.)gouv\.([a-z]{1,3})$/)?.[1];
  if (tld && editDistance(tld, "fr") <= 1) return true;
  // « impots.gouv.fr.ou » : un petit mot collé derrière l'adresse (« impots.gouv.fr.secure.com » reste suspect).
  const parts = domain.split(".");
  const last = parts[parts.length - 1];
  const realTld = /^(?:com|net|org|info|fr|eu|io|co|me|app|biz|xyz|top|site|online|shop|pw|cc|ru|cn)$/.test(last); // « impots.gouv.fr.com » reste suspect
  const trimmed = parts.length > 2 && last.length <= 3 && !realTld ? parts.slice(0, -1).join(".") : domain;
  if (trimmed !== domain && isOfficial(trimmed)) return true;
  const bare = trimmed.replace(/^w[a-z]{1,2}\./, "");
  return [...OTHER_OFFICIAL, ...BRANDS.flatMap((b) => b.domains)].some((d) => d.length >= 8 && editDistance(bare, d) <= 3);
}

/** « des impôts », « de la CAF », « d'EDF », « de l'Urssaf ». */
function ofName(name: string): string {
  if (name.startsWith("les ")) return `des ${name.slice(4)}`;
  if (name.startsWith("le ")) return `du ${name.slice(3)}`;
  return /^[aeiouyéèAEIOUYÉÈ]/.test(name) ? `d'${name}` : `de ${name}`;
}

/** Un papier long et sur plusieurs lignes (courrier, fiche, attestation), pas un message. */
function looksLikeLongPaper(text: string): boolean {
  return (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length > 800 && text.split("\n").length >= 10;
}

export function detectScam(text: string): ScamReport {
  const f = fold(text).replace(/\n/g, " ");
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, why: string) => {
    if (!reasons.includes(why)) {
      reasons.push(why);
      score += pts;
    }
  };

  // Liens et domaines.
  const links: ScamLink[] = [];
  const seen = new Set<string>();
  const longPaper = looksLikeLongPaper(text);
  for (const m of text.matchAll(URL)) {
    const prev = text[(m.index ?? 0) - 1];
    if (prev === "@") continue; // adresse mail
    const domain = domainOf(m[0]);
    if (!domain.includes(".") || seen.has(domain)) continue;
    seen.add(domain);
    const official = isOfficial(domain) || (longPaper && misreadOfficial(domain));
    const lure = official ? null : luredBrand(domain);
    links.push({ url: m[0], domain, official, impersonates: lure?.name ?? null });
  }

  const mentioned = BRANDS.filter((b) => b.words.some((w) => indexOfWord(f, w) !== -1));
  const foreign = links.filter((l) => !l.official);

  for (const l of foreign) {
    if (l.impersonates) add(6, `Le lien « ${l.domain} » imite ${l.impersonates}, mais ce n'est pas son vrai site.`);
    if (SHORTENERS.some((s) => l.domain === s || l.domain.endsWith(`.${s}`))) add(3, `Le lien « ${l.domain} » est raccourci : on ne voit pas où il mène.`);
    const tld = l.domain.split(".").pop() ?? "";
    if (RISKY_TLDS.includes(tld)) add(2, `Le lien se termine par « .${tld} », une terminaison très utilisée par les arnaques.`);
  }
  // Un long courrier qui cite l'Urssaf ET le site de l'employeur n'est pas suspect ; seul un lien qui se déguise compte.
  const misleading = longPaper ? foreign.filter((l) => l.impersonates) : foreign;
  if (mentioned.length && misleading.length) {
    const b = mentioned[0];
    add(3, `Le message parle ${ofName(b.name)}, mais envoie vers un autre site (${misleading[0].domain}). Le vrai site : ${b.domains[0]}.`);
  }

  if (CREDENTIALS.some((c) => indexOfWord(f, c) !== -1)) {
    // « Ne communiquez jamais ce code » est un conseil de sécurité, pas une demande.
    const warning = /ne (?:le |la |les )?(?:communiquez|transmettez|donnez|partagez) (?:jamais|a personne|pas)/.test(f);
    if (!warning) {
      add(4, "On te demande un code, un mot de passe ou ta carte bancaire : une administration ne le fait jamais par message.");
      if (foreign.length) add(3, "Et on te demande de les donner sur un site qui n'est pas officiel.");
    }
  }
  if (PREMIUM_PHONE.test(f)) add(2, "Le numéro à rappeler commence par 089 : un numéro surtaxé.");
  if (foreign.length && PAY_BY_LINK.some((c) => indexOfWord(f, c) !== -1)) add(2, "On te pousse à cliquer sur un lien pour payer ou te connecter.");
  const urgent = URGENCY.filter((c) => indexOfWord(f, c) !== -1).length;
  if (urgent && (foreign.length || score > 0)) add(Math.min(2, urgent), "Le message te presse (délai très court, menace de blocage) : c'est une technique d'arnaque.");
  if (BAIT.some((c) => indexOfWord(f, c) !== -1) && (foreign.length || score > 0)) add(2, "Le message promet de l'argent ou annonce un colis / une carte à débloquer.");
  if (COUPONS.some((c) => indexOfWord(f, c) !== -1) && /payer|paiement|regler|achetez|acheter|code/.test(f)) {
    add(6, "Paiement demandé en coupons, cartes cadeaux ou cryptomonnaie : aucune administration ne fait ça.");
  }

  const level: ScamLevel = score >= 6 ? "arnaque_probable" : score >= 3 ? "suspect" : "aucun";
  return { level, score, reasons, links };
}

/** Ce qu'il faut faire face à une arnaque probable (affiché à la place des étapes habituelles). */
export const SCAM_ACTIONS = [
  "Ne clique sur aucun lien, ne paie rien, ne donne aucun code.",
  "Vérifie toi-même en tapant l'adresse du vrai site, ou en appelant le numéro inscrit sur un vrai courrier.",
  "SMS : transfère-le au 33700 (signalement gratuit). Mail : signale-le sur signal-spam.fr.",
  "Si tu as déjà donné ta carte ou un code : appelle tout de suite ta banque pour faire opposition, puis va sur cybermalveillance.gouv.fr.",
];
