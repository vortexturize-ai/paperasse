import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { CATEGORIES, URGENCY, categoryOf } from "../lib/categories";
import { daysUntil, formatAmount, relativeDays } from "../lib/text";
import type { DocumentRecord } from "../lib/types";
import { Mascot, type Mood } from "./Brand";
import { Icon, type IconName } from "./Icon";
import { Tap } from "./Tap";
import type { Sound } from "../lib/feedback";
import { border, colors, fonts, pop, radius, tones, type Tone } from "./theme";

export const txt = StyleSheet.create({
  h1: { fontFamily: fonts.title, fontSize: 26, lineHeight: 31, color: colors.ink },
  h2: { fontFamily: fonts.title, fontSize: 21, lineHeight: 26, color: colors.ink },
  h3: { fontFamily: fonts.title, fontSize: 17, lineHeight: 21, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  strong: { fontFamily: fonts.bodyStrong, fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
});

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={[txt.h2, { marginTop: 6 }]}>{children}</Text>;
}

type Variant = "primary" | "sun" | "success" | "secondary" | "danger" | "info";

const VARIANTS: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.orange, fg: colors.ink },
  sun: { bg: colors.sun, fg: colors.ink },
  success: { bg: colors.green, fg: colors.greenInk },
  secondary: { bg: colors.card, fg: colors.ink },
  danger: { bg: tones.red.bg, fg: tones.red.fg },
  info: { bg: tones.blue.bg, fg: tones.blue.fg },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Son de l'appui ; false pour un bouton silencieux. */
  sound?: Sound | false;
}) {
  const { label, onPress, variant = "primary", icon, size = "md", loading, disabled, style, sound = "tap" } = props;
  const off = disabled || loading;
  const v = VARIANTS[variant];
  const height = size === "lg" ? 60 : size === "md" ? 52 : 46;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      accessibilityLabel={label}
      onPress={onPress}
      sound={sound}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { minHeight: height, backgroundColor: v.bg },
        size === "sm" ? { borderWidth: 2.5 } : pop(size === "lg" ? 5 : 4),
        pressed && styles.pressed,
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === "lg" ? 24 : 20} color={v.fg} strokeWidth={2.6} /> : null}
          <Text
            style={{
              color: v.fg,
              fontFamily: size === "lg" ? fonts.title : fonts.bodyStrong,
              fontSize: size === "lg" ? 21 : size === "md" ? 16 : 15,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Tap>
  );
}

/** Bouton rond avec icône seule (retour, fermer, rappels). */
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      sound="select"
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pop(3), pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} strokeWidth={2.6} />
    </Tap>
  );
}

/** Pastille sélectionnable (langue, dossier, objectif). */
export function Pill({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      sound="select"
      depth={1}
      style={({ pressed }) => [
        styles.pill,
        selected && { backgroundColor: colors.sun },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? <Icon name={icon} size={16} strokeWidth={2.4} /> : null}
      <Text style={{ fontFamily: selected ? fonts.bodyStrong : fonts.body, fontSize: 14, color: colors.ink }}>{label}</Text>
    </Tap>
  );
}

export function Card({ children, tone, style, flat }: { children: ReactNode; tone?: Tone; style?: ViewStyle; flat?: boolean }) {
  return (
    <View style={[styles.card, tone && { backgroundColor: tones[tone].bg }, !flat && pop(4), style]}>{children}</View>
  );
}

/** `onTint` : fond blanc, pour une pastille posée sur une carte de la même couleur. */
export function Chip({ label, tone, icon, onTint }: { label: string; tone: Tone; icon?: IconName; onTint?: boolean }) {
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: onTint ? colors.card : t.bg }]}>
      {icon ? <Icon name={icon} size={13} color={t.fg} strokeWidth={2.6} /> : null}
      <Text style={[styles.chipText, { color: t.fg }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

export function IconTile({ icon, tone, size = 48 }: { icon: IconName; tone: Tone; size?: number }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tones[tone].bg },
      ]}
    >
      <Icon name={icon} size={size * 0.54} strokeWidth={2.2} />
    </View>
  );
}

