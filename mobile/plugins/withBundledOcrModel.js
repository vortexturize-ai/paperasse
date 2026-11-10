// Intègre le modèle ML Kit (alphabet latin) à l'APK : lecture hors connexion, sans téléchargement par Play Services.
// https://developers.google.com/ml-kit/vision/text-recognition/v2/android
const { withAppBuildGradle } = require("expo/config-plugins");

const DEPENDENCY = "com.google.mlkit:text-recognition:16.0.1";
const MARKER = "// paperasse: bundled-ocr";

module.exports = function withBundledOcrModel(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults;
    if (gradle.language !== "groovy") throw new Error("withBundledOcrModel : build.gradle en Groovy attendu.");
    if (gradle.contents.includes(MARKER)) return cfg;
    const anchor = /^dependencies \{\n/m;
    if (!anchor.test(gradle.contents)) throw new Error("withBundledOcrModel : bloc « dependencies { » introuvable.");
    gradle.contents = gradle.contents.replace(
      anchor,
      `dependencies {\n    ${MARKER}\n    implementation("${DEPENDENCY}")\n`,
    );
    return cfg;
  });
};
