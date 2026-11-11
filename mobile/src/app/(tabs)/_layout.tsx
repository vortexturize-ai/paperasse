import { router, Tabs } from "expo-router";
import { useEffect, type ComponentProps, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "../../components/Icon";
import { useContentWidth } from "../../components/Screen";
import { Tap } from "../../components/Tap";
import { motionReduced } from "../../lib/feedback";
import { border, colors, fonts, pop } from "../../components/theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Accueil", icon: "home" },
  dossiers: { label: "Dossiers", icon: "folder" },
  recherche: { label: "Chercher", icon: "search" },
  reglages: { label: "Réglages", icon: "sliders" },
};

/** Pastille jaune de l'onglet actif : elle « pop » quand on arrive sur l'onglet. */
function TabIcon({ icon, focused }: { icon: IconName; focused: boolean }) {
  const [v] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (motionReduced()) v.setValue(focused ? 1 : 0);
    else Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: Platform.OS !== "web", speed: 16, bounciness: 14 }).start();
  }, [focused, v]);
  return (
    <View style={styles.tabIcon}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.tabIconOn, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} />
      <Icon name={icon} size={22} strokeWidth={2.4} />
    </View>
  );
}

/** Barre du bas cartoon : 4 onglets et un gros bouton « + » au milieu. S'adapte aux petits écrans et aux tablettes. */
function CartoonTabBar({ state, navigateToTab, insets }: TabBarProps) {
  const width = useContentWidth();
  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    return (
      <Tap
        key={route.key}
        sound={focused ? false : "select"}
        depth={1}
        shrink={0.94}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={styles.tab}
      >
        <TabIcon icon={tab.icon} focused={focused} />
        <Text style={[styles.tabLabel, focused && styles.tabLabelOn]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {tab.label}
        </Text>
      </Tap>
    );
  });
  const add = (
    <Tap
      key="ajouter"
      sound="pop"
      depth={3}
      shrink={0.9}
      accessibilityRole="button"
      accessibilityLabel="Ajouter un papier"
      onPress={() => router.push("/ajouter")}
      style={[styles.add, pop(4)]}
    >
      <Icon name="plus" size={30} strokeWidth={3} />
    </Tap>
  );
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.row, width.style]}>
        {items.slice(0, 2)}
        {add}
        {items.slice(2)}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CartoonTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: "shift" }}
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
    backgroundColor: colors.card,
    borderTopWidth: border,
    borderTopColor: colors.ink,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-around" },
  tab: { flex: 1, maxWidth: 110, alignItems: "center", gap: 3, minHeight: 44 },
  tabIcon: { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tabIconOn: { backgroundColor: colors.sun, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 16 },
  tabLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  tabLabelOn: { fontFamily: fonts.bodyStrong, color: colors.ink },
  add: {
    width: 64,
    height: 64,
    marginTop: -30,
    marginHorizontal: 4,
    borderRadius: 32,
    backgroundColor: colors.orange,
    borderWidth: border,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
