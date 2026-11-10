// Config Metro : seulement pour l'aperçu web (expo-sqlite charge un fichier .wasm dans le navigateur).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

// En-têtes pour l'isolation de l'origine (SharedArrayBuffer), demandés par SQLite sur le web.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = config;
