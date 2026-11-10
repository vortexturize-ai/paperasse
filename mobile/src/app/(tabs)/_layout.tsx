import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../../components/Icon";
import { border, colors, fonts, pop } from "../../components/theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Accueil", icon: "home" },
  dossiers: { label: "Dossiers", icon: "folder" },
  recherche: { label: "Chercher", icon: "search" },
  reglages: { label: "Réglages", icon: "sliders" },
};

/** Barre du bas cartoon : 4 onglets et un gros bouton « + » au milieu. */
function CartoonTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={styles.tab}
      >
        <View style={[styles.tabIcon, focused && styles.tabIconOn]}>
          <Icon name={tab.icon} size={22} strokeWidth={2.4} />
        </View>
        <Text style={[styles.tabLabel, focused && styles.tabLabelOn]}>{tab.label}</Text>
      </Pressable>
    );
  });
  const add = (
    <Pressable
      key="ajouter"
      accessibilityRole="button"
      accessibilityLabel="Ajouter un papier"
      onPress={() => router.push("/ajouter")}
      style={({ pressed }) => [styles.add, pop(4), pressed && { transform: [{ translateY: 2 }] }]}
    >
      <Icon name="plus" size={30} strokeWidth={3} />
    </Pressable>
  );
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.slice(0, 2)}
      {add}
      {items.slice(2)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CartoonTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="dossiers" options={{ title: "Dossiers" }} />
      <Tabs.Screen name="recherche" options={{ title: "Chercher" }} />
      <Tabs.Screen name="reglages" options={{ title: "Réglages" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    backgroundColor: colors.card,
    borderTopWidth: border,
    borderTopColor: colors.ink,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: { width: 66, alignItems: "center", gap: 3 },
  tabIcon: { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tabIconOn: { backgroundColor: colors.sun, borderWidth: 2.5, borderColor: colors.ink },
  tabLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  tabLabelOn: { fontFamily: fonts.bodyStrong, color: colors.ink },
  add: {
    width: 64,
    height: 64,
    marginTop: -30,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderWidth: border,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
