// Spécifications techniques des codes à barres 2D-DOC, France Titres (ANTS), V 3.3.9 :
// en-tête § 3.3, message § 3.4.1, signature § 3.5.2, annexe § 3.6, types § 6.1, données § 7.0 à 7.12 et 7.14 à 7.17,
// état du permis : annexe 13. Non décodés : § 7.13 (tests virologiques) et § 7.18 (sûreté aéroportuaire).
const GS = "\x1d";
const RS = "\x1e";
const US = "\x1f";

export interface FieldDef {
  label: string;
  min: number;
  /** Infinity = « Aucune » (pas de borne). */
  max: number;
  kind?:
    | "date8"
    | "dateYmd"
    | "datetime12"
    | "datetime14"
    | "hexdate"
    | "hexInt"
    | "hexYear"
    | "base36"
    | "hhmm"
    | "period"
    | "euros"
    | "eurosInt"
    | "phone"
    | "contract"
    | "nature"
    | "bool"
    | "url"
    | "uuid"
    | "gender"
    | "co2"
    | "airClass"
    | "number";
  /** Valeurs codées → libellé (listes fermées de la spécification). */
  values?: Record<string, string>;
  /**
   * Longueur réelle quand le champ n'est pas fermé par un séparateur : l'EORI est variable (20 au plus) mais fixé
   * à 17 caractères en France (§ 7.12, D2), et les exemples officiels l'écrivent sans séparateur.
   */
  unterminated?: number;
}

const V = Infinity;

