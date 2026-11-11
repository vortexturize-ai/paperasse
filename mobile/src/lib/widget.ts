import { File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { listAll } from "./db";
import { reminderMode } from "./notifications";
import { EMPTY_SNAPSHOT, parseSnapshot, widgetSnapshot, widgetView, type WidgetSnapshot } from "./widgetData";

/**
 * Widget Android « Prochaine échéance ». L'app écrit les prochaines dates dans un petit fichier privé
 * (`widget.json`, sans nom de papier si le code secret est en place) puis redessine le widget ; Android le
 * redessine aussi toutes les 3 heures, app fermée, pour que « Dans 3 jours » reste juste.
 * Sans le module natif (Expo Go, ancienne app installée, iPhone, web), tout ceci ne fait rien.
 */
export const WIDGET_NAME = "Echeance";

export const widgetSupported =
  Platform.OS === "android" && (TurboModuleRegistry.get("AndroidWidget") != null || NativeModules.AndroidWidget != null);

type WidgetLib = typeof import("react-native-android-widget");
type WidgetDrawing = typeof import("../widget/EcheanceWidget");

// Chargés seulement si le module natif est là : sinon la bibliothèque plante dès l'import.
function lib(): WidgetLib {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement à la demande, voir ci-dessus
  return require("react-native-android-widget") as WidgetLib;
}
function drawing(): WidgetDrawing {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- même raison
  return require("../widget/EcheanceWidget") as WidgetDrawing;
}

function snapshotFile(): File {
  return new File(Paths.document, "widget.json");
}

async function readSnapshot(): Promise<WidgetSnapshot> {
  try {
    const f = snapshotFile();
    return f.exists ? parseSnapshot(await f.text()) : EMPTY_SNAPSHOT;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function drawFor(snap: WidgetSnapshot) {
  return drawing().echeanceWidget(widgetView(snap, new Date()));
}

async function publish(snap: WidgetSnapshot): Promise<void> {
  const f = snapshotFile();
  if (!f.exists) f.create();
  f.write(JSON.stringify(snap));
  await lib().requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => drawFor(snap) });
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * À appeler après tout changement d'échéance (papier ajouté, lu, traité, supprimé, renommé) et à l'ouverture
 * du coffre. Regroupé : une rafale de changements ne redessine le widget qu'une fois.
 */
export function syncWidget(db: SQLiteDatabase): void {
  if (!widgetSupported) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void (async () => {
      const mode = reminderMode();
      // Coffre leurre : widget vide, pour ne rien laisser voir du vrai coffre.
      const snap = mode.muted ? EMPTY_SNAPSHOT : widgetSnapshot(await listAll(db), mode.discreet);
      await publish(snap);
    })().catch(() => undefined);
  }, 500);
}

/** Propose d’ajouter le widget à l’écran d’accueil (fenêtre du téléphone). false : le lanceur ne sait pas le faire. */
export async function pinWidget(): Promise<boolean> {
  if (!widgetSupported) return false;
  try {
    return await lib().requestPinWidget({ widgetName: WIDGET_NAME });
  } catch {
    return false;
  }
}

/** Appelé par Android (ajout du widget, redimensionnement, mise à jour toutes les 3 h), même app fermée. */
async function widgetTask({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  renderWidget(drawFor(await readSnapshot()));
}

/** À l'ouverture de l'app (index.js), avant tout écran. */
export function registerWidget(): void {
  if (!widgetSupported) return;
  try {
    lib().registerWidgetTaskHandler(widgetTask);
  } catch {
    // widget indisponible : l'app fonctionne sans
  }
}
