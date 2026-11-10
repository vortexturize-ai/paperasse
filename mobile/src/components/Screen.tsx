import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton, txt } from "./ui";
import { colors } from "./theme";

/**
 * Cadre commun des écrans : fond crème, en-tête dessiné (titre, retour ou fermer), contenu qui défile.
 * `bottomSpace` laisse la place à la barre d'onglets.
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
  const head =
    header ?? (
      <View style={styles.header}>
        {onBack ? <IconButton icon="back" label="Retour" onPress={onBack} /> : null}
        {title ? (
          <Text style={[txt.h1, styles.title]} numberOfLines={1} accessibilityRole="header">
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
    <SafeAreaView edges={["top"]} style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
          keyboardShouldPersistTaps="handled"
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, { paddingBottom: bottomSpace }]}>
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
