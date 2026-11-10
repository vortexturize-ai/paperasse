import { goBack } from "../../lib/nav";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/Icon";
import { Screen } from "../../components/Screen";
import { Card, SpeechBubble, txt } from "../../components/ui";
import { LIFE_EVENTS } from "../../engine/lifeEvents";

export default function LifeEventsScreen() {
  return (
    <Screen title="Moments de vie" onBack={goBack}>
      <SpeechBubble mood="happy">Il t’arrive quelque chose ? Je te donne toutes les démarches, dans l’ordre, avec les dates et les papiers que tu as déjà.</SpeechBubble>
      {LIFE_EVENTS.map((e) => (
        <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push(`/vie/${e.id}`)}>
          <Card>
            <View style={styles.row}>
              <Icon name="signpost" size={24} />
              <View style={{ flex: 1 }}>
                <Text style={txt.h3}>{e.title}</Text>
                <Text style={txt.small}>{e.intro}</Text>
              </View>
              <Icon name="chevron" size={18} />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 12 } });
