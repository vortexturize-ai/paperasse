# Sécurité

Paperasse garde des papiers très personnels. Une faille compte plus que tout autre bug.

## Signaler une faille

Ne pas ouvrir de ticket public. Utilise le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**.

Indique la version, les étapes pour reproduire et l'impact. Tu recevras une réponse dès que possible ; la correction sera publiée avant toute annonce.

## Ce qui est protégé

- Base de données chiffrée (SQLCipher, AES-256), clé dans le Keystore Android ou le Trousseau iOS.
- Codes secrets : empreinte PBKDF2-SHA256 seulement, attente croissante après des erreurs.
- Sauvegardes : AES-256-GCM par morceaux authentifiés, clé de secours aléatoire.
- Aucune donnée envoyée sur Internet.