/** Identifiants des sections 7.0 à 7.4 (périmètre C40 « 01 »). */
export const FIELDS: Record<string, FieldDef> = {
  // 7.0 Données complémentaires
  "01": { label: "Identifiant unique du document", min: 0, max: V },
  "02": { label: "Catégorie de document", min: 0, max: V },
  "03": { label: "Sous-catégorie de document", min: 0, max: V },
  "04": { label: "Application de composition", min: 0, max: V },
  "05": { label: "Version de l'application de composition", min: 0, max: V },
  "06": { label: "Date de l'association au code", min: 4, max: 4, kind: "hexdate" },
  "07": { label: "Heure de l'association au code", min: 6, max: 6 },
  "08": { label: "Date d'expiration du document", min: 4, max: 4, kind: "hexdate" },
  "09": { label: "Nombre de pages", min: 4, max: 4 },
  "0A": { label: "Éditeur du 2D-Doc (SIREN)", min: 9, max: 9 },
  "0B": { label: "Intégrateur du 2D-Doc (SIREN)", min: 9, max: 9 },
  "0C": { label: "Adresse du document en ligne", min: 0, max: V, kind: "url" },
  "0D": { label: "Identifiant (UUID) du document", min: 36, max: 36, kind: "uuid" },
  // 7.1 Factures
  "10": { label: "Bénéficiaire (ligne 1 de l'adresse)", min: 1, max: 38 },
  "11": { label: "Qualité du bénéficiaire", min: 1, max: 38 },
  "12": { label: "Prénom du bénéficiaire", min: 1, max: 38 },
  "13": { label: "Nom du bénéficiaire", min: 1, max: 38 },
  "14": { label: "Destinataire de la facture (ligne 1)", min: 1, max: 38 },
  "15": { label: "Qualité du destinataire", min: 1, max: 38 },
  "16": { label: "Prénom du destinataire", min: 1, max: 38 },
  "17": { label: "Nom du destinataire", min: 1, max: 38 },
  "18": { label: "Numéro de la facture", min: 1, max: V },
  "19": { label: "Numéro de client", min: 1, max: V },
  "1A": { label: "Numéro du contrat", min: 1, max: V },
  "1B": { label: "Identifiant du souscripteur", min: 1, max: V },
  "1C": { label: "Date d'effet du contrat", min: 8, max: 8, kind: "date8" },
  "1D": { label: "Montant TTC de la facture", min: 0, max: 16, kind: "euros" },
  "1E": { label: "Téléphone du bénéficiaire", min: 0, max: 30, kind: "phone" },
  "1F": { label: "Téléphone du destinataire", min: 0, max: 30, kind: "phone" },
  "1G": { label: "Autre bénéficiaire non mentionné", min: 1, max: 1, kind: "bool" },
  "1H": { label: "Autre destinataire non mentionné", min: 1, max: 1, kind: "bool" },
  "1I": { label: "Co-bénéficiaire (ligne 1)", min: 0, max: 38 },
  "1J": { label: "Qualité du co-bénéficiaire", min: 0, max: 38 },
  "1K": { label: "Prénom du co-bénéficiaire", min: 0, max: 38 },
  "1L": { label: "Nom du co-bénéficiaire", min: 0, max: 38 },
  "1M": { label: "Co-destinataire (ligne 1)", min: 0, max: 38 },
  "1N": { label: "Qualité du co-destinataire", min: 0, max: 38 },
  "1O": { label: "Prénom du co-destinataire", min: 0, max: 38 },
  "1P": { label: "Nom du co-destinataire", min: 0, max: 38 },
  "20": { label: "Adresse du lieu de service (ligne 2)", min: 0, max: 38 },
  "21": { label: "Adresse du lieu de service (ligne 3)", min: 1, max: 38 },
  "22": { label: "Adresse du lieu de service (n° et voie)", min: 1, max: 38 },
  "23": { label: "Adresse du lieu de service (ligne 5)", min: 0, max: 38 },
  "24": { label: "Code postal du lieu de service", min: 5, max: 5 },
  "25": { label: "Commune du lieu de service", min: 1, max: 32 },
  "26": { label: "Pays du lieu de service", min: 2, max: 2 },
  "27": { label: "Adresse du destinataire (ligne 2)", min: 0, max: 38 },
  "28": { label: "Adresse du destinataire (ligne 3)", min: 0, max: 38 },
  "29": { label: "Adresse du destinataire (n° et voie)", min: 1, max: 38 },
  "2A": { label: "Adresse du destinataire (ligne 5)", min: 0, max: 38 },
  "2B": { label: "Code postal du destinataire", min: 5, max: 5 },
  "2C": { label: "Commune du destinataire", min: 1, max: 32 },
  "2D": { label: "Pays du destinataire", min: 2, max: 2 },
  // 7.2 Données bancaires
  "30": { label: "Titulaire (qualité, nom, prénom)", min: 0, max: 140 },
  "31": { label: "IBAN", min: 14, max: 38 },
  "32": { label: "BIC", min: 8, max: 11 },
  "33": { label: "BBAN", min: 0, max: 30 },
  "34": { label: "Pays du compte", min: 2, max: 2 },
  "35": { label: "Identifiant SEPAmail", min: 14, max: 34 },
  "36": { label: "Début de période", min: 4, max: 4, kind: "hexdate" },
  "37": { label: "Fin de période", min: 4, max: 4, kind: "hexdate" },
  "38": { label: "Solde en début de période", min: 0, max: 11, kind: "euros" },
  "39": { label: "Solde en fin de période", min: 0, max: 11, kind: "euros" },
  // 7.3 Données fiscales
  "40": { label: "Numéro fiscal", min: 13, max: 13 },
  "41": { label: "Revenu fiscal de référence", min: 0, max: 12, kind: "eurosInt" },
  "42": { label: "Situation du foyer", min: 0, max: V },
  "43": { label: "Nombre de parts", min: 1, max: 5 },
  "44": { label: "Référence de l'avis d'impôt", min: 13, max: 13 },
  "45": { label: "Année des revenus", min: 4, max: 4 },
  "46": { label: "Déclarant 1", min: 0, max: 38 },
  "47": { label: "Numéro fiscal du déclarant 1", min: 13, max: 13 },
  "48": { label: "Déclarant 2", min: 0, max: 38 },
  "49": { label: "Numéro fiscal du déclarant 2", min: 13, max: 13 },
  "4A": { label: "Date de mise en recouvrement", min: 8, max: 8, kind: "date8" },
  "4B": { label: "Date de la déclaration", min: 8, max: 8, kind: "date8" },
  "4C": { label: "Date d'enregistrement", min: 8, max: 8, kind: "date8" },
  "4D": { label: "Montant du don", min: 0, max: 12, kind: "eurosInt" },
  "4E": { label: "Montant des droits payés", min: 0, max: 12, kind: "eurosInt" },
  "4F": { label: "Référence d'enregistrement", min: 15, max: 15 },
  "4G": { label: "Nom du donataire", min: 0, max: 38 },
  "4H": { label: "Donateur(s)", min: 0, max: 77 },
  "4I": { label: "Montant taxable", min: 0, max: 12, kind: "eurosInt" },
  "4J": { label: "Montant de la cession", min: 0, max: 12, kind: "eurosInt" },
  "4K": { label: "Cessionnaire", min: 0, max: 38 },
  "4L": { label: "Cédant", min: 0, max: 38 },
  "4M": { label: "Taux applicable (%)", min: 0, max: 3 },
  "4N": { label: "Déclarant", min: 0, max: 38 },
  "4O": { label: "Adresse du déclarant", min: 0, max: 38 },
  "4P": { label: "Code postal du déclarant", min: 5, max: 5 },
  "4Q": { label: "Commune du déclarant", min: 0, max: 32 },
  "4R": { label: "Service des impôts gestionnaire", min: 0, max: 30 },
  "4S": { label: "Millésime", min: 4, max: 4 },
  "4T": { label: "Administration cantonale suisse", min: 0, max: 30 },
  "4U": { label: "Employeur", min: 0, max: 38 },
  "4V": { label: "Impôt sur le revenu net", min: 0, max: 10, kind: "eurosInt" },
  "4W": { label: "Reste à payer", min: 0, max: 10, kind: "eurosInt" },
  "4X": { label: "Retenue à la source", min: 0, max: 10, kind: "eurosInt" },
  "4Y": { label: "Adresse complète du domicile", min: 1, max: 155 },
  "4Z": { label: "Prélèvements sociaux nets", min: 0, max: 10, kind: "eurosInt" },
  // 7.4 Activité professionnelle
  "50": { label: "SIRET de l'employeur", min: 14, max: 14 },
  "51": { label: "Heures travaillées", min: 6, max: 6 },
  "52": { label: "Cumul des heures travaillées", min: 7, max: 7 },
  "53": { label: "Début de période", min: 4, max: 4, kind: "hexdate" },
  "54": { label: "Fin de période", min: 4, max: 4, kind: "hexdate" },
  "55": { label: "Début du contrat", min: 8, max: 8, kind: "date8" },
  "56": { label: "Fin du contrat", min: 4, max: 4, kind: "hexdate" },
  "57": { label: "Signature du contrat", min: 8, max: 8, kind: "date8" },
  "58": { label: "Salaire net imposable", min: 0, max: 11, kind: "euros" },
  "59": { label: "Cumul du net imposable", min: 0, max: 12, kind: "euros" },
  "5A": { label: "Salaire brut du mois", min: 0, max: 11, kind: "euros" },
  "5B": { label: "Cumul du salaire brut", min: 0, max: 12, kind: "euros" },
  "5C": { label: "Salaire net", min: 0, max: 11, kind: "euros" },
  "5D": { label: "Adresse de l'employeur (ligne 2)", min: 0, max: 38 },
  "5E": { label: "Adresse de l'employeur (ligne 3)", min: 0, max: 38 },
  "5F": { label: "Adresse de l'employeur (n° et voie)", min: 0, max: 38 },
  "5G": { label: "Adresse de l'employeur (ligne 5)", min: 0, max: 38 },
  "5H": { label: "Code postal de l'employeur", min: 5, max: 5 },
  "5I": { label: "Commune de l'employeur", min: 0, max: 32 },
  "5J": { label: "Pays de l'employeur", min: 2, max: 2 },
  "5K": { label: "Identifiant cotisant (URSSAF)", min: 0, max: 50 },
  "5L": { label: "SIRET ou RNA", min: 9, max: 14 },
  "5M": { label: "Dénomination sociale", min: 0, max: 38 },
  "5N": { label: "Dossier d'autorisation de travail", min: 21, max: 21 },
  "5O": { label: "Nom de l'employeur", min: 0, max: 38 },
  "5P": { label: "Prénom de l'employeur", min: 0, max: 20 },
  "5Q": { label: "Nom du déclarant", min: 0, max: 38 },
  "5R": { label: "Prénom du déclarant", min: 0, max: 20 },
  "5S": { label: "Fonction du déclarant", min: 0, max: 40 },
  "5T": { label: "Type de contrat", min: 1, max: 1, kind: "contract" },
  "5U": { label: "Durée du contrat", min: 0, max: 12 },
  "5V": { label: "Période de déclaration", min: 12, max: 12, kind: "period" },
  "5W": { label: "Nature du contrat", min: 2, max: 2, kind: "nature" },
  "5X": { label: "Intitulé du poste", min: 1, max: 38 },
  "5Y": { label: "Période de rémunération", min: 12, max: 12, kind: "period" },
  "5Z": { label: "Rémunération de la période", min: 1, max: 11, kind: "eurosInt" },
  // 7.5 Titres d'identité
  "60": { label: "Prénoms", min: 0, max: 60 },
  "61": { label: "Prénom", min: 0, max: 20 },
  "62": { label: "Nom de naissance", min: 0, max: 38 },
  "63": { label: "Nom d'usage", min: 0, max: 38 },
  "64": { label: "Nom d'épouse ou d'époux", min: 0, max: 38 },
  "65": { label: "Type de pièce d'identité", min: 2, max: 2 },
  "66": { label: "Numéro de la pièce d'identité", min: 0, max: 20 },
  "67": { label: "Nationalité", min: 2, max: 2 },
  "68": { label: "Genre", min: 1, max: 1, kind: "gender" },
  "69": { label: "Date de naissance", min: 8, max: 8, kind: "date8" },
  "6A": { label: "Lieu de naissance", min: 0, max: 32 },
  "6B": { label: "Département du bureau émetteur", min: 3, max: 3 },
  "6C": { label: "Pays de naissance", min: 2, max: 2 },
  "6D": { label: "Nom et prénom du père", min: 0, max: 60 },
  "6E": { label: "Nom et prénom de la mère", min: 0, max: 60 },
  "6F": { label: "Bande de lecture automatique (MRZ)", min: 0, max: 90 },
  "6G": { label: "Nom", min: 1, max: 38 },
  "6H": { label: "Civilité", min: 1, max: 10 },
  "6I": { label: "Pays émetteur", min: 2, max: 2 },
  "6J": { label: "Type de document étranger", min: 1, max: 1 },
  "6K": { label: "Numéro de la demande", min: 19, max: 19 },
  "6L": { label: "Date de dépôt de la demande", min: 8, max: 8, kind: "date8" },
  "6M": { label: "Catégorie du titre", min: 0, max: 40 },
  "6N": { label: "Début de validité", min: 8, max: 8, kind: "date8" },
  "6O": { label: "Fin de validité", min: 8, max: 8, kind: "date8" },
  "6P": { label: "Autorisation", min: 0, max: 40 },
  "6Q": { label: "Numéro d'étranger", min: 0, max: 10 },
  "6R": { label: "Numéro de visa", min: 12, max: 12 },
  "6S": { label: "Adresse du domicile (ligne 2)", min: 0, max: 38 },
  "6T": { label: "Adresse du domicile (ligne 3)", min: 0, max: 38 },
  "6U": { label: "Adresse du domicile (n° et voie)", min: 0, max: 38 },
  "6V": { label: "Adresse du domicile (ligne 5)", min: 0, max: 38 },
  "6W": { label: "Code postal du domicile", min: 5, max: 5 },
  "6X": { label: "Commune du domicile", min: 0, max: 32 },
  "6Y": { label: "Pays du domicile", min: 2, max: 2 },
  "6Z": { label: "Numéro d'étranger (autorisation de travail)", min: 9, max: 11 },
  // 7.6 Données de santé (certificat de décès, preuve de vie)
  "70": { label: "Date et heure du décès", min: 12, max: 12, kind: "datetime12" },
  "71": { label: "Date et heure du constat de décès", min: 12, max: 12, kind: "datetime12" },
  "72": { label: "Nom du défunt", min: 0, max: 38 },
  "73": { label: "Prénoms du défunt", min: 0, max: 60 },
  "74": { label: "Nom de naissance du défunt", min: 0, max: 38 },
  "75": { label: "Date de naissance du défunt", min: 8, max: 8, kind: "date8" },
  "76": { label: "Genre du défunt", min: 1, max: 1, kind: "gender" },
  "77": { label: "Commune du décès", min: 0, max: 45 },
  "78": { label: "Code postal de la commune du décès", min: 5, max: 5 },
  "79": { label: "Adresse du domicile du défunt", min: 0, max: 114 },
  "7A": { label: "Code postal du domicile du défunt", min: 5, max: 5 },
  "7B": { label: "Commune du domicile du défunt", min: 0, max: 45 },
  "7C": { label: "Obstacle médico-légal", min: 1, max: 1, kind: "bool" },
  "7D": { label: "Mise en bière", min: 1, max: 1, values: { O: "pas de mise en bière", S: "cercueil simple", H: "cercueil hermétique" } },
  "7E": { label: "Obstacle aux soins de conservation", min: 1, max: 1, kind: "bool" },
  "7F": { label: "Obstacle au don du corps", min: 1, max: 1, kind: "bool" },
  "7G": { label: "Recherche de la cause du décès", min: 1, max: 1, kind: "bool" },
  "7H": { label: "Délai de transport du corps", min: 2, max: 2, kind: "hexInt" },
  "7I": { label: "Prothèse avec pile", min: 1, max: 1, kind: "bool" },
  "7J": { label: "Retrait de la pile de prothèse", min: 1, max: 1, kind: "bool" },
  "7K": { label: "Code NNC", min: 13, max: 13 },
  "7L": { label: "Code FINESS de l'organisme agréé", min: 9, max: 9 },
  "7M": { label: "Médecin", min: 0, max: 64 },
  "7N": { label: "Lieu de validation du certificat de décès", min: 0, max: 128 },
  "7O": { label: "Certificat de décès supplémentaire", min: 1, max: 1, kind: "bool" },
  "7P": { label: "Identifiant du certificat de décès", min: 16, max: 16 },
  "87": { label: "Assuré : nom de naissance", min: 0, max: 63 },
  "88": { label: "Assuré : identifiant", min: 5, max: 10 },
  "89": { label: "Assuré : adresse mail", min: 1, max: 64 },
  "8A": { label: "Assuré : début de campagne", min: 8, max: 8, kind: "date8" },
  "8B": { label: "Assuré : identifiant d'enquête", min: 5, max: 10 },
  "8C": { label: "Identifiant du certificat d'existence", min: 0, max: 10 },
  "8D": { label: "Date d'émission du certificat", min: 14, max: 14, kind: "datetime14" },
  "8E": { label: "Remarié(e)", min: 1, max: 1, kind: "bool" },
  "8F": { label: "Non remarié(e)", min: 1, max: 1, kind: "bool" },
  "8G": { label: "En concubinage", min: 1, max: 1, kind: "bool" },
  "8H": { label: "Pacsé(e)", min: 1, max: 1, kind: "bool" },
  "8I": { label: "Date de mise en concubinage", min: 8, max: 8, kind: "date8" },
  "8J": { label: "Courrier dématérialisé", min: 1, max: 1, kind: "bool" },
  "8K": { label: "Adresse mail de contact", min: 1, max: 64 },
  // 7.7 Activités professionnelles, traduction certifiée
  "80": { label: "Nom", min: 0, max: 38 },
  "81": { label: "Prénoms", min: 0, max: 60 },
  "82": { label: "Numéro de carte", min: 0, max: 20 },
  "83": { label: "Organisme de tutelle", min: 0, max: 40 },
  "84": { label: "Profession", min: 0, max: 40 },
  "85": { label: "Numéro de permis de chasser", min: 17, max: 17 },
  "86": { label: "Numéro de licence", min: 12, max: 12 },
  "8L": { label: "Prénoms du traducteur", min: 0, max: 60 },
  "8M": { label: "Nom du traducteur", min: 1, max: 38 },
  "8N": { label: "Date de la traduction", min: 8, max: 8, kind: "date8" },
  "8O": { label: "Identifiant de la traduction", min: 5, max: 12 },
  "8P": { label: "Application de composition de la traduction", min: 0, max: V },
  // 7.8 Données juridiques / judiciaires
  "90": { label: "Huissier ou commissaire de justice", min: 0, max: 38 },
  "91": { label: "Demandeur", min: 0, max: 38 },
  "92": { label: "Destinataire", min: 0, max: 38 },
  "93": { label: "Tiers concerné", min: 0, max: 38 },
  "94": { label: "Intitulé de l'acte", min: 0, max: 38 },
  "95": { label: "Numéro de l'acte", min: 0, max: 18 },
  "96": { label: "Date de signature de l'acte", min: 8, max: 8, kind: "date8" },
  // 7.9 Véhicules, points du permis
  A0: { label: "Pays d'immatriculation", min: 2, max: 2 },
  A1: { label: "Immatriculation", min: 0, max: 17 },
  A2: { label: "Marque", min: 0, max: 17 },
  A3: { label: "Nom commercial", min: 0, max: 17 },
  A4: { label: "Numéro de série (VIN)", min: 17, max: 17 },
  A5: { label: "Catégorie du véhicule", min: 3, max: 3 },
  A6: { label: "Carburant", min: 2, max: 2 },
  A7: { label: "Émissions de CO2", min: 3, max: 3, kind: "co2" },
  A8: { label: "Classe environnementale de réception CE", min: 0, max: 12 },
  A9: { label: "Classe d'émission polluante", min: 3, max: 3, kind: "airClass" },
  AA: { label: "Première immatriculation", min: 8, max: 8, kind: "date8" },
  AB: { label: "Type de lettre", min: 0, max: 8 },
  AC: { label: "Numéro de dossier", min: 0, max: 19 },
  AD: { label: "Date de l'infraction", min: 4, max: 4, kind: "hexdate" },
  AE: { label: "Heure de l'infraction", min: 4, max: 4, kind: "hhmm" },
  AF: { label: "Points retirés", min: 1, max: 1, kind: "base36" },
  AG: { label: "Solde de points", min: 1, max: 1, kind: "base36" },
  AH: { label: "Numéro de la carte", min: 0, max: 30 },
  AI: { label: "Date d'expiration initiale", min: 8, max: 8, kind: "date8" },
  AJ: { label: "Numéro EVTC", min: 13, max: 13 },
  AK: { label: "Numéro de macaron", min: 7, max: 7 },
  AL: { label: "Numéro de la carte", min: 11, max: 11 },
  AM: { label: "Motif de sur-classement", min: 0, max: 5 },
  AN: { label: "Kilométrage", min: 8, max: 8, kind: "number" },
  AO: { label: "Numéro d'identification", min: 6, max: 6 },
  AP: { label: "Type d'engin", min: 0, max: 60 },
  AQ: { label: "Numéro de série", min: 0, max: 25 },
  AR: { label: "Modèle", min: 0, max: 35 },
  AS: { label: "Couleur dominante", min: 0, max: 10 },
  AT: { label: "Type de propriétaire", min: 1, max: 1 },
  AU: { label: "Adresse du propriétaire (ligne 2)", min: 0, max: 38 },
  AV: { label: "Adresse du propriétaire (ligne 3)", min: 0, max: 38 },
  AW: { label: "Adresse du propriétaire (n° et voie)", min: 0, max: 38 },
  AX: { label: "Adresse du propriétaire (ligne 5)", min: 0, max: 38 },
  AY: { label: "Code postal du propriétaire", min: 5, max: 5 },
  AZ: { label: "Commune du propriétaire", min: 0, max: 32 },
  // 7.10 Justificatifs académiques
  B0: { label: "Prénoms", min: 0, max: 60 },
  B1: { label: "Prénom", min: 0, max: 20 },
  B2: { label: "Nom de naissance", min: 0, max: 38 },
  B3: { label: "Nom d'usage", min: 0, max: 38 },
  B4: { label: "Nom d'épouse ou d'époux", min: 0, max: 38 },
  B5: { label: "Nationalité", min: 2, max: 2 },
  B6: { label: "Genre", min: 1, max: 1, kind: "gender" },
  B7: { label: "Date de naissance", min: 8, max: 8, kind: "date8" },
  B8: { label: "Lieu de naissance", min: 0, max: 32 },
  B9: { label: "Pays de naissance", min: 2, max: 2 },
  BA: {
    label: "Mention obtenue",
    min: 1,
    max: 1,
    values: { "0": "aucune", "1": "passable", "2": "assez bien", "3": "bien", "4": "très bien", "5": "très honorable", "6": "félicitations du jury" },
  },
  BB: { label: "Numéro d'étudiant (INE)", min: 0, max: 50 },
  BC: { label: "Numéro du diplôme", min: 0, max: 20 },
  BD: { label: "Niveau du diplôme (cadre européen)", min: 1, max: 1 },
  BE: { label: "Crédits ECTS obtenus", min: 3, max: 3, kind: "number" },
  BF: { label: "Année universitaire", min: 3, max: 3, kind: "hexYear" },
  BG: {
    label: "Type de diplôme",
    min: 2,
    max: 2,
    values: {
      BR: "brevet des collèges",
      CA: "CAP",
      BE: "BEP",
      BA: "baccalauréat général",
      BP: "baccalauréat professionnel",
      BS: "baccalauréat technologique",
      BT: "BTS",
      DU: "DUT",
      LC: "licence",
      LP: "licence professionnelle",
      DE: "DEES",
      MA: "master",
      MB: "MBA",
      IN: "diplôme d'ingénieur",
      DR: "doctorat",
    },
  },
  BH: { label: "Domaine", min: 0, max: 30 },
  BI: { label: "Mention", min: 0, max: 30 },
  BJ: { label: "Spécialité", min: 0, max: 30 },
  BK: { label: "Numéro d'attestation CVEC", min: 14, max: 14 },
  // 7.11 Certificat de cession électronique
  C0: { label: "Genre du vendeur", min: 1, max: 1, kind: "gender" },
  C1: { label: "Nom du vendeur", min: 0, max: 38 },
  C2: { label: "Prénom du vendeur", min: 0, max: 20 },
  C3: { label: "Date et heure de la cession", min: 12, max: 12, kind: "datetime12" },
  C4: { label: "Signature du vendeur", min: 8, max: 8, kind: "date8" },
  C5: { label: "Genre de l'acheteur", min: 1, max: 1, kind: "gender" },
  C6: { label: "Nom de l'acheteur", min: 0, max: 38 },
  C7: { label: "Prénom de l'acheteur", min: 0, max: 20 },
  C8: { label: "Adresse de l'acheteur (n° et voie)", min: 0, max: 38 },
  C9: { label: "Code postal de l'acheteur", min: 5, max: 5 },
  CA: { label: "Commune de l'acheteur", min: 0, max: 45 },
  CB: { label: "Numéro d'enregistrement", min: 10, max: 10, kind: "number" },
  CC: { label: "Enregistrement dans le SIV", min: 12, max: 12, kind: "datetime12" },
  // 7.12 Autorisations douanières
  D0: { label: "Référence RTC", min: 17, max: 17 },
  D1: { label: "Titulaire", min: 0, max: 50 },
  D2: { label: "EORI", min: 0, max: 20, unterminated: 17 },
  D3: { label: "Début de validité", min: 8, max: 8, kind: "dateYmd" },
  D4: { label: "Fin de validité", min: 8, max: 8, kind: "dateYmd" },
  D5: { label: "Code marchandise", min: 8, max: 10 },
  D6: { label: "Numéro de décision", min: 8, max: 8 },
  D7: { label: "Date de décision", min: 8, max: 8, kind: "date8" },
  D8: { label: "Durée de validité (mois)", min: 2, max: 2, kind: "number" },
  D9: { label: "Fin de validité de la licence", min: 8, max: 8, kind: "date8" },
  DA: { label: "Numéro de licence", min: 8, max: 8 },
  DB: { label: "Nom de l'expéditeur", min: 0, max: 50 },
  DC: { label: "Prénom de l'expéditeur", min: 0, max: 50 },
  DD: { label: "Date de naissance de l'expéditeur", min: 8, max: 8, kind: "date8" },
  DE: { label: "Raison sociale de l'expéditeur", min: 0, max: 50 },
  DF: { label: "SIREN de l'expéditeur", min: 9, max: 9 },
  DG: { label: "SIRET de l'expéditeur", min: 14, max: 14 },
  DH: { label: "EORI de l'expéditeur", min: 0, max: 20, unterminated: 17 },
  DI: { label: "TIN de l'expéditeur", min: 4, max: 30 },
  DJ: { label: "Nom de l'exportateur", min: 0, max: 50 },
  DK: { label: "Prénom de l'exportateur", min: 0, max: 50 },
  DL: { label: "Date de naissance de l'exportateur", min: 8, max: 8, kind: "date8" },
  DM: { label: "Raison sociale de l'exportateur", min: 0, max: 50 },
  DN: { label: "SIREN de l'exportateur", min: 9, max: 9 },
  DO: { label: "SIRET de l'exportateur", min: 14, max: 14 },
  DP: { label: "EORI de l'exportateur", min: 0, max: 20, unterminated: 17 },
  DQ: { label: "Nom du destinataire", min: 0, max: 50 },
  DR: { label: "Prénom du destinataire", min: 0, max: 50 },
  DS: { label: "Date de naissance du destinataire", min: 8, max: 8, kind: "date8" },
  DT: { label: "Raison sociale du destinataire", min: 0, max: 50 },
  DU: { label: "SIREN du destinataire", min: 9, max: 9 },
  DV: { label: "SIRET du destinataire", min: 14, max: 14 },
  DW: { label: "EORI du destinataire", min: 0, max: 20, unterminated: 17 },
  DX: { label: "TIN du destinataire", min: 4, max: 30 },
  DY: { label: "Nombre de lignes d'articles", min: 3, max: 3, kind: "number" },
  DZ: { label: "Numéro du bon de livraison", min: 0, max: 10 },
  H0: { label: "Commune de l'expéditeur", min: 0, max: 38 },
  H1: { label: "Pays de l'expéditeur", min: 2, max: 2 },
  H2: { label: "Commune du destinataire", min: 0, max: 38 },
  H3: { label: "Pays du destinataire", min: 2, max: 2 },
  H4: { label: "Date de départ", min: 8, max: 8, kind: "date8" },
  H5: { label: "Date prévue d'arrivée", min: 8, max: 8, kind: "date8" },
  H6: { label: "Numéro de plomb", min: 0, max: 40 },
  H7: { label: "Codes douaniers", min: 0, max: 53 },
  H8: { label: "Nombre d'emballages", min: 7, max: 7, kind: "number" },
  H9: { label: "Poids brut", min: 8, max: 8, kind: "number" },
  HA: { label: "Poids net", min: 8, max: 8, kind: "number" },
  HB: { label: "Valeur douanière", min: 9, max: 9, kind: "number" },
  HC: { label: "But de la livraison", min: 0, max: 38 },
  HD: { label: "Adresse de l'expéditeur", min: 0, max: 38 },
  HE: { label: "Code postal et commune de l'expéditeur", min: 0, max: 38 },
  HF: { label: "Adresse du destinataire", min: 0, max: 38 },
  HG: { label: "Code postal et commune du destinataire", min: 0, max: 38 },
  HH: { label: "Numéro du transport", min: 0, max: 20 },
  HI: { label: "Adresse de résidence (n° et voie)", min: 0, max: 38 },
  HJ: { label: "Code postal de résidence", min: 5, max: 5 },
  HK: { label: "Commune de résidence", min: 0, max: 32 },
  HL: { label: "Pays de résidence", min: 2, max: 2 },
  HM: { label: "Numéro de la carte européenne d'arme à feu", min: 15, max: 18 },
  HN: { label: "Date et heure d'édition", min: 12, max: 12, kind: "datetime12" },
  HO: { label: "Date d'expiration", min: 8, max: 8, kind: "date8" },
  HP: { label: "Numéro SIA", min: 12, max: 12 },
  HQ: { label: "Armes de catégorie A", min: 2, max: 2, kind: "number" },
  HR: { label: "Armes de catégorie B", min: 2, max: 2, kind: "number" },
  HS: { label: "Armes de catégorie C", min: 2, max: 2, kind: "number" },
  // 7.14 Attestation vaccinale
  L0: { label: "Nom du patient", min: 0, max: 80 },
  L1: { label: "Prénoms du patient", min: 0, max: 80 },
  L2: { label: "Date de naissance du patient", min: 8, max: 8, kind: "date8" },
  L3: { label: "Maladie couverte", min: 0, max: 30 },
  L4: { label: "Agent prophylactique", min: 5, max: 15 },
  L5: { label: "Vaccin", min: 5, max: 30 },
  L6: { label: "Fabricant du vaccin", min: 5, max: 30 },
  L7: { label: "Rang de la dernière dose", min: 1, max: 1 },
  L8: { label: "Doses pour un cycle complet", min: 1, max: 1 },
  L9: { label: "Date de la dernière dose", min: 8, max: 8, kind: "date8" },
  LA: { label: "État du cycle de vaccination", min: 2, max: 2, values: { CO: "terminé", TE: "en cours" } },
  // 7.15 Asile
  G0: {
    label: "Type de procédure",
    min: 2,
    max: 2,
    values: { PN: "procédure normale", PA: "procédure accélérée", PD: "procédure Dublin", PF: "procédure de filtrage à la frontière" },
  },
  G1: {
    label: "Orientation régionale",
    min: 2,
    max: 2,
    values: {
      KO: "aucune",
      AR: "Auvergne-Rhône-Alpes",
      BF: "Bourgogne-Franche-Comté",
      BR: "Bretagne",
      CV: "Centre-Val de Loire",
      GE: "Grand Est",
      HF: "Hauts-de-France",
      IF: "Île-de-France",
      NO: "Normandie",
      NA: "Nouvelle-Aquitaine",
      OC: "Occitanie",
      PL: "Pays de la Loire",
      PA: "Provence-Alpes-Côte d'Azur",
    },
  },
  G2: { label: "Numéro d'usager", min: 0, max: 20 },
  G3: { label: "Fin des droits", min: 8, max: 8, kind: "date8" },
  G4: { label: "Total versé au titre de l'ADA", min: 0, max: 10, kind: "euros" },
  G5: { label: "Direction territoriale", min: 0, max: 45 },
  // 7.16 Permis de conduire
  E0: {
    label: "Type d'arrêté",
    min: 2,
    max: 2,
    values: {
      "1A": "restriction aux véhicules équipés d'un éthylotest antidémarrage",
      "1B": "restriction aux véhicules équipés d'un éthylotest antidémarrage",
      "1E": "interdiction temporaire de conduire en France",
      "1F": "suspension provisoire du permis",
      "2E": "interdiction temporaire d'urgence de conduire en France",
      "2F": "suspension provisoire d'urgence du permis",
      "3A": "restriction immédiate aux véhicules équipés d'un éthylotest antidémarrage",
      "3B": "restriction immédiate aux véhicules équipés d'un éthylotest antidémarrage",
      "3E": "interdiction provisoire immédiate de conduire en France",
      "3F": "suspension provisoire immédiate du permis",
      "3I": "interdiction temporaire de passer un examen",
      "43": "récépissé de remise du certificat de conduite",
      "44": "récépissé de remise du titre",
      "47": "récupération de points après un stage",
      "4E": "arrêté modifiant ou confirmant un arrêté précédent",
      "4F": "arrêté modifiant ou confirmant un arrêté précédent",
      "4X": "non-attribution de points après un stage",
      "50": "avertissement",
      "56": "arrêté rapportant un arrêté précédent",
      "57": "arrêté rapportant un avertissement précédent",
      "58": "interdiction de délivrance d'un permis",
      "60": "retrait d'un permis obtenu irrégulièrement ou frauduleusement",
      "61": "mesures après un contrôle médical de l'aptitude à la conduite",
      "62": "suspension du permis faute de visite médicale",
    },
  },
  E1: { label: "Édition du document", min: 4, max: 4, kind: "hexdate" },
  E2: { label: "Fin de la sanction", min: 4, max: 4, kind: "hexdate" },
  E3: { label: "Date de notification", min: 4, max: 4, kind: "hexdate" },
  E4: {
    label: "Type de relevé",
    min: 3,
    max: 3,
    values: {
      RII: "relevé d'information intégral",
      RIR: "relevé d'information restreint",
      ADC: "attestation des droits à conduire",
      RRP: "relevé de reconstitution du capital de points",
      APC: "attestation de permis de conduire",
    },
  },
  E5: { label: "État du permis", min: 2, max: 2 },
  E6: { label: "Catégories du permis", min: 0, max: 65 },
  E7: { label: "SIREN du demandeur", min: 9, max: 9 },
  E8: { label: "Date des données du fichier national", min: 12, max: 12, kind: "datetime12" },
  E9: { label: "Numéro de dossier", min: 0, max: 19 },
  EA: { label: "Épreuve", min: 1, max: 1, values: { T: "théorique (code)", P: "pratique (conduite)" } },
  EB: { label: "Matricule de l'inspecteur", min: 5, max: 5 },
  EC: { label: "Date de l'examen", min: 8, max: 8, kind: "date8" },
  ED: { label: "Catégorie de permis", min: 1, max: 3 },
  EE: { label: "Codes spécifiques", min: 0, max: 100 },
  EF: { label: "Visite médicale demandée", min: 1, max: 1, kind: "bool" },
  // 7.17 Caducée infirmier
  I0: { label: "Année du caducée", min: 4, max: 4 },
  I1: { label: "Numéro ordinal", min: 7, max: 7 },
  I2: { label: "Mention spécifique", min: 16, max: 16 },
  I3: { label: "Nom d'exercice", min: 1, max: 54 },
  I4: { label: "Prénom d'exercice", min: 1, max: 37 },
  I5: {
    label: "Mode d'exercice",
    min: 5,
    max: 13,
    values: {
      LIBERAL: "libéral",
      MIXTE: "mixte",
      "SAL-PRIVE": "salarié (privé)",
      "SAL-PUBLIC": "salarié (public)",
      BENEVOLE: "bénévole",
      "SANS-EXERCICE": "sans activité",
      RETRAITE: "retraité",
      RESERVE: "réserve sanitaire",
    },
  },
  I6: { label: "Numéro RPPS", min: 11, max: 11 },
};

