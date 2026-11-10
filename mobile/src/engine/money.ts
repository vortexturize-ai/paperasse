// Dépôt de garantie : loi n° 89-462 du 6 juillet 1989, art. 22.
import { daysBetween } from "./dates.ts";
import { fold, hasAny } from "./normalize.ts";
import { paperDate, type Paper } from "./vault.ts";

export interface MoneyLead {
  id: string;
  kind: "remboursement_attendu" | "mutuelle" | "hausse_assurance" | "double_facture" | "prime_activite";
  title: string;
  detail: string;
  amount: number | null;
  paperIds: string[];
}

const INSURERS = ["axa", "maif", "macif", "matmut", "allianz", "groupama", "gmf"];
const PROMISE = ["sera rembourse", "vous sera rembourse", "sera verse", "sera vire", "restitution", "solde en votre faveur", "remboursement", "degrevement", "vous est accorde"];
const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Dépôt de garantie non rendu : à rendre 1 mois après la remise des clés (2 mois s'il y a des dégâts) ;
 *  ensuite +10 % du loyer mensuel hors charges par mois de retard commencé (loi du 6 juillet 1989, art. 22). */
export function depositClaim(input: { rent: number; deposit: number; keysReturned: string; damages: boolean; today: string }): { due: string; late: boolean; monthsLate: number; penalty: number; total: number } {
  const [y, m, d] = input.keysReturned.split("-").map(Number);
  const dueDate = new Date(Date.UTC(y, m - 1 + (input.damages ? 2 : 1), d)).toISOString().slice(0, 10);
  const lateDays = daysBetween(dueDate, input.today);
  let monthsLate = 0;
  if (lateDays > 0) {
    // Chaque mois commencé compte.
    let cursor = dueDate;
    while (cursor < input.today) {
      monthsLate++;
      const [cy, cm, cd] = cursor.split("-").map(Number);
      cursor = new Date(Date.UTC(cy, cm, cd)).toISOString().slice(0, 10);
    }
  }
  const penalty = Math.round(input.rent * 0.1 * monthsLate * 100) / 100;
  return { due: dueDate, late: monthsLate > 0, monthsLate, penalty, total: Math.round((input.deposit + penalty) * 100) / 100 };
}

export function findMoney(papers: Paper[], today: string): MoneyLead[] {
  const leads: MoneyLead[] = [];

  // 1. Argent promis par un papier, pas encore marqué « reçu ».
  for (const p of papers) {
    if (p.done || p.amountDirection !== "a_recevoir" || p.amount === null) continue;
    if (["fiche_de_paie", "releve_bancaire", "ticket_garantie"].includes(p.type)) continue;
    const age = daysBetween(paperDate(p), today);
    if (age < 30 || age > 730) continue;
    if (!hasAny(fold(p.text), PROMISE)) continue;
    leads.push({
      id: `promis-${p.id}`, kind: "remboursement_attendu",
      title: `As-tu bien reçu ${eur(p.amount)} ?`,
      detail: `${p.issuer ?? "Un organisme"} annonçait cette somme il y a ${age} jours. Regarde ton relevé de compte ; si rien n'est arrivé, réclame-la (bouton « Écrire une réponse »). Si tu l'as reçue, marque le papier « C'est fait ».`,
      amount: p.amount, paperIds: [p.id],
    });
  }

  // 2. Remboursement de l'Assurance Maladie sans décompte de la mutuelle ensuite.
  const cpam = papers.filter((p) => p.organisme === "cpam" && p.type === "document_sante" && p.amountDirection === "a_recevoir")
    .sort((a, b) => paperDate(b).localeCompare(paperDate(a)))[0];
  if (cpam && daysBetween(paperDate(cpam), today) >= 30) {
    const mutuelle = papers.some((p) => p.type === "document_sante" && p.organisme !== "cpam"
      && hasAny(fold(p.text), ["mutuelle", "complementaire"]) && daysBetween(paperDate(cpam), paperDate(p)) >= -5 && daysBetween(paperDate(cpam), paperDate(p)) <= 60);
    if (!mutuelle && !hasAny(fold(cpam.text), ["complementaire sante solidaire", "100 %", "100%"])) {
      leads.push({
        id: `mutuelle-${cpam.id}`, kind: "mutuelle",
        title: "Ta mutuelle a-t-elle complété ce remboursement ?",
        detail: "L'Assurance Maladie a remboursé une partie de tes soins. Si tu as une mutuelle, elle doit souvent compléter : vérifie ton compte ou envoie-lui le décompte.",
        amount: null, paperIds: [cpam.id],
      });
    }
  }

  // 3. Assurance qui augmente d'une année sur l'autre.
  for (const org of INSURERS) {
    const bills = papers.filter((p) => p.organisme === org && p.amount !== null && p.amountDirection === "a_payer")
      .sort((a, b) => paperDate(a).localeCompare(paperDate(b)));
    if (bills.length < 2) continue;
    const [prev, last] = bills.slice(-2);
    const gap = daysBetween(paperDate(prev), paperDate(last));
    if (gap < 300 || gap > 450 || prev.amount === null || last.amount === null || prev.amount <= 0) continue;
    const rise = (last.amount - prev.amount) / prev.amount;
    if (rise > 0.03) {
      leads.push({
        id: `hausse-${last.id}`, kind: "hausse_assurance",
        title: `${last.issuer ?? org.toUpperCase()} : +${Math.round(rise * 100)} % en un an`,
        detail: `${eur(prev.amount)} → ${eur(last.amount)}. Après 1 an de contrat, une assurance auto ou habitation se résilie à tout moment, sans frais : compare les prix (le nouvel assureur peut faire la résiliation pour toi).`,
        amount: Math.round((last.amount - prev.amount) * 100) / 100, paperIds: [prev.id, last.id],
      });
    }
  }

  // 4. Deux factures identiques du même expéditeur à quelques jours d'écart.
  const bills = papers.filter((p) => p.type === "facture" && p.amount !== null && p.amountDirection === "a_payer");
  const seen = new Set<string>();
  for (let i = 0; i < bills.length; i++) {
    for (let j = i + 1; j < bills.length; j++) {
      const a = bills[i];
      const b = bills[j];
      const sameSender = (a.organisme && a.organisme === b.organisme) || (a.issuer && a.issuer === b.issuer);
      if (!sameSender || a.amount !== b.amount || Math.abs(daysBetween(paperDate(a), paperDate(b))) > 7) continue;
      if (fold(a.text) === fold(b.text)) continue; // le même papier ajouté deux fois, pas une double facture
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push({
        id: `double-${key}`, kind: "double_facture",
        title: `Deux factures de ${eur(a.amount ?? 0)} chez ${a.issuer ?? "le même expéditeur"}`,
        detail: "À quelques jours d'écart. Vérifie que tu n'as pas été prélevé deux fois ; si oui, réclame le remboursement.",
        amount: a.amount, paperIds: [a.id, b.id],
      });
    }
  }

  // 5. Petit salaire, aucune trace de prime d'activité : simulation conseillée.
  const lastPay = papers.filter((p) => p.type === "fiche_de_paie" && p.amount !== null).sort((a, b) => paperDate(b).localeCompare(paperDate(a)))[0];
  const hasPrime = papers.some((p) => hasAny(fold(p.text), ["prime d'activite"]));
  if (lastPay && lastPay.amount !== null && lastPay.amount < 2000 && !hasPrime && daysBetween(paperDate(lastPay), today) <= 92) {
    leads.push({
      id: `prime-${lastPay.id}`, kind: "prime_activite",
      title: "Tu as peut-être droit à la prime d'activité",
      detail: `Avec un salaire net autour de ${eur(lastPay.amount)}, beaucoup de personnes y ont droit (cela dépend du foyer). La simulation prend 5 minutes sur caf.fr.`,
      amount: null, paperIds: [lastPay.id],
    });
  }
  return leads;
}
