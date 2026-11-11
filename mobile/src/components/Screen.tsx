import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, txt } from "./ui";
import { colors } from "./theme";

/** Largeur maximale du contenu : sur tablette, les cartes restent lisibles au lieu de s'étirer. */
export const CONTENT_MAX_WIDTH = 640;

/** Styles de largeur du contenu selon l'écran (téléphone : toute la largeur ; tablette : colonne centrée). */
export function useContentWidth(): { wide: boolean; style: { width: "100%"; maxWidth: number; alignSelf: "center" } | null } {
  const { width } = useWindowDimensions();
  const wide = width > CONTENT_MAX_WIDTH + 48;
  return { wide, style: wide ? { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" } : null };
}

/**
 * Cadre commun des écrans : fond crème, en-tête dessiné (titre, retour ou fermer), contenu qui défile.
 * `bottomSpace` laisse la place à la barre d'onglets ; la zone sûre du bas (barre de navigation Android,
 * indicateur iPhone) est ajoutée automatiquement. Sur iOS, le clavier pousse le contenu au lieu de le couvrir.
 */
export function Screen({
  title,
  header,
  onBack,
  onClose,
  right,
  children,
  scroll = true,
  bottomSpace = 32,
}: {
  title?: string;
  header?: ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  bottomSpace?: number;
}) {
  const insets = useSafeAreaInsets();
  const width = useContentWidth();
  const padding = { paddingBottom: bottomSpace + insets.bottom };
  const head =
    header ?? (
      <View style={styles.header}>
        {onBack ? <IconButton icon="back" label="Retour" onPress={onBack} /> : null}
        {title ? (
          <Text style={[txt.h1, styles.title]} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
            {title}
          </Text>
        ) : (
          <View style={styles.title} />
        )}
        {right}
        {onClose ? <IconButton icon="close" label="Fermer" onPress={onClose} /> : null}
      </View>
    );
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, width.style, padding]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentInsetAdjustmentBehavior="never"
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, width.style, padding]}>
          {head}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  title: { flex: 1 },
});