/** Type de pièce d'identité (identifiant 65) : la 2e lettre éventuelle précise le passeport ou le visa. */
const ID_KINDS: Record<string, string> = { ID: "carte d'identité", IR: "titre de séjour", V: "visa", D: "permis de conduire", P: "passeport" };

/** État du permis de conduire (identifiant E5), annexe 13. */
export const LICENCE_STATES: Record<string, string> = {
  "01": "à authentifier",
  "02": "annulé (décision administrative)",
  "03": "annulé (décision judiciaire)",
  "04": "annulé (raison médicale)",
  "05": "aucun droit",
  "06": "contrôle impossible",
  "07": "titulaire décédé",
  "08": "demandé",
  "09": "duplicata demandé",
  "10": "interdiction de conduire tous véhicules",
  "11": "interdiction d'obtenir",
  "12": "interdiction de solliciter",
  "13": "invalide",
  "14": "non authentifié",
  "47": "suspendu",
  "48": "suspendu (raison médicale)",
  "49": "titre falsifié",
  "50": "valide",
  "54": "valide avec éthylotest antidémarrage",
};

/** Libellé d'une valeur codée pour les identifiants dont la liste demande un traitement à part. */
function special(id: string, v: string): string | null {
  if (id === "65") return ID_KINDS[v] ?? ID_KINDS[v.slice(0, 1)] ?? null;
  if (id === "E5") return LICENCE_STATES[v] ?? (/^\d{2}$/.test(v) ? `code ${v} (permis échangé ou européen, voir l'annexe 13)` : null);
  return null;
}

