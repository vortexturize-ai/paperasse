// Projet expo.dev facultatif : défini dans .env.local (jamais envoyé sur le dépôt) par EAS_PROJECT_ID.
// Nécessaire pour ouvrir l'app dans Expo Go sur iPhone (le serveur doit être connecté au même compte).
module.exports = ({ config }) =>
  process.env.EAS_PROJECT_ID
    ? { ...config, extra: { ...config.extra, eas: { ...config.extra?.eas, projectId: process.env.EAS_PROJECT_ID } } }
    : config;
