export type Lang = "fr" | "en" | "es" | "ar";

export const LANGUAGE_NAMES: Record<Lang, string> = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
  ar: "arabe",
};

export function langFromName(name: string | null | undefined): Lang {
  const entry = (Object.entries(LANGUAGE_NAMES) as [Lang, string][]).find(([, n]) => n === name);
  return entry ? entry[0] : "fr";
}

export type Intent = "payer" | "envoyer_document" | "rdv" | "indu" | "relance" | "droits" | "repondre" | "info";

export interface Ctx {
  issuer: string | null;
  site: string | null;
  amount: string | null; // déjà mis en forme
  deadline: string | null; // déjà mise en forme
  expiry: string | null;
  period: string | null;
  net: string | null;
  trial: string | null;
}

export interface Words {
  months: string[];
  amount: (n: number) => string;
  date: (d: number, month: string, y: number) => string;
  someone: string;
  objet: Record<Intent, string>;
  intent: Record<Intent, (c: Ctx) => string>;
  type: {
    fiche_de_paie: (c: Ctx) => string;
    contrat_de_travail: (c: Ctx) => string;
    avis_payer: (c: Ctx) => string;
    avis_recevoir: (c: Ctx) => string;
    avis_info: string;
    facture: (c: Ctx) => string;
    amende: (c: Ctx) => string;
    quittance: (c: Ctx) => string;
    bail: string;
    assurance: (c: Ctx) => string;
    releve: (c: Ctx) => string;
    identite: (c: Ctx, label: string) => string;
    soon: string;
    expired: string;
    carte_grise: string;
    sante: (c: Ctx) => string;
    ordonnance: string;
    devis: (c: Ctx) => string;
    ticket: (c: Ctx) => string;
    scolarite: string;
    diplome: string;
    cv: string;
    employeur: string;
    autre: string;
  };
  docLabel: { piece_identite: string; passeport: string; titre_de_sejour: string; permis_de_conduire: string };
  actions: {
    payOnline: (site: string) => string;
    payLetter: string;
    beforeDate: (d: string) => string;
    askDelay: string;
    prepareDoc: string;
    sendOnline: (site: string) => string;
    sendLetter: string;
    keepCopy: string;
    rdvNote: string;
    rdvPapers: string;
    rdvWarn: string;
    checkAmount: string;
    schedule: string;
    contest: string;
    getHelp: string;
    readQuote: string;
    answerOnline: (site: string) => string;
    answerLetter: string;
    renewId: string;
    renewPermit: string;
    renewLicence: string;
    payFine: string;
    payTax: string;
  };
  warnings: { unreadable: string; unsure: string; mrz: string; pdf: string };
  /** Message reconnu comme arnaque (détecteur scam.ts). */
  scam: { warning: string; suspect: string; actions: string[] };
}

