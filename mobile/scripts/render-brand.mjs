import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mobile = process.argv[2] ?? process.cwd();
const brand = join(mobile, "assets", "brand");
const fonts = [
  join(mobile, "node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf"),
  join(mobile, "node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf"),
];
const jobs = [
  ["icon.svg", "icon.png", 1024],
  ["icon-foreground.svg", "android-icon-foreground.png", 1024],
  ["icon-background.svg", "android-icon-background.png", 1024],
  ["icon-monochrome.svg", "android-icon-monochrome.png", 1024],
  ["mascot.svg", "splash-icon.png", 600],
  ["icon.svg", "favicon.png", 48],
  ["logo.svg", "brand/logo.png", 1200],
];
for (const [src, out, width] of jobs) {
  const svg = readFileSync(join(brand, src), "utf8");
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Fredoka" },
  }).render().asPng();
  writeFileSync(join(mobile, "assets", out), png);
  console.log(out, png.length, "octets");
}