/** Types de documents, périmètre « 01 » (section 6.1). */
export const DOC_TYPES_2D: Record<string, string> = {
  "00": "Justificatif de domicile",
  "01": "Facture (énergie, téléphone, internet, eau)",
  "02": "Avis de taxe d'habitation",
  "03": "Relevé d'identité bancaire",
  "05": "Relevé d'identité SEPAmail",
  "11": "Relevé de compte",
  "09": "Facture étendue",
  "19": "Déclaration de dons",
  "20": "Déclaration de cession de droits sociaux",
  "21": "Attestation 2041-ASK",
  "04": "Avis d'impôt sur les revenus",
  "06": "Bulletin de salaire",
  "18": "Avis de situation déclarative à l'impôt sur les revenus",
  "24": "Avis de situation déclarative à l'impôt sur les revenus (V2)",
  "27": "Avis de situation déclarative à l'impôt sur les revenus (V3)",
  "28": "Avis d'impôt sur les revenus (V2)",
  "10": "Contrat de travail",
  "15": "Attestation de décision favorable d'autorisation de travail",
  "25": "Autorisation de travail – AES métier en tension",
  "29": "Attestation d'activité professionnelle",
  "07": "Titre d'identité",
  "08": "MRZ",
  "13": "Document étranger",
  A0: "Certificat de qualité de l'air",
  A7: "Certificat de qualité de l'air (V2)",
  "14": "Attestation DICEM",
  A8: "Certificat de cession électronique",
  A1: "Courrier permis à points",
  AA: "Arrêté permis de conduire",
  AB: "Relevé d'information permis de conduire",
  AD: "Certificat de réussite à l'examen du permis (CEPC)",
  B0: "Diplôme",
  B1: "Attestation de contribution vie étudiante (CVEC)",
  B4: "Traduction certifiée",
  A4: "Certificat de décès",
  AE: "Certificat de décès V2",
  A2: "Carte mobilité inclusion (CMI)",
  "23": "Certificat de preuve de vie",
  A3: "Macaron VTC",
  A5: "Carte T3P",
  A6: "Carte professionnelle sapeur-pompier",
  A9: "Permis de chasser",
  AC: "Licence de conducteur de train",
  "12": "Acte d'huissier",
  "22": "Carte européenne d'arme à feu",
  C1: "Renseignement tarifaire contraignant",
  C2: "Accord préalable de transfert d'armes",
  C3: "Permis de transfert d'armes à feu et de munitions",
  C4: "Autorisation d'importation de matériels de guerre",
  C5: "Licence d'exportation d'armes à feu",
  C6: "Agrément de transfert d'armes à feu et de munitions",
  C7: "Bon de livraison",
  C8: "Bon de livraison V2",
  B2: "Test COVID",
  B3: "Titrage antirabique",
  L1: "Attestation vaccinale",
  "16": "Attestation de demande d'asile",
  "17": "Attestation de fin de droit à l'ADA",
  C9: "Caducée infirmier",
  "26": "Certificat de conformité sûreté aéroportuaire",
};