const fr: Words = {
  months: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  amount: (n) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
  date: (d, m, y) => `${d} ${m} ${y}`,
  someone: "L'organisme",
  objet: {
    payer: "payer",
    envoyer_document: "envoyer le document demandé",
    rdv: "aller au rendez-vous",
    indu: "rembourser ou contester",
    relance: "répondre ou payer",
    droits: "vérifier tes droits",
    repondre: "répondre",
    info: "lire ce courrier",
  },
  intent: {
    payer: (c) => `${c.issuer ?? "L'organisme"} te demande de payer${c.amount ? ` ${c.amount}` : ""}${c.deadline ? ` avant le ${c.deadline}` : ""}.`,
    envoyer_document: (c) => `${c.issuer ?? "L'organisme"} te demande d'envoyer un document${c.deadline ? ` avant le ${c.deadline}` : ""}. Sans réponse, ton dossier peut être bloqué.`,
    rdv: (c) => `${c.issuer ?? "L'organisme"} te donne un rendez-vous${c.deadline ? ` le ${c.deadline}` : ""}.`,
    indu: (c) => `${c.issuer ?? "L'organisme"} te demande de rembourser ${c.amount ?? "une somme"}${c.deadline ? ` avant le ${c.deadline}` : ""}.`,
    relance: (c) => `C'est une relance de ${c.issuer ?? "l'organisme"} : une réponse ou un paiement est attendu${c.deadline ? ` avant le ${c.deadline}` : ""}.`,
    droits: (c) => `${c.issuer ?? "L'organisme"} t'informe de tes droits${c.amount ? ` : ${c.amount}` : ""}. Rien à faire, garde ce courrier.`,
    repondre: (c) => `Courrier de ${c.issuer ?? "un organisme"}${c.deadline ? ` : il faut agir avant le ${c.deadline}` : ""}.`,
    info: (c) => `Courrier d'information de ${c.issuer ?? "un organisme"}. Rien à faire pour l'instant.`,
  },
  type: {
    fiche_de_paie: (c) => `Fiche de paie${c.period ? ` (${c.period})` : ""}${c.net ? ` : ${c.net} net` : ""}. Garde-la toute ta vie : elle sert pour la retraite.`,
    contrat_de_travail: (c) => `Contrat de travail${c.issuer ? ` avec ${c.issuer}` : ""}${c.trial ? `, période d'essai de ${c.trial}` : ""}. À garder précieusement.`,
    avis_payer: (c) => `Avis d'impôt : ${c.amount ?? "une somme"} à payer${c.deadline ? ` avant le ${c.deadline}` : ""}.`,
    avis_recevoir: (c) => `Avis d'impôt : tu vas être remboursé de ${c.amount}.`,
    avis_info: "Avis d'impôt : il sert de justificatif de revenus. Garde-le au moins 3 ans.",
    facture: (c) => `Facture${c.issuer ? ` ${c.issuer}` : ""}${c.amount ? ` : ${c.amount}` : ""}${c.deadline ? `, à payer avant le ${c.deadline}` : ""}.`,
    amende: (c) => `Amende : ${c.amount ?? "une somme"} à payer${c.deadline ? ` avant le ${c.deadline}` : ""}. Après le délai, elle peut augmenter.`,
    quittance: (c) => `Quittance de loyer${c.amount ? ` : ${c.amount}` : ""}. Elle prouve que le loyer est payé.`,
    bail: "Contrat de location. Garde-le jusqu'à la fin de la location et au retour du dépôt de garantie.",
    assurance: (c) => `Attestation d'assurance${c.issuer ? ` ${c.issuer}` : ""}${c.expiry ? `, valable jusqu'au ${c.expiry}` : ""}.`,
    releve: (c) => `Relevé de compte${c.issuer ? ` ${c.issuer}` : ""}.`,
    identite: (c, label) => `${label}${c.expiry ? ` valable jusqu'au ${c.expiry}` : ""}.`,
    soon: " Pense à la renouveler bientôt : les rendez-vous peuvent prendre du temps.",
    expired: " Elle a expiré : il faut la renouveler.",
    carte_grise: "Certificat d'immatriculation (carte grise). À garder tant que tu as le véhicule.",
    sante: (c) => `Papier de santé${c.issuer ? ` de ${c.issuer}` : ""}${c.amount ? ` : ${c.amount}` : ""}.`,
    ordonnance: "Ordonnance. Garde-la pour la pharmacie et tes remboursements.",
    devis: (c) => `Devis${c.amount ? ` de ${c.amount}` : ""}. Signe-le seulement si tu es d'accord avec le prix.`,
    ticket: (c) => `Ticket de caisse${c.amount ? ` : ${c.amount}` : ""}. Garde-le : il prouve l'achat et la garantie (2 ans pour un produit neuf).`,
    scolarite: "Certificat de scolarité. Il est souvent demandé par la CAF et les bourses.",
    diplome: "Diplôme. À garder toute ta vie, en lieu sûr.",
    cv: "CV. Pense à le mettre à jour.",
    employeur: "Attestation de ton employeur. Garde-la : elle sert pour tes droits (chômage, retraite).",
    autre: "Papier rangé. Vérifie le dossier et le nom si besoin.",
  },
  docLabel: { piece_identite: "Carte d'identité", passeport: "Passeport", titre_de_sejour: "Titre de séjour", permis_de_conduire: "Permis de conduire" },
  actions: {
    payOnline: (s) => `Paie en ligne sur ${s}, ou avec le moyen indiqué sur la lettre.`,
    payLetter: "Paie avec le moyen indiqué sur la lettre (en ligne, prélèvement, chèque ou virement).",
    beforeDate: (d) => `Fais-le avant le ${d}.`,
    askDelay: "Si tu ne peux pas payer à temps, demande un délai avant la date limite : bouton « Écrire une réponse ».",
    prepareDoc: "Prépare le document demandé : il est cité dans la lettre.",
    sendOnline: (s) => `Envoie-le depuis ton espace personnel sur ${s}.`,
    sendLetter: "Envoie-le à l'adresse indiquée sur la lettre.",
    keepCopy: "Note la référence du dossier sur ton envoi et garde une copie.",
    rdvNote: "Note la date et l'heure du rendez-vous dans ton agenda.",
    rdvPapers: "Prépare les papiers demandés dans la lettre.",
    rdvWarn: "Si tu ne peux pas venir, préviens avant le rendez-vous.",
    checkAmount: "Vérifie le montant et la période concernée.",
    schedule: "Si tu ne peux pas rembourser d'un coup, demande un échéancier : bouton « Écrire une réponse ».",
    contest: "Si tu n'es pas d'accord, conteste par écrit avant la date limite.",
    getHelp: "Si la situation te dépasse, fais-toi aider gratuitement : association, point justice, écrivain public.",
    readQuote: "Lis la phrase importante ci-dessous et vérifie la date sur la lettre.",
    answerOnline: (s) => `Réponds depuis ton espace personnel sur ${s}.`,
    answerLetter: "Réponds par le moyen indiqué sur la lettre.",
    renewId: "Prends rendez-vous en mairie pour le renouvellement (prédemande sur ants.gouv.fr).",
    renewPermit: "Renseigne-toi tôt sur le renouvellement auprès de la préfecture.",
    renewLicence: "Renouvelle-le en ligne sur ants.gouv.fr.",
    payFine: "Paie sur antai.gouv.fr avec le numéro de télépaiement, ou conteste si ce n'était pas toi.",
    payTax: "Paie sur impots.gouv.fr, espace particulier, ou avec le moyen indiqué sur l'avis.",
  },
  warnings: {
    unreadable: "Je n'ai presque rien pu lire : reprends la photo bien à plat, avec de la lumière.",
    unsure: "Je ne suis pas sûr du type de papier : vérifie le dossier.",
    mrz: "La bande en bas de la pièce est mal lue : vérifie la date d'expiration.",
    pdf: "Les PDF ne sont pas encore lus automatiquement : vérifie le nom et le dossier.",
  },
  scam: {
    warning: "Attention, arnaque probable : ce message imite un organisme pour te faire payer ou voler tes informations. Ne clique sur aucun lien et ne paie rien.",
    suspect: "Prudence : ce message a des signes d'arnaque. Vérifie sur le site officiel avant de faire quoi que ce soit.",
    actions: [
      "Ne clique sur aucun lien, ne paie rien, ne donne aucun code.",
      "Vérifie toi-même en tapant l'adresse du vrai site, ou en appelant le numéro d'un vrai courrier.",
      "SMS : transfère-le au 33700 (gratuit). Mail : signale-le sur signal-spam.fr.",
      "Si tu as déjà donné ta carte ou un code : appelle tout de suite ta banque pour faire opposition, puis va sur cybermalveillance.gouv.fr.",
    ],
  },
};

