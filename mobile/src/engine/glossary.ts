import type { Lang } from "./i18n.ts";
import { fold, indexOfWord } from "./normalize.ts";

export interface Term {
  id: string;
  /** Le mot tel qu'on l'affiche. */
  word: string;
  /** Formes cherchées dans le texte replié (minuscules, sans accents). */
  forms: string[];
  def: Record<Lang, string>;
}

export const GLOSSARY: Term[] = [
  { id: "indu", word: "Indu / trop-perçu", forms: ["indu", "trop-percu", "trop percu"], def: {
    fr: "Une somme qu'on t'a versée en trop. L'organisme te demande de la rendre (tu peux demander à payer en plusieurs fois, ou contester).",
    en: "Money you were paid by mistake. The organisation asks you to pay it back (you can ask to pay in instalments, or dispute it).",
    es: "Dinero que te pagaron de más. El organismo te pide devolverlo (puedes pedir pagarlo a plazos o impugnarlo).",
    ar: "مبلغ دُفع لك بالخطأ. تطلب الجهة استرجاعه (يمكنك طلب الدفع على أقساط أو الاعتراض).",
  } },
  { id: "rfr", word: "Revenu fiscal de référence", forms: ["revenu fiscal de reference"], def: {
    fr: "Le chiffre de tes revenus calculé par les impôts. Il sert pour les aides, les bourses, les tarifs sociaux.",
    en: "Your income figure as calculated by the tax office. It is used for benefits, grants and social rates.",
    es: "La cifra de tus ingresos calculada por Hacienda. Sirve para ayudas, becas y tarifas sociales.",
    ar: "رقم دخلك كما تحسبه مصلحة الضرائب. يُستعمل للمساعدات والمنح والأسعار الاجتماعية.",
  } },
  { id: "pas", word: "Prélèvement à la source", forms: ["prelevement a la source", "retenue a la source"], def: {
    fr: "L'impôt sur le revenu est retiré directement de ton salaire chaque mois, avec ton taux personnel.",
    en: "Income tax is taken directly from your salary every month, using your personal rate.",
    es: "El impuesto sobre la renta se descuenta directamente de tu sueldo cada mes, con tu tipo personal.",
    ar: "تُقتطع ضريبة الدخل مباشرة من راتبك كل شهر حسب نسبتك الشخصية.",
  } },
  { id: "mise_en_demeure", word: "Mise en demeure", forms: ["mise en demeure", "mettons en demeure"], def: {
    fr: "Une dernière demande officielle avant des poursuites. C'est sérieux : réponds vite, ou fais-toi aider.",
    en: "A last formal demand before legal action. It is serious: answer quickly, or get help.",
    es: "Un último requerimiento formal antes de acciones legales. Es serio: responde rápido o pide ayuda.",
    ar: "طلب رسمي أخير قبل الملاحقة. الأمر جدي: ردّ بسرعة أو اطلب المساعدة.",
  } },
  { id: "commandement", word: "Commandement de payer", forms: ["commandement de payer"], def: {
    fr: "Acte d'un commissaire de justice qui ordonne de payer. Sans réponse, une saisie peut suivre. Fais-toi aider vite (point justice, association).",
    en: "A bailiff's order to pay. Without an answer, your goods or wages may be seized. Get help fast.",
    es: "Orden de pago de un agente judicial. Sin respuesta puede haber un embargo. Pide ayuda rápido.",
    ar: "أمر بالدفع من المحضر القضائي. بدون رد قد يتبعه حجز. اطلب المساعدة بسرعة.",
  } },
  { id: "injonction", word: "Injonction de payer", forms: ["injonction de payer"], def: {
    fr: "Décision d'un juge qui ordonne de payer une dette. Tu as un délai pour t'y opposer (écrit sur le papier).",
    en: "A judge's order to pay a debt. You have a deadline to oppose it (written on the paper).",
    es: "Decisión de un juez que ordena pagar una deuda. Tienes un plazo para oponerte (indicado en el papel).",
    ar: "قرار من القاضي يأمر بدفع دين. لديك مهلة للاعتراض (مكتوبة على الورقة).",
  } },
  { id: "commissaire", word: "Commissaire de justice", forms: ["commissaire de justice", "commissaires de justice", "huissier"], def: {
    fr: "Le nouveau nom de l'huissier : il remet des actes officiels et peut faire des saisies sur décision de justice.",
    en: "The new name for a bailiff: delivers official papers and can seize goods after a court decision.",
    es: "El nuevo nombre del agente judicial: entrega actos oficiales y puede embargar tras una decisión judicial.",
    ar: "الاسم الجديد للمحضر القضائي: يسلّم الوثائق الرسمية ويمكنه الحجز بعد قرار قضائي.",
  } },
  { id: "recours", word: "Recours gracieux", forms: ["recours gracieux"], def: {
    fr: "Une lettre à l'organisme pour lui demander de revoir sa décision. Souvent dans les 2 mois.",
    en: "A letter asking the organisation to review its decision. Usually within 2 months.",
    es: "Una carta pidiendo al organismo que revise su decisión. Normalmente en 2 meses.",
    ar: "رسالة تطلب فيها من الجهة مراجعة قرارها. غالبًا خلال شهرين.",
  } },
  { id: "majoration", word: "Majoration", forms: ["majoration", "majoree", "majorations"], def: {
    fr: "Une somme ajoutée parce que le paiement est en retard.",
    en: "An extra amount added because the payment is late.",
    es: "Una cantidad añadida porque el pago llega tarde.",
    ar: "مبلغ إضافي بسبب التأخر في الدفع.",
  } },
  { id: "echeancier", word: "Échéancier", forms: ["echeancier"], def: {
    fr: "Un calendrier de paiements en plusieurs fois.",
    en: "A schedule to pay in several instalments.",
    es: "Un calendario de pagos a plazos.",
    ar: "جدول دفع على عدة أقساط.",
  } },
  { id: "avis_echeance", word: "Avis d'échéance", forms: ["avis d'echeance"], def: {
    fr: "Un papier qui annonce une somme à payer à une date (loyer, assurance). Ce n'est pas une preuve de paiement.",
    en: "A notice of an amount due on a date (rent, insurance). It is not proof of payment.",
    es: "Un aviso de una cantidad a pagar en una fecha (alquiler, seguro). No es un justificante de pago.",
    ar: "إشعار بمبلغ يجب دفعه في تاريخ معيّن (إيجار، تأمين). ليس إثباتًا للدفع.",
  } },
  { id: "quittance", word: "Quittance de loyer", forms: ["quittance"], def: {
    fr: "La preuve que le loyer est payé. Le propriétaire doit te la donner gratuitement si tu la demandes.",
    en: "Proof that the rent is paid. The landlord must give it to you for free if you ask.",
    es: "El justificante de que el alquiler está pagado. El propietario debe dártelo gratis si lo pides.",
    ar: "إثبات دفع الإيجار. على المالك أن يعطيك إياه مجانًا إذا طلبته.",
  } },
  { id: "depot", word: "Dépôt de garantie", forms: ["depot de garantie", "caution"], def: {
    fr: "L'argent versé à l'entrée dans un logement. Il doit être rendu 1 mois après la remise des clés (2 mois s'il y a des dégâts), sinon il augmente de 10 % du loyer par mois de retard.",
    en: "Money paid when moving in. It must be returned 1 month after handing back the keys (2 months if there is damage), otherwise 10% of the rent is added per month of delay.",
    es: "Dinero pagado al entrar en una vivienda. Debe devolverse 1 mes después de entregar las llaves (2 meses si hay daños); si no, aumenta un 10 % del alquiler por mes de retraso.",
    ar: "المال المدفوع عند دخول السكن. يجب إرجاعه بعد شهر من تسليم المفاتيح (شهرين إذا كانت هناك أضرار)، وإلا يُضاف 10% من الإيجار عن كل شهر تأخير.",
  } },
  { id: "etat_des_lieux", word: "État des lieux", forms: ["etat des lieux"], def: {
    fr: "La description du logement à l'entrée et à la sortie. Il décide si le dépôt de garantie est rendu en entier.",
    en: "A description of the home when moving in and out. It decides whether the deposit is fully returned.",
    es: "La descripción de la vivienda a la entrada y a la salida. Decide si se devuelve la fianza entera.",
    ar: "وصف حالة السكن عند الدخول والخروج. على أساسه يُرجع مبلغ الضمان كاملًا أو لا.",
  } },
  { id: "preavis", word: "Préavis", forms: ["preavis"], def: {
    fr: "Le temps à respecter entre l'annonce d'un départ (logement, travail) et le départ réel.",
    en: "The notice period between announcing you leave (home, job) and actually leaving.",
    es: "El plazo de aviso entre anunciar que te vas (vivienda, trabajo) y la salida real.",
    ar: "المهلة بين الإعلان عن المغادرة (سكن، عمل) والمغادرة الفعلية.",
  } },
  { id: "allocataire", word: "Allocataire", forms: ["allocataire"], def: {
    fr: "La personne qui reçoit les aides de la CAF. Ton numéro d'allocataire sert dans tous tes échanges avec elle.",
    en: "The person who receives CAF benefits. Your claimant number is used in all exchanges with them.",
    es: "La persona que recibe las ayudas de la CAF. Tu número de beneficiario sirve en todos tus trámites con ella.",
    ar: "الشخص الذي يتلقى مساعدات CAF. رقمك كمستفيد يُستعمل في كل تعاملاتك معها.",
  } },
  { id: "apl", word: "APL / aide au logement", forms: ["aide personnalisee au logement", "apl", "aide au logement"], def: {
    fr: "Une aide de la CAF pour payer le loyer. Elle peut être versée à toi ou directement au propriétaire.",
    en: "A CAF benefit to help pay the rent. It can be paid to you or directly to the landlord.",
    es: "Una ayuda de la CAF para pagar el alquiler. Puede pagarse a ti o directamente al propietario.",
    ar: "مساعدة من CAF لدفع الإيجار. قد تُدفع لك أو مباشرة للمالك.",
  } },
  { id: "prime_activite", word: "Prime d'activité", forms: ["prime d'activite"], def: {
    fr: "Une aide de la CAF pour les personnes qui travaillent avec des revenus modestes. À déclarer tous les 3 mois.",
    en: "A CAF benefit for people who work on a low income. To be declared every 3 months.",
    es: "Una ayuda de la CAF para trabajadores con ingresos modestos. Hay que declararla cada 3 meses.",
    ar: "مساعدة من CAF للعاملين ذوي الدخل المحدود. يجب التصريح بها كل 3 أشهر.",
  } },
  { id: "rsa", word: "RSA", forms: ["rsa", "revenu de solidarite active"], def: {
    fr: "Un revenu minimum versé par la CAF (ou la MSA). Il faut déclarer ses ressources tous les 3 mois.",
    en: "A minimum income paid by the CAF (or MSA). You must declare your income every 3 months.",
    es: "Una renta mínima pagada por la CAF (o la MSA). Hay que declarar los ingresos cada 3 meses.",
    ar: "دخل أدنى تدفعه CAF (أو MSA). يجب التصريح بالموارد كل 3 أشهر.",
  } },
  { id: "are", word: "ARE (allocation chômage)", forms: ["aide au retour a l'emploi", "are", "allocation chomage"], def: {
    fr: "L'allocation chômage versée par France Travail après la perte d'un emploi.",
    en: "Unemployment benefit paid by France Travail after losing a job.",
    es: "La prestación por desempleo que paga France Travail tras perder un empleo.",
    ar: "تعويض البطالة الذي تدفعه France Travail بعد فقدان العمل.",
  } },
  { id: "actualisation", word: "Actualisation", forms: ["actualisation", "actualiser"], def: {
    fr: "La déclaration de ta situation chaque mois à France Travail. Sans elle, tu n'es pas payé et tu peux être radié.",
    en: "Your monthly update to France Travail. Without it you are not paid and may be removed from the list.",
    es: "La declaración mensual de tu situación a France Travail. Sin ella no cobras y pueden darte de baja.",
    ar: "التصريح الشهري بوضعك لدى France Travail. بدونه لا تُدفع لك المستحقات وقد يتم شطبك.",
  } },
  { id: "radiation", word: "Radiation", forms: ["radiation", "radie", "radiee"], def: {
    fr: "Être retiré de la liste des demandeurs d'emploi : les allocations s'arrêtent. On peut contester.",
    en: "Being removed from the jobseekers list: benefits stop. It can be disputed.",
    es: "Ser dado de baja de la lista de demandantes de empleo: se cortan las prestaciones. Se puede impugnar.",
    ar: "الشطب من قائمة الباحثين عن عمل: تتوقف المستحقات. يمكن الاعتراض.",
  } },
  { id: "essai", word: "Période d'essai", forms: ["periode d'essai"], def: {
    fr: "Le début du contrat de travail : l'employeur ou le salarié peut l'arrêter plus facilement.",
    en: "The first part of a job contract: employer or employee can end it more easily.",
    es: "El inicio del contrato de trabajo: empresa o trabajador pueden terminarlo con más facilidad.",
    ar: "بداية عقد العمل: يمكن لصاحب العمل أو للأجير إنهاؤه بسهولة أكبر.",
  } },
  { id: "brut_net", word: "Brut / net", forms: ["salaire brut", "net a payer", "net imposable"], def: {
    fr: "Le brut est le salaire avant cotisations ; le net à payer est ce qui arrive sur ton compte ; le net imposable sert pour l'impôt.",
    en: "Gross is the salary before contributions; net to pay is what reaches your account; taxable net is used for income tax.",
    es: "El bruto es el sueldo antes de cotizaciones; el neto a pagar es lo que llega a tu cuenta; el neto imponible sirve para el impuesto.",
    ar: "الإجمالي هو الراتب قبل الاقتطاعات؛ الصافي هو ما يصل إلى حسابك؛ الصافي الخاضع للضريبة يُستعمل لحساب الضريبة.",
  } },
  { id: "cotisations", word: "Cotisations", forms: ["cotisations"], def: {
    fr: "L'argent retiré du salaire pour la santé, la retraite et le chômage.",
    en: "Money taken from the salary for health, pension and unemployment insurance.",
    es: "El dinero que se descuenta del sueldo para salud, jubilación y desempleo.",
    ar: "المال المقتطع من الراتب للصحة والتقاعد والبطالة.",
  } },
  { id: "solde_tout_compte", word: "Solde de tout compte", forms: ["solde de tout compte"], def: {
    fr: "Le dernier paiement de l'employeur à la fin du contrat. Après signature, tu as 6 mois pour le contester.",
    en: "The final payment from the employer at the end of the contract. After signing, you have 6 months to dispute it.",
    es: "El último pago de la empresa al final del contrato. Tras firmarlo tienes 6 meses para impugnarlo.",
    ar: "آخر دفعة من صاحب العمل عند نهاية العقد. بعد التوقيع لديك 6 أشهر للاعتراض.",
  } },
  { id: "telepaiement", word: "Numéro de télépaiement", forms: ["telepaiement"], def: {
    fr: "Le numéro qui sert à payer une amende en ligne, sur le vrai site (antai.gouv.fr ou amendes.gouv.fr).",
    en: "The number used to pay a fine online, on the real website (antai.gouv.fr or amendes.gouv.fr).",
    es: "El número para pagar una multa en línea, en la web oficial (antai.gouv.fr o amendes.gouv.fr).",
    ar: "الرقم الذي يُستعمل لدفع الغرامة عبر الإنترنت في الموقع الرسمي (antai.gouv.fr أو amendes.gouv.fr).",
  } },
  { id: "designation", word: "Désignation du conducteur", forms: ["designation du conducteur", "designation d'un conducteur", "designer le conducteur"], def: {
    fr: "Indiquer qui conduisait si ce n'était pas toi. Obligatoire pour une voiture de société.",
    en: "Saying who was driving if it was not you. Mandatory for a company car.",
    es: "Indicar quién conducía si no eras tú. Obligatorio para un coche de empresa.",
    ar: "التصريح بمن كان يقود إذا لم تكن أنت. إلزامي لسيارة الشركة.",
  } },
  { id: "franchise", word: "Franchise (assurance)", forms: ["franchise"], def: {
    fr: "La part d'un sinistre qui reste à ta charge, même si tu es assuré.",
    en: "The part of a claim you pay yourself, even when insured.",
    es: "La parte de un siniestro que pagas tú aunque estés asegurado.",
    ar: "الجزء من الضرر الذي تتحمله أنت حتى لو كنت مؤمَّنًا.",
  } },
  { id: "resiliation", word: "Résiliation", forms: ["resiliation", "resilier", "resilie"], def: {
    fr: "Mettre fin à un contrat. Une assurance auto ou habitation peut être résiliée à tout moment après 1 an.",
    en: "Ending a contract. Car or home insurance can be cancelled at any time after 1 year.",
    es: "Poner fin a un contrato. Un seguro de coche o de hogar puede cancelarse en cualquier momento tras 1 año.",
    ar: "إنهاء عقد. يمكن إنهاء تأمين السيارة أو السكن في أي وقت بعد سنة.",
  } },
  { id: "mandat", word: "Prélèvement / mandat SEPA", forms: ["mandat sepa", "mandat de prelevement", "autorisation de prelevement", "prelevement sepa"], def: {
    fr: "L'autorisation donnée à un organisme de prendre l'argent sur ton compte. Tu peux la retirer auprès de ta banque.",
    en: "Permission for an organisation to take money from your account. You can withdraw it through your bank.",
    es: "La autorización para que un organismo cobre de tu cuenta. Puedes retirarla en tu banco.",
    ar: "إذن تمنحه لجهة لسحب المال من حسابك. يمكنك إلغاؤه عن طريق بنكك.",
  } },
  { id: "css", word: "Complémentaire santé solidaire", forms: ["complementaire sante solidaire"], def: {
    fr: "Une mutuelle gratuite ou à moins de 1 € par jour pour les revenus modestes, demandée à l'Assurance Maladie.",
    en: "Free or low-cost (under €1 a day) top-up health cover for people on low incomes, requested from the Assurance Maladie.",
    es: "Un seguro complementario gratuito o por menos de 1 € al día para ingresos modestos, pedido a la Assurance Maladie.",
    ar: "تأمين صحي تكميلي مجاني أو بأقل من يورو في اليوم لذوي الدخل المحدود، يُطلب من Assurance Maladie.",
  } },
  { id: "tiers_payant", word: "Tiers payant", forms: ["tiers payant"], def: {
    fr: "Tu n'avances pas l'argent : le médecin ou la pharmacie est payé directement par l'Assurance Maladie (et la mutuelle).",
    en: "You don't pay upfront: the doctor or pharmacy is paid directly by the Assurance Maladie (and your top-up insurer).",
    es: "No adelantas el dinero: el médico o la farmacia cobran directamente de la Assurance Maladie (y la mutua).",
    ar: "لا تدفع مسبقًا: يتقاضى الطبيب أو الصيدلية المال مباشرة من Assurance Maladie (والتأمين التكميلي).",
  } },
  { id: "siret", word: "SIRET", forms: ["siret"], def: {
    fr: "Le numéro d'identité d'une entreprise (14 chiffres). Il permet de vérifier qu'elle existe.",
    en: "A company's identification number (14 digits). It lets you check that it exists.",
    es: "El número de identificación de una empresa (14 cifras). Permite comprobar que existe.",
    ar: "رقم تعريف الشركة (14 رقمًا). يسمح بالتأكد من وجودها.",
  } },
];

/** Les mots du glossaire présents dans un papier, dans l'ordre du glossaire, chacun une fois. */
export function findTerms(text: string): Term[] {
  const f = fold(text).replace(/\n/g, " ");
  return GLOSSARY.filter((t) => t.forms.some((form) => indexOfWord(f, form) !== -1));
}
