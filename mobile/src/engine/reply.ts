export type ReplyGoal =
  | "delai" | "contester" | "explications" | "justificatif" | "resilier"
  | "recours_gracieux" | "reclamer_somme" | "depot_garantie" | "resiliation_assurance";

export const REPLY_GOALS: { id: ReplyGoal; label: string }[] = [
  { id: "delai", label: "Demander un délai de paiement" },
  { id: "contester", label: "Contester" },
  { id: "explications", label: "Demander des explications" },
  { id: "justificatif", label: "Envoyer le justificatif demandé" },
  { id: "resilier", label: "Résilier le contrat" },
  { id: "recours_gracieux", label: "Demander de revoir une décision (recours gracieux)" },
  { id: "reclamer_somme", label: "Réclamer une somme qu'on me doit" },
  { id: "depot_garantie", label: "Réclamer mon dépôt de garantie" },
  { id: "resiliation_assurance", label: "Résilier une assurance (contrat de plus d'un an)" },
];

export interface ReplyInput {
  goal: ReplyGoal;
  sender: string; // plusieurs lignes, ou vide
  issuer: string | null;
  docTitle: string;
  docDate: string | null; // AAAA-MM-JJ
  amount: number | null;
  references: { label: string; valeur: string }[];
  details: string;
  today: string; // AAAA-MM-JJ
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

function euros(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function writeReply(input: ReplyInput): string {
  const senderBlock = input.sender.trim() || "[Prénom Nom]\n[Adresse]\n[Code postal Ville]";
  const recipient = input.issuer ?? "[Nom de l'organisme]";
  const about = input.docDate ? `votre courrier du ${longDate(input.docDate)}` : "votre courrier";
  const amount = input.amount !== null ? euros(input.amount) : "[montant]";
  const refs = input.references.length
    ? input.references.map((r) => `${r.label} : ${r.valeur}`).join("\n")
    : "Référence : [numéro de dossier]";
  const details = input.details.trim();

  const bodies: Record<ReplyGoal, { objet: string; body: string[]; recommande?: boolean }> = {
    delai: {
      objet: "Demande de délai de paiement",
      body: [
        `J'ai bien reçu ${about} me demandant de régler la somme de ${amount}.`,
        "En raison de difficultés financières passagères, je ne suis pas en mesure de payer cette somme en une seule fois. Je vous demande donc de bien vouloir m'accorder un délai de paiement ou un échéancier.",
        details ? `Je vous propose la solution suivante : ${details}` : "Je vous propose de régler cette somme en [nombre] mensualités de [montant] à partir du [date].",
        "Je reste à votre disposition pour tout justificatif de ma situation.",
      ],
    },
    contester: {
      objet: "Contestation",
      body: [
        `J'ai bien reçu ${about}${input.amount !== null ? ` concernant la somme de ${amount}` : ""}.`,
        "Je souhaite contester cette décision pour les raisons suivantes :",
        details || "[Explique ici, simplement, pourquoi tu n'es pas d'accord]",
        "Je vous remercie de bien vouloir réexaminer mon dossier et de m'indiquer la suite donnée à ma demande. Vous trouverez ci-joint les justificatifs utiles.",
      ],
    },
    explications: {
      objet: "Demande d'explications",
      body: [
        `J'ai bien reçu ${about}.`,
        "Certains points ne sont pas clairs pour moi. Je vous serais reconnaissant de bien vouloir m'expliquer :",
        details || "[Ce que tu n'as pas compris : le montant, la période, ce qu'il faut faire…]",
        "Je vous remercie par avance de votre réponse.",
      ],
    },
    justificatif: {
      objet: "Envoi du justificatif demandé",
      body: [
        `Suite à ${about}, vous trouverez ci-joint le document demandé${details ? ` : ${details}` : " : [nom du document]"}.`,
        "Je vous remercie de bien vouloir l'ajouter à mon dossier et de me confirmer sa bonne réception.",
      ],
    },
    resilier: {
      objet: "Résiliation de contrat",
      body: [
        `Par la présente, je vous informe de ma volonté de résilier mon contrat${input.references.length ? " dont les références figurent ci-dessus" : ""}.`,
        details ? `Précisions : ${details}` : "Je vous remercie de bien vouloir prendre en compte cette résiliation à la date la plus proche prévue par le contrat.",
        "Je vous remercie de m'adresser une confirmation écrite de cette résiliation, ainsi que le solde éventuel de mon compte.",
      ],
    },
    recours_gracieux: {
      objet: "Recours gracieux",
      recommande: true,
      body: [
        `Par la présente, je forme un recours gracieux contre la décision figurant dans ${about}.`,
        "Cette décision me semble devoir être revue pour les raisons suivantes :",
        details || "[Explique simplement pourquoi la décision est injuste ou erronée, avec les dates et les montants]",
        "Je vous demande donc de bien vouloir réexaminer ma situation. Vous trouverez ci-joint les pièces justificatives.",
      ],
    },
    reclamer_somme: {
      objet: "Réclamation d'une somme due",
      recommande: true,
      body: [
        `${about.charAt(0).toUpperCase()}${about.slice(1)} m'annonçait le versement de la somme de ${amount}.`,
        "À ce jour, je n'ai rien reçu sur mon compte.",
        details || "Je vous remercie de bien vouloir procéder à ce versement dans les meilleurs délais, ou de m'indiquer la raison du retard.",
      ],
    },
    depot_garantie: {
      objet: "Restitution du dépôt de garantie",
      recommande: true,
      body: [
        "J'ai quitté le logement que je louais et vous ai remis les clés le [date de remise des clés].",
        `Conformément à l'article 22 de la loi du 6 juillet 1989, le dépôt de garantie de ${amount} devait m'être restitué dans un délai d'un mois (deux mois en cas de différences entre les états des lieux d'entrée et de sortie).`,
        "Ce délai est dépassé. Je vous rappelle que le dépôt de garantie est alors majoré de 10 % du loyer mensuel hors charges pour chaque mois de retard commencé.",
        details || "Je vous demande de me verser la somme due, majoration comprise, sous huit jours, sur le compte dont le RIB est joint.",
        "À défaut, je me réserve la possibilité de saisir la commission départementale de conciliation, puis le tribunal.",
      ],
    },
    resiliation_assurance: {
      objet: "Résiliation de mon contrat d'assurance",
      recommande: true,
      body: [
        `Mon contrat${input.references.length ? " dont les références figurent ci-dessus" : " n° [numéro de contrat]"} a été souscrit il y a plus d'un an.`,
        "Conformément à l'article L113-15-2 du Code des assurances (loi Hamon), je vous informe de ma décision de le résilier. La résiliation prend effet un mois après la réception de ce courrier.",
        details || "Je vous remercie de me rembourser la part de cotisation correspondant à la période non couverte, et de m'adresser une confirmation écrite.",
      ],
    },
  };

  const { objet, body, recommande } = bodies[input.goal];
  return [
    senderBlock,
    "",
    recipient,
    "[Adresse de l'organisme]",
    "",
    `[Ville], le ${longDate(input.today)}`,
    "",
    `Objet : ${objet}`,
    refs,
    ...(recommande ? ["Lettre recommandée avec accusé de réception"] : []),
    "",
    "Madame, Monsieur,",
    "",
    ...body.flatMap((p) => [p, ""]),
    "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    "",
    input.sender.trim().split("\n")[0] || "[Signature]",
  ].join("\n");
}