const en: Words = {
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  amount: (n) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  date: (d, m, y) => `${d} ${m} ${y}`,
  someone: "The organisation",
  objet: {
    payer: "pay",
    envoyer_document: "send the requested document",
    rdv: "go to the appointment",
    indu: "repay or dispute",
    relance: "reply or pay",
    droits: "check your benefits",
    repondre: "reply",
    info: "read this letter",
  },
  intent: {
    payer: (c) => `${c.issuer ?? "The organisation"} asks you to pay${c.amount ? ` ${c.amount}` : ""}${c.deadline ? ` before ${c.deadline}` : ""}.`,
    envoyer_document: (c) => `${c.issuer ?? "The organisation"} asks you to send a document${c.deadline ? ` before ${c.deadline}` : ""}. Without a reply, your file may be put on hold.`,
    rdv: (c) => `${c.issuer ?? "The organisation"} gives you an appointment${c.deadline ? ` on ${c.deadline}` : ""}.`,
    indu: (c) => `${c.issuer ?? "The organisation"} asks you to repay ${c.amount ?? "a sum"}${c.deadline ? ` before ${c.deadline}` : ""}.`,
    relance: (c) => `This is a reminder from ${c.issuer ?? "the organisation"}: a reply or payment is expected${c.deadline ? ` before ${c.deadline}` : ""}.`,
    droits: (c) => `${c.issuer ?? "The organisation"} informs you about your benefits${c.amount ? `: ${c.amount}` : ""}. Nothing to do, keep this letter.`,
    repondre: (c) => `Letter from ${c.issuer ?? "an organisation"}${c.deadline ? `: you must act before ${c.deadline}` : ""}.`,
    info: (c) => `Information letter from ${c.issuer ?? "an organisation"}. Nothing to do for now.`,
  },
  type: {
    fiche_de_paie: (c) => `Payslip${c.period ? ` (${c.period})` : ""}${c.net ? `: ${c.net} net` : ""}. Keep it for life: it counts for your pension.`,
    contrat_de_travail: (c) => `Employment contract${c.issuer ? ` with ${c.issuer}` : ""}${c.trial ? `, trial period of ${c.trial}` : ""}. Keep it safe.`,
    avis_payer: (c) => `Tax notice: ${c.amount ?? "a sum"} to pay${c.deadline ? ` before ${c.deadline}` : ""}.`,
    avis_recevoir: (c) => `Tax notice: you will be refunded ${c.amount}.`,
    avis_info: "Tax notice: it proves your income. Keep it for at least 3 years.",
    facture: (c) => `Bill${c.issuer ? ` from ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}${c.deadline ? `, to pay before ${c.deadline}` : ""}.`,
    amende: (c) => `Fine: ${c.amount ?? "a sum"} to pay${c.deadline ? ` before ${c.deadline}` : ""}. After the deadline, it can increase.`,
    quittance: (c) => `Rent receipt${c.amount ? `: ${c.amount}` : ""}. It proves the rent is paid.`,
    bail: "Rental agreement. Keep it until the end of the lease and the return of your deposit.",
    assurance: (c) => `Insurance certificate${c.issuer ? ` ${c.issuer}` : ""}${c.expiry ? `, valid until ${c.expiry}` : ""}.`,
    releve: (c) => `Bank statement${c.issuer ? ` ${c.issuer}` : ""}.`,
    identite: (c, label) => `${label}${c.expiry ? ` valid until ${c.expiry}` : ""}.`,
    soon: " Renew it soon: appointments can take time.",
    expired: " It has expired: it must be renewed.",
    carte_grise: "Vehicle registration certificate. Keep it as long as you own the vehicle.",
    sante: (c) => `Health document${c.issuer ? ` from ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}.`,
    ordonnance: "Prescription. Keep it for the pharmacy and your refunds.",
    devis: (c) => `Quote${c.amount ? ` for ${c.amount}` : ""}. Only sign it if you agree with the price.`,
    ticket: (c) => `Receipt${c.amount ? `: ${c.amount}` : ""}. Keep it: it proves the purchase and the warranty (2 years for a new product).`,
    scolarite: "School certificate. It is often requested by the CAF and for grants.",
    diplome: "Diploma. Keep it for life, somewhere safe.",
    cv: "CV. Remember to keep it up to date.",
    employeur: "Certificate from your employer. Keep it: it counts for your rights (unemployment, pension).",
    autre: "Paper filed. Check the folder and the name if needed.",
  },
  docLabel: { piece_identite: "Identity card", passeport: "Passport", titre_de_sejour: "Residence permit", permis_de_conduire: "Driving licence" },
  actions: {
    payOnline: (s) => `Pay online on ${s}, or with the method shown on the letter.`,
    payLetter: "Pay with the method shown on the letter (online, direct debit, cheque or transfer).",
    beforeDate: (d) => `Do it before ${d}.`,
    askDelay: "If you can't pay on time, ask for more time before the deadline: “Écrire une réponse” button.",
    prepareDoc: "Prepare the requested document: it is named in the letter.",
    sendOnline: (s) => `Send it from your personal account on ${s}.`,
    sendLetter: "Send it to the address shown on the letter.",
    keepCopy: "Write the file reference on what you send and keep a copy.",
    rdvNote: "Write the date and time of the appointment in your calendar.",
    rdvPapers: "Prepare the papers requested in the letter.",
    rdvWarn: "If you can't come, let them know before the appointment.",
    checkAmount: "Check the amount and the period concerned.",
    schedule: "If you can't repay at once, ask for a payment plan: “Écrire une réponse” button.",
    contest: "If you disagree, dispute it in writing before the deadline.",
    getHelp: "If it is too much, get free help: a charity, a legal aid point (point justice) or a public letter writer.",
    readQuote: "Read the key sentence below and check the date on the letter.",
    answerOnline: (s) => `Reply from your personal account on ${s}.`,
    answerLetter: "Reply using the method shown on the letter.",
    renewId: "Book an appointment at the town hall to renew it (pre-application on ants.gouv.fr).",
    renewPermit: "Find out early about renewal at the prefecture.",
    renewLicence: "Renew it online on ants.gouv.fr.",
    payFine: "Pay on antai.gouv.fr with the payment number, or dispute it if it wasn't you.",
    payTax: "Pay on impots.gouv.fr (personal space), or with the method shown on the notice.",
  },
  warnings: {
    unreadable: "I could barely read anything: take the photo again, flat and well lit.",
    unsure: "I'm not sure what kind of paper this is: check the folder.",
    mrz: "The strip at the bottom of the ID is hard to read: check the expiry date.",
    pdf: "PDFs are not read automatically yet: check the name and the folder.",
  },
  scam: {
    warning: "Warning, likely scam: this message imitates an organisation to make you pay or steal your details. Do not click any link and do not pay anything.",
    suspect: "Be careful: this message shows signs of a scam. Check on the official website before doing anything.",
    actions: [
      "Do not click any link, do not pay, do not give any code.",
      "Check for yourself by typing the real website address, or calling the number on a real letter.",
      "Text message: forward it to 33700 (free). Email: report it on signal-spam.fr.",
      "If you already gave your card or a code: call your bank right away to block it, then go to cybermalveillance.gouv.fr.",
    ],
  },
};

