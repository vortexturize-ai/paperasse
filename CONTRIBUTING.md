# Contribuer à Paperasse

Merci de vouloir aider.

## Signaler un problème

Ouvre un ticket avec :
- ce que tu as fait, ce que tu attendais, ce qui s'est passé ;
- le modèle de téléphone et la version d'Android ou d'iOS.

**Jamais de vraies données personnelles** dans un ticket : masque les noms, adresses, numéros (sécurité sociale, fiscal, IBAN, allocataire).

## Un papier mal compris

1. Recopie son texte en remplaçant toutes les informations personnelles par des données fictives.
2. Ajoute-le au corpus `mobile/test/corpus/` avec ce qu'un lecteur attentif devrait en tirer (type, organisme, date limite, montant…).
3. Lance `npm test` : le test doit échouer.
4. Corrige par une règle générale dans `mobile/src/engine/`, jamais par un cas particulier.

## Proposer du code

- Une modification par demande de fusion, avec ses tests.
- Avant d'envoyer, dans `mobile/` : `npm test`, `npx tsc --noEmit`, `npm run typecheck:tests`, `npx expo lint`.
- Ajouter un paquet : `npx expo install <paquet>` (versions compatibles avec le SDK Expo du projet).
- Ne pas modifier `mobile/android/` : il est généré par `npx expo prebuild`.
- Aucune donnée ne doit quitter le téléphone : pas de service en ligne, pas de télémétrie.

En contribuant, tu acceptes que ta contribution soit publiée sous la licence du projet (GNU AGPL v3.0).
