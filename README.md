<p align="center">
  <img src="docs/images/hero.png" alt="Paperasse : le coffre-fort de tes papiers, qui les comprend pour toi" width="100%">
</p>

<p align="center">
  <a href="https://ko-fi.com/paperasse"><img src="https://img.shields.io/badge/Soutenir-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white" alt="Soutenir sur Ko-fi"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-AGPL--3.0-1F3C88" alt="Licence AGPL-3.0"></a>
  <img src="https://img.shields.io/badge/Android-en%20d%C3%A9veloppement-4CC764?logo=android&logoColor=white" alt="Android, en développement">
  <img src="https://img.shields.io/badge/Expo%20SDK-58-000020?logo=expo&logoColor=white" alt="Expo SDK 58">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict">
</p>

<p align="center">
  <a href="#comment-ça-marche">Comment ça marche</a> ·
  <a href="#comprendre">Comprendre</a> ·
  <a href="#ranger-toute-une-vie">Ranger</a> ·
  <a href="#protéger">Protéger</a> ·
  <a href="#feuille-de-route">Feuille de route</a> ·
  <a href="#pour-les-développeurs">Développeurs</a> ·
  <a href="#soutenir-le-projet">Soutenir</a>
</p>

---

Une lettre de la CAF, un avis d'impôt, une amende, un contrat de travail : des papiers écrits pour être compris par des spécialistes, avec une date limite cachée au milieu d'un paragraphe.

**Paperasse** les prend en photo, les lit, les range et te les explique en quelques lignes : ce que c'est, ce qu'il faut faire, avant quelle date. Il te prévient à temps, prépare la réponse et garde tout dans un coffre chiffré.

Et tout se passe **sur ton téléphone**. Pas de compte à créer, pas de serveur, pas d'abonnement. Tes papiers ne partent nulle part.

## Comment ça marche

<p align="center">
  <img src="docs/images/fonctionnement.png" alt="Tu ajoutes un papier, il est lu, compris et expliqué, le tout dans le téléphone ; rien n'est envoyé sur Internet" width="100%">
</p>

Le texte est lu sur l'appareil, puis le moteur de Paperasse (écrit pour ça, en TypeScript, sans service extérieur) reconnaît le type de papier, l'organisme, les dates, les montants et les références. Il ne devine pas : chaque date limite affichée vient avec **la phrase exacte du papier** qui la justifie.

### Exemple : un courrier de la CAF

| Sur le papier | Ce que Paperasse en fait |
|---|---|
| « Merci de nous les envoyer dans un délai de 15 jours à compter de la date de ce courrier » (daté du 3 novembre) | **Date limite : 18 novembre**, phrase citée, rappels avant l'échéance |
| Une demande de justificatif noyée dans le texte | « Prépare le document demandé », puis les étapes dans l'ordre |
| N° allocataire, adresse | Rangés dans les infos utiles, **masqués** quand tu partages le texte |
| Un courrier d'organisme | Dossier *Courriers*, « à garder jusqu'au 3 nov. 2031 » (avec la raison) |
| Rien à répondre ? Si : envoyer la pièce | Un courrier « Envoi du justificatif demandé » prêt à compléter |

## Comprendre

<p align="center">
  <img src="docs/images/comprendre.png" alt="Écrans : l'essentiel d'un papier, l'explication détaillée, le courrier de réponse" width="100%">
</p>

- **L'essentiel en trois lignes** : ce que c'est, quoi faire, avant quand. Un mode *facile à lire* l'affiche en gros, et un bouton le **lit à voix haute**.
- **Explication en 4 langues** : français, anglais, espagnol et arabe, pour comprendre un papier français même si ce n'est pas ta langue.
- **Les mots difficiles** expliqués sur place (allocataire, recours gracieux, trop-perçu…).
- **Courriers de réponse** prêts à envoyer : demander un délai de paiement, contester, demander des explications, envoyer un justificatif, résilier un contrat ou une assurance, recours gracieux, réclamer une somme ou un dépôt de garantie.
- **Code 2D-Doc** des papiers officiels lu et comparé au texte du papier, d'après la spécification de l'ANTS.
- **Vérification de la fiche de paie** : taux horaire comparé au SMIC en vigueur à la date de la paie, calcul brut − cotisations = net vérifié.

## Ranger toute une vie

<p align="center">
  <img src="docs/images/ranger.png" alt="Écrans : accueil, dossiers, calendrier, moments de vie" width="100%">
</p>