const es: Words = {
  months: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."],
  amount: (n) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
  date: (d, m, y) => `${d} ${m} ${y}`,
  someone: "El organismo",
  objet: {
    payer: "pagar",
    envoyer_document: "enviar el documento pedido",
    rdv: "ir a la cita",
    indu: "devolver o reclamar",
    relance: "responder o pagar",
    droits: "revisar tus derechos",
    repondre: "responder",
    info: "leer esta carta",
  },
  intent: {
    payer: (c) => `${c.issuer ?? "El organismo"} te pide pagar${c.amount ? ` ${c.amount}` : ""}${c.deadline ? ` antes del ${c.deadline}` : ""}.`,
    envoyer_document: (c) => `${c.issuer ?? "El organismo"} te pide enviar un documento${c.deadline ? ` antes del ${c.deadline}` : ""}. Sin respuesta, tu expediente puede quedar bloqueado.`,
    rdv: (c) => `${c.issuer ?? "El organismo"} te da una cita${c.deadline ? ` el ${c.deadline}` : ""}.`,
    indu: (c) => `${c.issuer ?? "El organismo"} te pide devolver ${c.amount ?? "una cantidad"}${c.deadline ? ` antes del ${c.deadline}` : ""}.`,
    relance: (c) => `Es un recordatorio de ${c.issuer ?? "el organismo"}: se espera una respuesta o un pago${c.deadline ? ` antes del ${c.deadline}` : ""}.`,
    droits: (c) => `${c.issuer ?? "El organismo"} te informa de tus derechos${c.amount ? `: ${c.amount}` : ""}. No hay nada que hacer, guarda esta carta.`,
    repondre: (c) => `Carta de ${c.issuer ?? "un organismo"}${c.deadline ? `: hay que actuar antes del ${c.deadline}` : ""}.`,
    info: (c) => `Carta informativa de ${c.issuer ?? "un organismo"}. Nada que hacer por ahora.`,
  },
  type: {
    fiche_de_paie: (c) => `Nómina${c.period ? ` (${c.period})` : ""}${c.net ? `: ${c.net} neto` : ""}. Guárdala toda la vida: cuenta para la jubilación.`,
    contrat_de_travail: (c) => `Contrato de trabajo${c.issuer ? ` con ${c.issuer}` : ""}${c.trial ? `, periodo de prueba de ${c.trial}` : ""}. Guárdalo bien.`,
    avis_payer: (c) => `Aviso de impuestos: ${c.amount ?? "una cantidad"} a pagar${c.deadline ? ` antes del ${c.deadline}` : ""}.`,
    avis_recevoir: (c) => `Aviso de impuestos: te devolverán ${c.amount}.`,
    avis_info: "Aviso de impuestos: sirve como justificante de ingresos. Guárdalo al menos 3 años.",
    facture: (c) => `Factura${c.issuer ? ` de ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}${c.deadline ? `, a pagar antes del ${c.deadline}` : ""}.`,
    amende: (c) => `Multa: ${c.amount ?? "una cantidad"} a pagar${c.deadline ? ` antes del ${c.deadline}` : ""}. Después del plazo, puede aumentar.`,
    quittance: (c) => `Recibo de alquiler${c.amount ? `: ${c.amount}` : ""}. Demuestra que el alquiler está pagado.`,
    bail: "Contrato de alquiler. Guárdalo hasta el final del alquiler y la devolución de la fianza.",
    assurance: (c) => `Certificado de seguro${c.issuer ? ` ${c.issuer}` : ""}${c.expiry ? `, válido hasta el ${c.expiry}` : ""}.`,
    releve: (c) => `Extracto bancario${c.issuer ? ` ${c.issuer}` : ""}.`,
    identite: (c, label) => `${label}${c.expiry ? ` válido hasta el ${c.expiry}` : ""}.`,
    soon: " Renuévalo pronto: las citas pueden tardar.",
    expired: " Ha caducado: hay que renovarlo.",
    carte_grise: "Permiso de circulación del vehículo. Guárdalo mientras tengas el vehículo.",
    sante: (c) => `Documento de salud${c.issuer ? ` de ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}.`,
    ordonnance: "Receta médica. Guárdala para la farmacia y los reembolsos.",
    devis: (c) => `Presupuesto${c.amount ? ` de ${c.amount}` : ""}. Fírmalo solo si estás de acuerdo con el precio.`,
    ticket: (c) => `Tique de compra${c.amount ? `: ${c.amount}` : ""}. Guárdalo: prueba la compra y la garantía (2 años para un producto nuevo).`,
    scolarite: "Certificado de escolaridad. La CAF y las becas lo piden a menudo.",
    diplome: "Diploma. Guárdalo toda la vida, en un lugar seguro.",
    cv: "CV. Acuérdate de actualizarlo.",
    employeur: "Certificado de tu empleador. Guárdalo: cuenta para tus derechos (paro, jubilación).",
    autre: "Papel guardado. Revisa la carpeta y el nombre si hace falta.",
  },
  docLabel: { piece_identite: "Documento de identidad", passeport: "Pasaporte", titre_de_sejour: "Permiso de residencia", permis_de_conduire: "Permiso de conducir" },
  actions: {
    payOnline: (s) => `Paga en línea en ${s}, o con el medio indicado en la carta.`,
    payLetter: "Paga con el medio indicado en la carta (en línea, domiciliación, cheque o transferencia).",
    beforeDate: (d) => `Hazlo antes del ${d}.`,
    askDelay: "Si no puedes pagar a tiempo, pide un aplazamiento antes de la fecha límite: botón «Écrire une réponse».",
    prepareDoc: "Prepara el documento pedido: aparece en la carta.",
    sendOnline: (s) => `Envíalo desde tu espacio personal en ${s}.`,
    sendLetter: "Envíalo a la dirección indicada en la carta.",
    keepCopy: "Anota la referencia del expediente en tu envío y guarda una copia.",
    rdvNote: "Apunta la fecha y la hora de la cita en tu agenda.",
    rdvPapers: "Prepara los papeles que pide la carta.",
    rdvWarn: "Si no puedes ir, avisa antes de la cita.",
    checkAmount: "Revisa la cantidad y el periodo.",
    schedule: "Si no puedes devolverlo de una vez, pide un plan de pagos: botón «Écrire une réponse».",
    contest: "Si no estás de acuerdo, reclama por escrito antes de la fecha límite.",
    getHelp: "Si te supera, pide ayuda gratuita: asociación, punto de justicia o escribano público.",
    readQuote: "Lee la frase importante de abajo y comprueba la fecha en la carta.",
    answerOnline: (s) => `Responde desde tu espacio personal en ${s}.`,
    answerLetter: "Responde por el medio indicado en la carta.",
    renewId: "Pide cita en el ayuntamiento para renovarlo (solicitud previa en ants.gouv.fr).",
    renewPermit: "Infórmate pronto sobre la renovación en la prefectura.",
    renewLicence: "Renuévalo en línea en ants.gouv.fr.",
    payFine: "Paga en antai.gouv.fr con el número de telepago, o reclama si no fuiste tú.",
    payTax: "Paga en impots.gouv.fr (espacio particular) o con el medio indicado en el aviso.",
  },
  warnings: {
    unreadable: "Casi no he podido leer nada: repite la foto bien plana y con luz.",
    unsure: "No estoy seguro del tipo de papel: revisa la carpeta.",
    mrz: "La banda de abajo del documento se lee mal: comprueba la fecha de caducidad.",
    pdf: "Los PDF aún no se leen automáticamente: revisa el nombre y la carpeta.",
  },
  scam: {
    warning: "Cuidado, probable estafa: este mensaje imita a un organismo para hacerte pagar o robar tus datos. No pulses ningún enlace y no pagues nada.",
    suspect: "Prudencia: este mensaje tiene señales de estafa. Compruébalo en la web oficial antes de hacer nada.",
    actions: [
      "No pulses ningún enlace, no pagues nada, no des ningún código.",
      "Compruébalo tú escribiendo la dirección de la web oficial, o llamando al número de una carta auténtica.",
      "SMS: reenvíalo al 33700 (gratis). Correo: denúncialo en signal-spam.fr.",
      "Si ya diste tu tarjeta o un código: llama enseguida a tu banco para bloquearla y entra en cybermalveillance.gouv.fr.",
    ],
  },
};

