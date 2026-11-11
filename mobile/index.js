// Point d'entrée : l'app (Expo Router), puis le widget Android « Prochaine échéance », qu'Android peut
// redessiner app fermée.
import "expo-router/entry";
import { registerWidget } from "./src/lib/widget";

registerWidget();
