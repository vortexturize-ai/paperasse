import type { ScamLevel } from "../../src/engine/scam.ts";

export interface Message {
  id: string;
  texte: string;
  attendu: ScamLevel;
}

export const ARNAQUES: Message[] = [
  { id: "faux-antai", attendu: "arnaque_probable", texte: "ANTAI : Avis de contravention en attente. Montant : 35 €. Réglez avant le 12/11 pour éviter une majoration : https://antai-reglement-amende.com/pay" },
  { id: "faux-ameli-carte-vitale", attendu: "arnaque_probable", texte: "Assurance Maladie : votre nouvelle carte Vitale est disponible. Pour la recevoir, confirmez vos informations sur ameli-renouvellement.fr sous 48h." },
  { id: "faux-cpf-lien-court", attendu: "arnaque_probable", texte: "Vos droits CPF (1 850 €) expirent le 15/11. Utilisez-les dès maintenant : http://bit.ly/3xYzCPF" },
  { id: "faux-colis-frais", attendu: "arnaque_probable", texte: "Colissimo : votre colis est bloqué. Des frais de réexpédition de 1,99 € sont à régler : colis-suivi-24.xyz" },
  { id: "fausse-banque-connexion", attendu: "arnaque_probable", texte: "Crédit Agricole : connexion inhabituelle détectée. Validez votre identité ici : https://ca-securite-client.com" },
  { id: "faux-remboursement-impots", attendu: "arnaque_probable", texte: "impots.gouv : vous avez droit à un remboursement de 287,30 €. Remplissez le formulaire : https://impots-gouv-remboursement.com" },
  { id: "coupon-pcs", attendu: "arnaque_probable", texte: "Pour régler votre amende, achetez un coupon PCS de 150 € et envoyez-nous le code par SMS au 06 12 34 56 78." },
  { id: "fausse-vignette-critair", attendu: "arnaque_probable", texte: "Votre vignette Crit'Air est obligatoire. Commandez-la avant le 30/11 sur critair-officiel.com sous peine d'amende de 135 €." },
  { id: "fausse-caf-coordonnees", attendu: "arnaque_probable", texte: "CAF : votre dossier est suspendu. Mettez à jour vos coordonnées bancaires sous 24h sur caf-allocataire.fr" },
  { id: "faux-france-travail", attendu: "arnaque_probable", texte: "France Travail : votre inscription sera supprimée. Connectez-vous : francetravail-espace.com" },
  { id: "faux-cheque-energie", attendu: "arnaque_probable", texte: "EDF : votre chèque énergie de 150 € est disponible, cliquez ici : https://cheque-energie-edf.online" },
  { id: "faux-site-gouv", attendu: "arnaque_probable", texte: "Service public : votre dossier d'aide de 450 € est validé. Confirmez vos informations sur gouv-aides-france.com" },
  { id: "numero-surtaxe-colis", attendu: "suspect", texte: "Vous avez un colis en attente. Appelez le 08 99 12 34 56 pour fixer la livraison." },
];

export const HONNETES: Message[] = [
  { id: "code-2fa", attendu: "aucun", texte: "Votre code de vérification Ameli est 482913. Ne le communiquez à personne." },
  { id: "suivi-colissimo", attendu: "aucun", texte: "Colissimo : votre colis 6A12345678901 sera livré demain entre 9 h et 13 h. Suivi : https://www.laposte.fr/outils/suivre-vos-envois" },
  { id: "attestation-ameli", attendu: "aucun", texte: "Assurance Maladie : votre attestation de droits est disponible dans votre compte ameli.fr." },
  { id: "avis-impot-disponible", attendu: "aucun", texte: "impots.gouv.fr : votre avis d'impôt 2026 est disponible dans votre espace particulier." },
  { id: "virement-recu", attendu: "aucun", texte: "Votre banque : virement de 1 642,18 € reçu sur votre compte." },
  { id: "paiement-caf", attendu: "aucun", texte: "CAF : votre paiement de 245,32 € a été effectué. Détails sur caf.fr ou sur mon-enfant.fr." },
  { id: "actualisation-ft", attendu: "aucun", texte: "France Travail : pensez à vous actualiser avant le 15/11 sur francetravail.fr." },
  { id: "cafe-de-la-place", attendu: "aucun", texte: "Rendez-vous au Café de la Place samedi, réservation sur cafedelaplace.fr" },
  { id: "boutique-amelie", attendu: "aucun", texte: "Amélie Exemple vous invite à sa vente privée : amelie-boutique.fr" },
  { id: "banque-en-ligne", attendu: "aucun", texte: "Boursorama Banque : votre relevé de compte d'octobre est disponible sur boursorama-banque.com" },
  { id: "antai-officiel", attendu: "aucun", texte: "Avis de contravention. Payez en ligne sur www.antai.gouv.fr avec le numéro de télépaiement." },
  { id: "rappel-dentiste", attendu: "aucun", texte: "Rappel : rendez-vous chez le Dr Exemple demain à 10 h. Pour annuler, répondez STOP." },
];