/** La mascotte qui parle dans une bulle. */
export function SpeechBubble({
  title,
  children,
  mascotSize = 62,
  mood = "happy",
}: {
  title?: string;
  children: ReactNode;
  mascotSize?: number;
  mood?: Mood;
}) {
  return (
    <View style={styles.bubbleRow}>
      <Mascot size={mascotSize} tilt={-6} mood={mood} />
      <View style={[styles.bubble, pop(4)]}>
        {title ? <Text style={[txt.h3, { color: tones.purple.fg }]}>{title}</Text> : null}
        {typeof children === "string" ? <Text style={txt.strong}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function EmptyState({ title, text, mood = "sleepy" }: { title: string; text?: string; mood?: Mood }) {
  return (
    <View style={styles.empty}>
      <Mascot size={86} tilt={-8} mood={mood} />
      <Text style={[txt.h3, styles.center]}>{title}</Text>
      {text ? <Text style={[txt.small, styles.center]}>{text}</Text> : null}
    </View>
  );
}

export function deadlineChip(iso: string): { label: string; tone: Tone } {
  const n = daysUntil(iso);
  if (n < 0) return { label: `En retard de ${-n} jour${n < -1 ? "s" : ""}`, tone: "red" };
  if (n === 0) return { label: "Aujourd'hui", tone: "red" };
  if (n === 1) return { label: "Demain", tone: "orange" };
  if (n <= 7) return { label: `Dans ${n} jours`, tone: "orange" };
  return { label: `Dans ${n} jours`, tone: "yellow" };
}

/** Ligne d'un papier dans une liste. */
export function DocCard({ doc, showDeadline = true }: { doc: DocumentRecord; showDeadline?: boolean }) {
  const cat = CATEGORIES[categoryOf(doc.category)];
  const money =
    doc.amount !== null && doc.amountDirection === "a_payer"
      ? `${formatAmount(doc.amount)} à payer`
      : doc.amount !== null && doc.amountDirection === "a_recevoir"
        ? `${formatAmount(doc.amount)} à recevoir`
        : null;
  const subtitle = [doc.issuer, money].filter(Boolean).join(" · ") || cat.label;
  return (
    <Tap
      accessibilityRole="button"
      onPress={() => router.push(`/document/${doc.id}`)}
      style={({ pressed }) => [styles.docCard, pop(4), pressed && styles.pressed]}
    >
      <IconTile icon={cat.icon} tone={cat.tone} />
      <View style={styles.docBody}>
        <Text style={[txt.strong, { fontSize: 16, lineHeight: 20 }]} numberOfLines={2}>
          {doc.title}
        </Text>
        <Text style={txt.small} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.docChips}>
          {doc.analysisStatus === "error" ? <Chip label="Analyse à relancer" tone="orange" icon="refresh" /> : null}
          {showDeadline && doc.deadline && !doc.isDone ? <Chip {...deadlineChip(doc.deadline)} icon="clock" /> : null}
          {doc.toDo && !doc.isDone && !doc.deadline ? <Chip label={URGENCY[doc.urgency].label} tone={URGENCY[doc.urgency].tone} /> : null}
          {doc.toDo && doc.isDone ? <Chip label="C'est fait" tone="green" icon="check" /> : null}
          {showDeadline && doc.expiryDate ? <Chip label={`Expire ${relativeDays(doc.expiryDate)}`} tone="blue" icon="calendar" /> : null}
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ translateY: 2 }], boxShadow: `0px 2px 0px ${colors.ink}` },
  center: { textAlign: "center" },
  button: {
    borderRadius: radius,
    borderWidth: border,
    borderColor: colors.ink,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: border,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: border,
    borderColor: colors.ink,
    padding: 14,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipText: { fontFamily: fonts.bodyStrong, fontSize: 12, lineHeight: 16 },
  tile: { borderWidth: 2.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: border,
    borderColor: colors.ink,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  empty: { alignItems: "center", padding: 28, gap: 8 },
  docCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: border,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  docBody: { flex: 1, gap: 3 },
  docChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
});
