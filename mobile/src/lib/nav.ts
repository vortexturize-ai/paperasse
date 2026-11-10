import { router } from "expo-router";

/** Retour à l'écran précédent ; s'il n'y en a pas (ouvert depuis un rappel ou un lien), retour à l'accueil. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