const ar: Words = {
  months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  amount: (n) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
  date: (d, m, y) => `${d} ${m} ${y}`,
  someone: "الجهة",
  objet: {
    payer: "الدفع",
    envoyer_document: "إرسال الوثيقة المطلوبة",
    rdv: "الذهاب إلى الموعد",
    indu: "إرجاع المبلغ أو الاعتراض",
    relance: "الرد أو الدفع",
    droits: "التحقق من حقوقك",
    repondre: "الرد",
    info: "قراءة هذه الرسالة",
  },
  intent: {
    payer: (c) => `${c.issuer ?? "الجهة"} تطلب منك دفع${c.amount ? ` ${c.amount}` : " مبلغ"}${c.deadline ? ` قبل ${c.deadline}` : ""}.`,
    envoyer_document: (c) => `${c.issuer ?? "الجهة"} تطلب منك إرسال وثيقة${c.deadline ? ` قبل ${c.deadline}` : ""}. بدون رد، قد يتوقف ملفك.`,
    rdv: (c) => `${c.issuer ?? "الجهة"} تحدد لك موعدًا${c.deadline ? ` يوم ${c.deadline}` : ""}.`,
    indu: (c) => `${c.issuer ?? "الجهة"} تطلب منك إرجاع ${c.amount ?? "مبلغ"}${c.deadline ? ` قبل ${c.deadline}` : ""}.`,
    relance: (c) => `هذا تذكير من ${c.issuer ?? "الجهة"}: يُنتظر منك رد أو دفع${c.deadline ? ` قبل ${c.deadline}` : ""}.`,
    droits: (c) => `${c.issuer ?? "الجهة"} تُعلمك بحقوقك${c.amount ? `: ${c.amount}` : ""}. لا شيء مطلوب، احتفظ بهذه الرسالة.`,
    repondre: (c) => `رسالة من ${c.issuer ?? "جهة"}${c.deadline ? `: يجب التصرف قبل ${c.deadline}` : ""}.`,
    info: (c) => `رسالة إعلامية من ${c.issuer ?? "جهة"}. لا شيء مطلوب الآن.`,
  },
  type: {
    fiche_de_paie: (c) => `كشف راتب${c.period ? ` (${c.period})` : ""}${c.net ? `: ${c.net} صافي` : ""}. احتفظ به مدى الحياة: يُحتسب للتقاعد.`,
    contrat_de_travail: (c) => `عقد عمل${c.issuer ? ` مع ${c.issuer}` : ""}${c.trial ? `، فترة تجربة ${c.trial}` : ""}. احتفظ به جيدًا.`,
    avis_payer: (c) => `إشعار ضريبي: ${c.amount ?? "مبلغ"} للدفع${c.deadline ? ` قبل ${c.deadline}` : ""}.`,
    avis_recevoir: (c) => `إشعار ضريبي: سيُعاد إليك ${c.amount}.`,
    avis_info: "إشعار ضريبي: يثبت دخلك. احتفظ به 3 سنوات على الأقل.",
    facture: (c) => `فاتورة${c.issuer ? ` من ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}${c.deadline ? `، للدفع قبل ${c.deadline}` : ""}.`,
    amende: (c) => `مخالفة: ${c.amount ?? "مبلغ"} للدفع${c.deadline ? ` قبل ${c.deadline}` : ""}. بعد المهلة، قد يرتفع المبلغ.`,
    quittance: (c) => `إيصال إيجار${c.amount ? `: ${c.amount}` : ""}. يثبت أن الإيجار مدفوع.`,
    bail: "عقد إيجار. احتفظ به حتى نهاية الإيجار واسترجاع مبلغ الضمان.",
    assurance: (c) => `شهادة تأمين${c.issuer ? ` ${c.issuer}` : ""}${c.expiry ? `، صالحة حتى ${c.expiry}` : ""}.`,
    releve: (c) => `كشف حساب بنكي${c.issuer ? ` ${c.issuer}` : ""}.`,
    identite: (c, label) => `${label}${c.expiry ? ` صالحة حتى ${c.expiry}` : ""}.`,
    soon: " جدّدها قريبًا: المواعيد قد تأخذ وقتًا.",
    expired: " انتهت صلاحيتها: يجب تجديدها.",
    carte_grise: "شهادة تسجيل المركبة. احتفظ بها ما دامت المركبة لديك.",
    sante: (c) => `وثيقة صحية${c.issuer ? ` من ${c.issuer}` : ""}${c.amount ? `: ${c.amount}` : ""}.`,
    ordonnance: "وصفة طبية. احتفظ بها للصيدلية وللتعويضات.",
    devis: (c) => `عرض سعر${c.amount ? ` بقيمة ${c.amount}` : ""}. وقّعه فقط إذا كنت موافقًا على السعر.`,
    ticket: (c) => `إيصال شراء${c.amount ? `: ${c.amount}` : ""}. احتفظ به: يثبت الشراء والضمان (سنتان للمنتج الجديد).`,
    scolarite: "شهادة تمدرس. تطلبها الـ CAF والمنح غالبًا.",
    diplome: "شهادة دراسية. احتفظ بها مدى الحياة في مكان آمن.",
    cv: "سيرة ذاتية. تذكّر تحديثها.",
    employeur: "شهادة من صاحب العمل. احتفظ بها: تُحتسب لحقوقك (البطالة، التقاعد).",
    autre: "تم ترتيب الورقة. تحقق من الملف والاسم إذا لزم الأمر.",
  },
  docLabel: { piece_identite: "بطاقة الهوية", passeport: "جواز السفر", titre_de_sejour: "بطاقة الإقامة", permis_de_conduire: "رخصة القيادة" },
  actions: {
    payOnline: (s) => `ادفع عبر الإنترنت على ${s}، أو بالطريقة المذكورة في الرسالة.`,
    payLetter: "ادفع بالطريقة المذكورة في الرسالة (عبر الإنترنت، اقتطاع، شيك أو تحويل).",
    beforeDate: (d) => `افعل ذلك قبل ${d}.`,
    askDelay: "إذا لم تستطع الدفع في الوقت، اطلب مهلة قبل التاريخ النهائي: زر « Écrire une réponse ».",
    prepareDoc: "حضّر الوثيقة المطلوبة: هي مذكورة في الرسالة.",
    sendOnline: (s) => `أرسلها من حسابك الشخصي على ${s}.`,
    sendLetter: "أرسلها إلى العنوان المذكور في الرسالة.",
    keepCopy: "اكتب رقم الملف على ما ترسله واحتفظ بنسخة.",
    rdvNote: "سجّل تاريخ الموعد وساعته في مفكرتك.",
    rdvPapers: "حضّر الأوراق المطلوبة في الرسالة.",
    rdvWarn: "إذا لم تستطع الحضور، أخبرهم قبل الموعد.",
    checkAmount: "تحقق من المبلغ والفترة المعنية.",
    schedule: "إذا لم تستطع الإرجاع دفعة واحدة، اطلب جدول تقسيط: زر « Écrire une réponse ».",
    contest: "إذا لم تكن موافقًا، اعترض كتابيًا قبل التاريخ النهائي.",
    getHelp: "إذا كان الأمر صعبًا عليك، اطلب مساعدة مجانية: جمعية، نقطة عدالة (point justice) أو كاتب عمومي.",
    readQuote: "اقرأ الجملة المهمة أدناه وتحقق من التاريخ في الرسالة.",
    answerOnline: (s) => `ردّ من حسابك الشخصي على ${s}.`,
    answerLetter: "ردّ بالطريقة المذكورة في الرسالة.",
    renewId: "احجز موعدًا في البلدية للتجديد (طلب مسبق على ants.gouv.fr).",
    renewPermit: "استعلم مبكرًا عن التجديد لدى المحافظة (préfecture).",
    renewLicence: "جدّدها عبر الإنترنت على ants.gouv.fr.",
    payFine: "ادفع على antai.gouv.fr برقم الدفع الإلكتروني، أو اعترض إذا لم تكن أنت.",
    payTax: "ادفع على impots.gouv.fr (الفضاء الشخصي) أو بالطريقة المذكورة في الإشعار.",
  },
  warnings: {
    unreadable: "لم أستطع قراءة شيء تقريبًا: أعد التصوير والورقة مسطحة وفي ضوء جيد.",
    unsure: "لست متأكدًا من نوع الورقة: تحقق من الملف.",
    mrz: "الشريط أسفل الوثيقة غير واضح: تحقق من تاريخ انتهاء الصلاحية.",
    pdf: "ملفات PDF لا تُقرأ تلقائيًا بعد: تحقق من الاسم والملف.",
  },
  scam: {
    warning: "تنبيه، احتيال محتمل: هذه الرسالة تقلّد جهة رسمية لتجعلك تدفع أو لتسرق معلوماتك. لا تضغط على أي رابط ولا تدفع شيئًا.",
    suspect: "احذر: في هذه الرسالة علامات احتيال. تحقق من الموقع الرسمي قبل أن تفعل أي شيء.",
    actions: [
      "لا تضغط على أي رابط، ولا تدفع شيئًا، ولا تعطِ أي رمز.",
      "تحقق بنفسك بكتابة عنوان الموقع الرسمي، أو بالاتصال بالرقم المكتوب على رسالة حقيقية.",
      "رسالة نصية: أرسلها إلى 33700 (مجانًا). بريد إلكتروني: بلّغ عنه على signal-spam.fr.",
      "إذا أعطيت بطاقتك أو رمزًا: اتصل فورًا بالبنك لإيقاف البطاقة، ثم ادخل إلى cybermalveillance.gouv.fr.",
    ],
  },
};

export const WORDS: Record<Lang, Words> = { fr, en, es, ar };

export function formatDateIn(lang: Lang, iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const w = WORDS[lang];
  return w.date(d, w.months[m - 1], y);
}