const CONTRACT: Record<string, string> = { "0": "CDD", "1": "CDI", "2": "CTT (intérim)", "3": "CAP" };
const NATURE: Record<string, string> = {
  "01": "CDI de droit privé",
  "02": "CDD de droit privé",
  "03": "Contrat de mission (intérim)",
  "07": "CDI intermittent",
  "08": "CDI intérimaire",
  "09": "CDI de droit public",
  "10": "CDD de droit public",
  "29": "Convention de stage",
  "89": "Volontariat de service civique",
  "90": "Autre nature de contrat",
};

export interface TwoDDocField {
  id: string;
  label: string;
  /** Valeur telle qu'écrite dans le code. */
  raw: string;
  /** Valeur lisible (dates, montants…). */
  value: string;
  truncated: boolean;
}

export interface TwoDDoc {
  version: number;
  authority: string;
  certificate: string;
  issued: string | null;
  signed: string | null;
  docType: string;
  docTypeLabel: string;
  perimeter: string | null;
  country: string | null;
  fields: TwoDDocField[];
  /** Fin du message que l'on ne sait pas découper (identifiant inconnu de nous). */
  undecoded: string | null;
  /** Signature (octets), si présente. */
  signature: Uint8Array | null;
  /** Données couvertes par la signature (en-tête + message). */
  signedData: string;
  /** Données d'annexe : NON signées. */
  annex: TwoDDocField[];
}

