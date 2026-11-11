// Config Metro. Aperçu web : expo-sqlite charge un fichier .wasm dans le navigateur.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

// Dossiers natifs générés (android/, ios/) : Gradle y écrit des milliers de fichiers pendant une compilation et
// Metro, qui les surveillait, se figeait (serveur muet). Ils ne contiennent aucun JavaScript de l’app.
const path = require("path");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nativeDirs = new RegExp(`^${escapeRegExp(__dirname)}[\\\\/](?:android|ios)[\\\\/].*`);
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), nativeDirs];

// tslib (dépendance de pdf-lib) : sur le web, Metro prend son entrée « import » (modules/index.js), qui lit
// `tslib.default` et plante (« Cannot destructure property '__extends' »). La version CommonJS marche partout.
const tslibCommonJs = path.join(path.dirname(require.resolve("tslib")), "tslib.js");
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && (moduleName === "tslib" || moduleName === "tslib/modules/index.js")) {
    return { type: "sourceFile", filePath: tslibCommonJs };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// En-têtes pour l'isolation de l'origine (SharedArrayBuffer), demandés par SQLite sur le web.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = config;