- **Ajouter en un geste** : photo, PDF (même scanné), plusieurs fichiers, archive ZIP, ou *Partager vers Paperasse* depuis Mail, WhatsApp ou Fichiers.
- **Scanner malin** : photo floue, trop sombre ou avec un reflet signalée avant d'enregistrer, feuille recadrée.
- **Rangé et renommé tout seul** dans 12 dossiers (Travail, Logement, Santé, Impôts, Identité, Banque…).
- **Calendrier administratif** : les dates trouvées dans tes papiers et les grandes échéances de l'année (déclaration de revenus, actualisation France Travail…).
- **Moments de vie** : déménagement, perte d'emploi, nouveau travail, naissance, mariage ou Pacs, retraite, décès d'un proche. Les démarches dans l'ordre, avec les papiers que tu as déjà.
- **Dossiers prêts** (location, prêt, titre de séjour, embauche) : ce qui est prêt, ce qui manque, ce qu'**on n'a pas le droit de te demander**, puis un seul PDF avec un **filigrane** sur chaque page (« Uniquement pour la location d'un logement — Agence Martin — 10/11/2026 »).
- **Argent à récupérer**, durées de conservation (« tu peux jeter »), recherche dans tous tes papiers.
- **Famille et aidants** : un profil par proche (« Maman », un enfant…) pour gérer aussi leurs papiers.

## Protéger

<p align="center">
  <img src="docs/images/proteger.png" alt="Écrans : réglages de sécurité, détecteur d'arnaques, droits du locataire" width="100%">
</p>

| Protection | Ce que ça fait |
|---|---|
| **Coffre chiffré** | La base des papiers est chiffrée (SQLCipher, AES-256). La clé reste dans la puce de sécurité du téléphone. |
| **Code secret** | Demandé à l'ouverture et après une minute sans utiliser l'app. Attente croissante après plusieurs erreurs. |
| **Code panique** | Un second code qui ouvre un coffre vide, d'apparence normale. Les vrais papiers restent chiffrés et cachés. |
| **Captures d'écran** | Toujours bloquées sur les pièces sensibles (identité, banque, santé), et partout si tu le choisis. |
| **Sauvegarde** | Un seul fichier chiffré de bout en bout, à ranger où tu veux. Sans ta clé de secours, personne ne peut l'ouvrir. |
| **Kit d'urgence** | Une sauvegarde et une fiche à confier à un proche, au cas où. |
| **Anti-arnaque** | Faux SMS ANTAI, Ameli, CPF, colis, banque : les liens et les tournures typiques sont repérés. Une arnaque probable n'est jamais classée « à payer ». |
| **Bouclier vie privée** | Le texte d'un papier peut être partagé avec les numéros personnels masqués (IBAN, sécurité sociale, numéro fiscal…). |

Ce qui n'est **pas encore** chiffré : les images des pages, rangées dans l'espace privé de l'app (le chiffrement est sur la feuille de route).

## Fiabilité

L'analyse est testée sur un banc d'essai qui grandit à chaque bug trouvé :

- **136 papiers fictifs annotés** (CAF, impôts, amendes, fiches de paie, contrats, pièces d'identité, factures…) et plus de 1 000 variantes générées ;
- des **pièges relevés sur de vrais papiers**, puis réécrits avec des données inventées : date d'une loi prise pour la date du courrier, délai d'une clause pris pour une date limite, adresse officielle mal lue sur un scan prise pour une arnaque… Aucun vrai papier n'est gardé ;
- des **photos mal lues simulées** (lettres et chiffres confondus, accents perdus, lignes coupées ou mélangées, parasites) ;
- des milliers de textes aléatoires pour vérifier que rien ne plante ni ne ralentit ;
- un **lot écrit à l'aveugle**, après réglage : 91,7 % des champs justes du premier coup ;
- les **exemples officiels de l'ANTS** pour le 2D-Doc, à l'octet près.

Paperasse peut se tromper : vérifie toujours les dates et les montants sur le papier. Il ne remplace pas un conseiller.

## Feuille de route

- [x] Lecture des photos et des PDF, explication en 4 langues, rappels
- [x] Coffre chiffré, code secret, code panique, sauvegarde chiffrée, kit d'urgence
- [x] Scanner, 2D-Doc, dossiers prêts filigranés, moments de vie, profils famille
- [ ] Publication sur le Play Store
- [ ] Version iPhone
- [ ] Chiffrement des images des pages
- [ ] PDF protégé par mot de passe, export pour un travailleur social
- [ ] Essais sur 100 vrais courriers anonymisés
- [ ] Plus de langues (portugais, turc, roumain, ukrainien…) et d'autres pays (Belgique, Suisse, Québec, Maghreb…)

## Questions

<details>
<summary><b>C'est vraiment gratuit ?</b></summary>
<br>
Oui, sans publicité et sans abonnement. Le code est libre (AGPL-3.0). Le projet vit des dons sur <a href="https://ko-fi.com/paperasse">Ko-fi</a>.
</details>

<details>
<summary><b>Mes papiers partent-ils sur un serveur ?</b></summary>
<br>
Non. Il n'y a pas de serveur Paperasse. La lecture, l'analyse, les rappels et les sauvegardes se font sur le téléphone. Une sauvegarde ne quitte l'appareil que si tu choisis toi-même où l'envoyer, et elle est chiffrée avant.
</details>

<details>
<summary><b>Et si je perds mon téléphone ?</b></summary>
<br>
Fais une sauvegarde chiffrée de temps en temps et garde ta clé de secours sur papier. Sur un nouveau téléphone, <i>Restaurer une sauvegarde</i> remet tout en place.
</details>

<details>
<summary><b>Et si j'oublie mon code ?</b></summary>
<br>
Après quelques essais, Paperasse propose de déverrouiller avec l'empreinte ou le visage enregistrés sur le téléphone. Sinon, la sauvegarde chiffrée reste la solution.
</details>

<details>
<summary><b>Quand sur iPhone ?</b></summary>
<br>
L'app est écrite avec Expo et React Native, donc prévue pour iPhone, mais elle n'y a pas encore été essayée. C'est l'un des premiers usages des dons.
</details>

## Pour les développeurs

**Pile** : Expo SDK 58, React Native 0.88, React 19, TypeScript strict, Expo Router, expo-sqlite avec SQLCipher, expo-secure-store, ML Kit (lecture du texte, modèle intégré à l'app), pdf-lib, fflate, @noble/hashes.

### Démarrer

Prérequis : Node.js 20+, Java 17, SDK Android (plateforme 37, NDK 27.1, CMake 3.31.6), un émulateur ou un téléphone Android.

```bash
cd mobile
npm ci --legacy-peer-deps
npx expo run:android
```

Ensuite, tant qu'aucun module natif ne change : `npx expo start --dev-client`.

`mobile/android/` est généré par `npx expo prebuild` : les réglages natifs passent par `mobile/app.json` et `mobile/plugins/`.

### Vérifier

```bash
cd mobile
npm test                  # moteur, formats et sécurité
npx tsc --noEmit          # types de l'app
npm run typecheck:tests   # types des tests
npx expo lint             # lint
npm run fiabilite         # rapport de fiabilité de l'analyse
```

### Organisation

| Dossier | Contenu |
|---|---|
| `mobile/src/engine/` | Moteur d'analyse et formats (PDF, sauvegarde, 2D-Doc, scanner…), en TypeScript pur, testé sous Node |
| `mobile/src/lib/` | Base de données, fichiers, coffre chiffré, sauvegarde, rappels |
| `mobile/src/app/` | Écrans (Expo Router) |
| `mobile/src/components/` | Interface (thème, boutons, mascotte, icônes) |
| `mobile/plugins/` | Plugins de configuration Expo (modèle de lecture intégré, CMake) |
| `mobile/test/` | Tests et corpus de papiers fictifs annotés |

<details>
<summary><b>Détails de sécurité</b></summary>
<br>

- **Base** : SQLCipher (AES-256). Clé aléatoire de 256 bits gardée par expo-secure-store (Android Keystore), accessible seulement téléphone déverrouillé et jamais exportée. Sauvegarde automatique Android désactivée (`allowBackup: false`).
- **Codes** : PBKDF2-SHA256 avec sel aléatoire ; le code secret et le code panique sont vérifiés par une seule dérivation, pour qu'ils prennent le même temps. Attente de 30 s à 1 h après 5 erreurs.
- **Code panique** : ouvre une seconde base chiffrée distincte, avec sa propre clé.
- **Sauvegarde `.paperasse`** : en-tête JSON puis blocs de 1 Mo scellés en AES-256-GCM. Nonce = préfixe aléatoire + compteur, données associées = en-tête + compteur + indicateur de dernier bloc (ni réordonnancement, ni troncature possible). Clé de secours de 140 bits (base32 de Crockford, 2 caractères de contrôle).
- **Réseau** : l'app n'appelle aucun service. Pas de télémétrie, pas de suivi des plantages.

Une faille ? Merci de ne pas ouvrir de ticket public : voir [SECURITY.md](SECURITY.md).
</details>

## Contribuer

Toutes les aides comptent : signaler un bug, un papier mal compris (anonymisé), une règle à ajouter, une traduction, du code. Tout est expliqué dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Soutenir le projet

Paperasse est gratuit, sans publicité, et le restera. Si l'app t'aide, tu peux soutenir son développement sur **[Ko-fi](https://ko-fi.com/paperasse)**, par un don ponctuel ou mensuel. Les dons servent à la version iPhone, à la publication sur les stores et à de nouvelles langues.

<p align="center">
  <a href="https://ko-fi.com/paperasse"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Soutenir Paperasse sur Ko-fi"></a>
</p>

Sans dépenser un centime :

- mets une étoile au dépôt et parle de Paperasse autour de toi ;
- signale ce qui ne marche pas ;
- aide à traduire les explications dans d'autres langues.

## Licence

[GNU AGPL v3.0](LICENSE) © 2026 vortexturize-ai. Tu peux utiliser, étudier, modifier et redistribuer Paperasse ; toute version modifiée distribuée ou proposée en ligne doit rester libre, sous la même licence.