/** Jours depuis le 1er janvier 2000 (hexadécimal) → AAAA-MM-JJ ; FFFF → null. */
export function hexDate(h: string): string | null {
  if (!/^[0-9A-F]{4}$/i.test(h) || /^FFFF$/i.test(h)) return null;
  return new Date(Date.UTC(2000, 0, 1) + parseInt(h, 16) * 86_400_000).toISOString().slice(0, 10);
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s: string): Uint8Array | null {
  const clean = s.replace(/=+$/, "");
  if (!/^[A-Z2-7]*$/.test(clean)) return null;
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const c of clean) {
    acc = (acc << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
  }
  return Uint8Array.from(out);
}

function frDate8(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}` : v;
}

/** Une vraie date du calendrier (le jour ou le mois peuvent valoir 00 quand ils sont inconnus). */
function plausible(y: number, m: number, d: number): boolean {
  if (y < 1800 || y > 2200 || m > 12 || d > 31) return false;
  if (m === 0 || d === 0) return true;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** AAAAMMJJ selon la spécification ; certains émetteurs écrivent JJMMAAAA : lu ainsi seulement si c'est la seule date possible. */
function frDateYmd(v: string): string {
  if (!/^\d{8}$/.test(v)) return v;
  const ymd = plausible(+v.slice(0, 4), +v.slice(4, 6), +v.slice(6, 8));
  const dmy = plausible(+v.slice(4, 8), +v.slice(2, 4), +v.slice(0, 2));
  if (ymd) return `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}`;
  if (dmy) return frDate8(v);
  return v;
}

function frDateTime(v: string, seconds: boolean): string {
  const n = seconds ? 14 : 12;
  if (!new RegExp(`^\\d{${n}}$`).test(v)) return v;
  return `${frDate8(v.slice(0, 8))} à ${v.slice(8, 10)} h ${v.slice(10, 12)}${seconds ? ` min ${v.slice(12, 14)} s` : ""}`;
}

function isoToFr(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

function euros(v: string, int: boolean): string {
  const m = /^(-?)(\d+)(?:,(\d{1,2}))?$/.exec(v);
  if (!m) return v;
  const whole = m[2].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${m[1]}${whole}${!int && m[3] !== undefined ? `,${m[3].padEnd(2, "0")}` : ""} €`;
}

