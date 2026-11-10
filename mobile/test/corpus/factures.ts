import type { Papier } from "../outils/fiche.ts";

export const FACTURES: Papier[] = [
  {
    id: "edf-facture-a-payer",
    texte: `EDF
Électricité de France
Facture du 30/10/2026
N° de facture : 10 2345 6789
Référence client : 6 012 345 678
Période de consommation : du 28/08/2026 au 27/10/2026
Consommation : 612 kWh
Montant HT : 130,27 €
TVA : 26,05 €
Montant TTC : 156,32 €
Montant à payer : 156,32 € avant le 20/11/2026
Vous pouvez payer par carte bancaire sur edf.fr.`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "EDF", organisme: "edf", date_document: "2026-10-30",
      date_limite: "2026-11-20", montant: 156.32, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° de facture": "10 2345 6789", "N° client": "6 012 345 678" },
    },
  },
  {
    id: "edf-facture-prelevee",
    texte: `EDF
Facture du 02/11/2026
Montant TTC : 84,60 €
Ce montant sera prélevé le 20/11/2026 sur votre compte.`,
    attendu: { type: "facture", dossier: "factures", organisme: "edf", montant: 84.6, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "engie-echeancier",
    texte: `ENGIE
Votre échéancier de paiement 2026-2027
Date : 15/10/2026
Contrat gaz naturel n° 4400123456
Vous avez choisi la mensualisation. Voici le montant de vos prochains prélèvements :
15/11/2026 : 72,00 €
15/12/2026 : 72,00 €
15/01/2027 : 72,00 €
Ces montants seront prélevés automatiquement sur votre compte.`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "Engie", organisme: "engie", date_document: "2026-10-15",
      a_traiter: false, urgence: "aucune", infos: { "N° de contrat": "4400123456" },
    },
  },
  {
    id: "totalenergies-regularisation-en-votre-faveur",
    texte: `TotalEnergies
Facture de régularisation
Date de facture : 04/11/2026
Période : du 01/11/2025 au 31/10/2026
Consommation réelle : 2 840 kWh
Total de vos mensualités : 612,00 €
Coût réel de votre consommation : 563,80 €
Solde en votre faveur : 48,20 €
Ce montant vous sera remboursé par virement sous 15 jours.`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "TotalEnergies", organisme: "totalenergies", date_document: "2026-11-04",
      montant: 48.2, sens: "a_recevoir", a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "orange-facture-prelevee",
    texte: `Orange
Facture n° 1A2B3C4D5E du 05/11/2026
Numéro client : 1234 5678 90
Offre Livebox Fibre
Abonnement du 05/11/2026 au 04/12/2026 : 42,99 €
Total TTC : 42,99 €
Cette somme sera prélevée sur votre compte le 20/11/2026.
orange.fr`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "Orange", organisme: "orange", date_document: "2026-11-05",
      montant: 42.99, a_traiter: false, urgence: "aucune",
      infos: { "N° de facture": "1A2B3C4D5E", "N° client": "1234 5678 90" },
    },
  },
  {
    id: "sfr-prelevement-le",
    texte: `SFR
Votre facture mobile
Date de facture : 03/11/2026
Montant total TTC : 19,99 €
Prélèvement le 18/11/2026`,
    attendu: { type: "facture", dossier: "factures", emetteur: "SFR", organisme: "sfr", montant: 19.99, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "bouygues-dernier-rappel-suspension",
    texte: `Bouygues Telecom
Service recouvrement
Le 04/11/2026
Objet : facture impayée - dernier rappel avant suspension
Madame, Monsieur,
Malgré nos précédents rappels, votre facture du 05/10/2026 d'un montant de 34,99 € reste impayée.
Sans règlement de votre part avant le 12/11/2026, votre ligne sera suspendue, puis votre contrat résilié.
Vous pouvez régler par carte bancaire dans votre Espace client.`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "Bouygues Telecom", organisme: "bouygues", date_document: "2026-11-04",
      date_limite: "2026-11-12", montant: 34.99, sens: "a_payer", intention: "relance", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "free-freebox-prelevement-automatique",
    texte: `Free
Facture Freebox
Facture du 01/11/2026
Identifiant : 123456789
Forfait Freebox Pop : 39,99 €
Total à payer : 39,99 €
Prélèvement automatique le 06/11/2026.
free.fr`,
    attendu: { type: "facture", dossier: "factures", emetteur: "Free", organisme: "free", montant: 39.99, a_traiter: false, urgence: "aucune" },
  },
  {
    id: "veolia-eau",
    texte: `Veolia Eau
Facture d'eau
Date de facture : 02/11/2026
Référence client : 12-3456789
Consommation relevée : 48 m³ du 01/05/2026 au 31/10/2026
Abonnement : 32,40 €
Consommation : 168,96 €
Redevances et taxes : 54,12 €
Total TTC : 255,48 €
Montant à payer avant le 02/12/2026 : 255,48 €`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "Veolia", organisme: "veolia", date_document: "2026-11-02",
      date_limite: "2026-12-02", montant: 255.48, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° client": "12-3456789" },
    },
  },
  {
    id: "edf-relance-reduction-puissance",
    texte: `EDF
Service clients
Le 06/11/2026
LETTRE DE RELANCE
Madame, Monsieur,
Votre facture du 01/10/2026 d'un montant de 212,30 € n'a pas été réglée.
Sans paiement de votre part sous 8 jours, la fourniture d'électricité de votre logement pourra être réduite puis suspendue, conformément à la réglementation.
Si vous rencontrez des difficultés, contactez-nous : des solutions existent (échéancier, chèque énergie, Fonds de solidarité logement).`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "EDF", organisme: "edf", date_document: "2026-11-06",
      date_limite: "2026-11-14", montant: 212.3, sens: "a_payer", intention: "relance", a_traiter: true, urgence: "haute",
    },
  },
  {
    id: "hopital-avis-sommes-a-payer",
    texte: `CENTRE HOSPITALIER EXEMPLE
Avis des sommes à payer
Date d'émission : 29/10/2026
Séjour du 12/10/2026 au 14/10/2026 - Service de chirurgie
Forfait journalier hospitalier : 40,00 €
Part non prise en charge par l'assurance maladie : 22,00 €
Montant à payer : 62,00 €
À régler dans un délai de 30 jours au Trésor public.`,
    attendu: {
      type: "facture", dossier: "sante", emetteur: "Centre Hospitalier Exemple", organisme: null, date_document: "2026-10-29",
      date_limite: "2026-11-28", montant: 62, sens: "a_payer", a_traiter: true, urgence: "faible",
    },
  },
  {
    id: "mairie-cantine",
    texte: `Ville de Rennes
Facture de restauration scolaire
Facture n° 2026-10-48213
Date de facture : 31/10/2026
Enfant : Léa EXEMPLE
Repas d'octobre 2026 : 16 x 3,05 € = 48,80 €
Montant à payer : 48,80 €
À régler avant le 30/11/2026 en ligne sur l'Espace citoyens ou au guichet.`,
    attendu: {
      type: "facture", dossier: "factures", emetteur: "Mairie", organisme: "mairie", date_document: "2026-10-31",
      date_limite: "2026-11-30", montant: 48.8, sens: "a_payer", a_traiter: true, urgence: "faible",
      infos: { "N° de facture": "2026-10-48213" },
    },
  },
  {
    id: "facture-en-ligne-deja-payee",
    texte: `EXEMPLE SHOP
Facture n° FR-2026-0098765
Date de facture : 21/10/2026
Commande n° 405-1234567-8901234
Casque audio sans fil : 59,99 €
Livraison : 0,00 €
Total TTC : 59,99 €
Payé le 21/10/2026 par carte bancaire.
Garantie légale de conformité de 2 ans.`,
    attendu: {
      type: "facture", dossier: "factures", date_document: "2026-10-21", montant: 59.99, a_traiter: false, urgence: "aucune",
      infos: { "N° de facture": "FR-2026-0098765" },
    },
  },
  {
    id: "ticket-de-caisse-garantie",
    texte: `ÉLECTRO EXEMPLE
Centre commercial Exemple - 69100 Villeurbanne
Ticket de caisse n° 0042-118734
Le 14/10/2026 à 16:42
Lave-linge EXEMPLE 8 kg 449,00 €
Extension de garantie 2 ans 59,00 €
TOTAL TTC 508,00 €
Payé par carte bancaire 508,00 €
Garantie légale de conformité : 2 ans à compter de la livraison.
Merci de votre visite !`,
    attendu: {
      type: "ticket_garantie", dossier: "factures", emetteur: "Électro Exemple", date_document: "2026-10-14",
      montant: 508, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "ticket-boulangerie-croustillant",
    texte: `BOULANGERIE DU CROUSTILLANT
Le 07/11/2026 08:12
1 baguette tradition 1,30 €
2 croissants 2,60 €
TOTAL 3,90 €
CB SANS CONTACT 3,90 €
Merci de votre visite`,
    attendu: {
      type: "ticket_garantie", dossier: "factures", organisme: null, emetteur: "Boulangerie du Croustillant",
      montant: 3.9, a_traiter: false, urgence: "aucune",
    },
  },
  {
    id: "devis-plombier",
    texte: `EXEMPLE PLOMBERIE SARL
DEVIS N° D-2026-118
Date : 03/11/2026
Client : Camille EXEMPLE
Remplacement d'un chauffe-eau électrique 200 L : 890,00 € HT
Main-d'œuvre : 240,00 € HT
Total HT : 1 130,00 €
TVA 10 % : 113,00 €
Total TTC : 1 243,00 €
Devis valable 30 jours. Bon pour accord, date et signature :`,
    attendu: {
      type: "devis", dossier: "factures", emetteur: "Exemple Plomberie SARL", date_document: "2026-11-03",
      montant: 1243, a_traiter: false, urgence: "aucune",
    },
  },
];
