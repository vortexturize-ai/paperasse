// CMake 3.31.6 : le ninja fourni avec 3.22.1 ne gère pas les chemins Windows de plus de 260 caractères.
const { withAppBuildGradle } = require("expo/config-plugins");

const CMAKE_VERSION = "3.31.6";
const MARKER = "// paperasse: modern-cmake";

module.exports = function withModernCmake(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults;
    if (gradle.language !== "groovy") throw new Error("withModernCmake : build.gradle en Groovy attendu.");
    if (gradle.contents.includes(MARKER)) return cfg;
    const anchor = /^android \{\n/m;
    if (!anchor.test(gradle.contents)) throw new Error("withModernCmake : bloc « android { » introuvable.");
    gradle.contents = gradle.contents.replace(
      anchor,
      `android {\n    ${MARKER}\n    externalNativeBuild { cmake { version "${CMAKE_VERSION}" } }\n`,
    );
    return cfg;
  });
};