function display(id: string, def: FieldDef | undefined, v: string): string {
  if (def?.values) return def.values[v] ?? v;
  const named = special(id, v);
  if (named) return named;
  switch (def?.kind) {
    case "date8":
      return frDate8(v);
    case "dateYmd":
      return frDateYmd(v);
    case "datetime12":
      return frDateTime(v, false);
    case "datetime14":
      return frDateTime(v, true);
    case "hexdate":
      return isoToFr(hexDate(v)) || v;
    case "hexInt":
      return /^[0-9A-F]+$/i.test(v) ? String(parseInt(v, 16)) : v;
    case "co2":
      return /^[0-9A-F]{3}$/i.test(v) ? `${parseInt(v, 16)} g/km` : v;
    case "hexYear": {
      if (!/^[0-9A-F]{3}$/i.test(v)) return v;
      const y = parseInt(v, 16);
      return `${y - 1}-${y}`;
    }
    case "base36":
      return /^[0-9A-Z]$/i.test(v) ? String(parseInt(v, 36)) : v;
    case "hhmm":
      return /^\d{4}$/.test(v) ? `${v.slice(0, 2)} h ${v.slice(2)}` : v;
    case "number":
      return /^\d+$/.test(v) ? String(Number(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : v;
    case "gender":
      return v === "M" ? "masculin" : v === "F" ? "féminin" : v === "X" ? "autre" : v;
    case "airClass": {
      // 1er caractère : version ; 2e : classe (E = électrique, 1 à 6) ; 3e : motif de sur-classement.
      if (!/^[0-9A-Z]{3}$/.test(v)) return v;
      return v[1] === "E" ? "véhicule électrique" : /[1-6]/.test(v[1]) ? `classe ${v[1]}` : v;
    }
    case "period":
      return /^\d{12}$/.test(v) ? `${v.slice(0, 2)}/${v.slice(2, 6)} au ${v.slice(6, 8)}/${v.slice(8)}` : v;
    case "euros":
      return euros(v, false);
    case "eurosInt":
      return euros(v, true);
    case "phone":
      return /^33\d{9}$/.test(v) ? `0${v.slice(2)}`.replace(/(\d{2})(?=\d)/g, "$1 ") : `+${v}`;
    case "contract":
      return CONTRACT[v] ?? v;
    case "nature":
      return NATURE[v] ?? v;
    case "bool":
      return v === "1" ? "oui" : v === "0" ? "non" : v;
    case "uuid":
      return v.replace(/ /g, "-");
    case "url": {
      const b = base32Decode(v);
      try {
        return b ? new TextDecoder("utf-8", { fatal: true }).decode(b) : v;
      } catch {
        return v;
      }
    }
    default:
      return v;
  }
}

/** Découpe une zone de message (ou d'annexe). S'arrête sur un identifiant inconnu. */
export function parseMessage(msg: string): { fields: TwoDDocField[]; undecoded: string | null } {
  const fields: TwoDDocField[] = [];
  let i = 0;
  while (i < msg.length) {
    if (msg[i] === GS) {
      i++;
      continue;
    }
    const id = msg.slice(i, i + 2).toUpperCase();
    const def = FIELDS[id];
    if (id.length < 2 || !def) return { fields, undecoded: msg.slice(i) };
    i += 2;
    let raw: string;
    let truncated = false;
    if (def.min === def.max) {
      raw = msg.slice(i, i + def.max);
      if (raw.length < def.max || /[\x1d\x1e\x1f]/.test(raw)) return { fields, undecoded: msg.slice(i - 2) };
      i += def.max;
    } else {
      let j = i;
      while (j < msg.length && j - i < def.max && msg[j] !== GS && msg[j] !== RS) j++;
      if (def.unterminated && j - i === def.max && msg[j] !== GS && msg[j] !== RS) j = i + def.unterminated;
      raw = msg.slice(i, j);
      if (msg[j] === RS) {
        truncated = true;
        j++;
      } else if (msg[j] === GS) j++;
      i = j;
    }
    fields.push({ id, label: def.label, raw, value: display(id, def, raw), truncated });
  }
  return { fields, undecoded: null };
}

/** Lit un code 2D-Doc (texte rendu par le lecteur de code-barres). null si ce n'en est pas un. */
export function parse2DDoc(input: string): TwoDDoc | null {
  const s = input.replace(/^\][A-Za-z]\d/, ""); // préfixe d'identification de symbologie éventuel
  const m = /^DC(0[1-4])/.exec(s);
  if (!m) return null;
  const version = Number(m[1]);
  const headLen = version <= 2 ? 22 : version === 3 ? 24 : 26;
  const head = s.slice(0, headLen);
  if (head.length < headLen || !/^[A-Z0-9]+$/.test(head)) return null;
  const issuedHex = head.slice(12, 16);
  const signedHex = head.slice(16, 20);
  if (!/^[0-9A-F]{4}$/.test(issuedHex) || !/^[0-9A-F]{4}$/.test(signedHex)) return null;
  const docType = head.slice(20, 22);
  const rest = s.slice(headLen);
  const us = version >= 2 ? rest.indexOf(US) : -1;
  const message = us >= 0 ? rest.slice(0, us) : rest;
  let signature: Uint8Array | null = null;
  let annex: TwoDDocField[] = [];
  if (us >= 0) {
    const after = rest.slice(us + 1);
    const gs = after.indexOf(GS);
    signature = base32Decode(gs >= 0 ? after.slice(0, gs) : after);
    if (gs >= 0) annex = parseMessage(after.slice(gs + 1)).fields;
  }
  const { fields, undecoded } = parseMessage(message);
  return {
    version,
    authority: head.slice(4, 8),
    certificate: head.slice(8, 12),
    issued: hexDate(issuedHex),
    signed: hexDate(signedHex),
    docType,
    docTypeLabel: DOC_TYPES_2D[docType] ?? `Type ${docType}`,
    perimeter: version >= 3 ? head.slice(22, 24) : null,
    country: version >= 4 ? head.slice(24, 26) : null,
    fields,
    undecoded,
    signature,
    signedData: head + message,
    annex,
  };
}

/** Date JJMMAAAA (jour et mois connus) → AAAA-MM-JJ, ou null si elle n'existe pas. */
function isoFromDate8(v: string): string | null {
  if (!/^\d{8}$/.test(v)) return null;
  const d = +v.slice(0, 2);
  const m = +v.slice(2, 4);
  const y = +v.slice(4, 8);
  if (d === 0 || m === 0 || !plausible(y, m, d)) return null;
  return `${v.slice(4, 8)}-${v.slice(2, 4)}-${v.slice(0, 2)}`;
}

/** Champs qui disent jusqu'à quand le papier est valable, du plus précis au plus général. */
const EXPIRY_FIELDS: [string, (raw: string) => string | null][] = [
  ["6O", isoFromDate8], // fin de validité d'un titre
  ["HO", isoFromDate8], // date d'expiration (carte européenne d'arme à feu)
  ["AI", isoFromDate8], // date d'expiration initiale (cartes professionnelles)
  ["08", hexDate], // date d'expiration du document (données complémentaires)
];

/**
 * Ce que le code apporte à la fiche du papier : son type et sa date de fin de validité.
 * Jamais un nom ni un numéro personnel : ils restent dans l'écran du code, protégé des captures.
 */
export function codeFacts(code: TwoDDoc): { expiry: string | null; facts: { label: string; valeur: string }[] } {
  let expiry: string | null = null;
  for (const [id, toIso] of EXPIRY_FIELDS) {
    const f = code.fields.find((x) => x.id === id);
    const iso = f ? toIso(f.raw) : null;
    if (iso) {
      expiry = iso;
      break;
    }
  }
  const facts = [{ label: "Code 2D-Doc", valeur: code.docTypeLabel }];
  if (expiry) facts.push({ label: "Fin de validité (code 2D-Doc)", valeur: isoToFr(expiry) });
  return { expiry, facts };
}

/** Données qui doivent se retrouver écrites sur le papier. */
const CHECKED = new Set([
  "10", "12", "13", "14", "16", "17", "18", "1D", "22", "24", "25", "29", "2B", "2C",
  "30", "31", "40", "41", "44", "46", "47", "48", "49", "4N", "4P", "50", "58", "5C", "5M",
  // identité, santé, véhicule, diplôme, permis, asile
  "61", "62", "63", "66", "69", "6G", "6Q", "72", "75", "80", "82", "85", "86",
  "A1", "A4", "AC", "B1", "B2", "B7", "BC", "C1", "C6", "G2", "L0", "L2", "I1", "I6",
]);

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export interface CrossCheck {
  checked: number;
  found: TwoDDocField[];
  missing: TwoDDocField[];
}

/** Ce que dit le code et que l'on ne retrouve pas sur le papier lu (signe possible de papier modifié). */
export function crossCheck(doc: TwoDDoc, paperText: string): CrossCheck {
  const text = fold(paperText);
  const words = new Set(text.split(/[^A-Z0-9]+/).filter(Boolean));
  const digits = text.replace(/[^0-9]/g, "");
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const found: TwoDDocField[] = [];
  const missing: TwoDDocField[] = [];
  for (const f of doc.fields) {
    if (!CHECKED.has(f.id) || !f.raw.trim() || f.truncated) continue;
    const v = fold(f.raw);
    let ok: boolean;
    if (/^-?[\d\s,.]+$/.test(v)) ok = digits.includes(v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""));
    else if (/^[A-Z0-9]{8,}$/.test(v)) ok = compact.includes(v);
    else ok = v.split(/[^A-Z0-9]+/).filter((w) => w.length >= 2).every((w) => words.has(w));
    (ok ? found : missing).push(f);
  }
  return { checked: found.length + missing.length, found, missing };
}
