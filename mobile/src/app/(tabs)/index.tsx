import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Mascot, Wordmark } from "../../components/Brand";
import { Screen } from "../../components/Screen";
import { colors, fonts, pop, tones } from "../../components/theme";
import { Icon, type IconName } from "../../components/Icon";
import { Button, Card, Chip, DocCard, EmptyState, IconButton, SectionTitle, deadlineChip, txt } from "../../components/ui";
import type { BackupNudge } from "../../engine/backupPlan";
import { homeBackupNudge, snoozeBackupNudge } from "../../lib/autoBackup";
import { adminCalendar } from "../../engine/calendar";
import { findMoney } from "../../engine/money";
import { canReadImages } from "../../lib/ocr";
import { getSetting, listAll, listExpiring, listPeople, listRecent, listToDo } from "../../lib/db";
import { belongsTo, type Who } from "../../engine/people";
import { WhoPills } from "../../components/WhoPills";
import { daysUntil, formatDate, todayIso } from "../../lib/text";
import { toPaper } from "../../lib/vault";
import { useFocusData } from "../../lib/useFocusData";

async function loadHome(db: SQLiteDatabase) {
  const [toDo, expiring, recent, sender, all, people, nudge] = await Promise.all([
    listToDo(db),
    listExpiring(db),
    listRecent(db, 6),
    getSetting(db, "sender"),
    listAll(db),
    listPeople(db),
    homeBackupNudge(db),
  ]);
  const firstName = sender?.trim().split(/\s+/)[0] ?? "";
  return { toDo, expiring, recent, firstName, all, people, nudge };
}

/** Ce que voit l'accueil pour une personne (ou pour tout le monde). */
function forWho(base: Awaited<ReturnType<typeof loadHome>>, who: Who) {
  const mine = <T extends { personId: string | null }>(xs: T[]) => xs.filter((x) => belongsTo(x.personId, who));
  const papers = mine(base.all).map(toPaper);
  const today = todayIso();
  // Les dates à venir qui ne sont pas déjà dans « À faire » (contrôle technique, assurance, impôts…).
  const upcoming = adminCalendar(papers, today, 120).filter((e) => e.date >= today && e.kind !== "echeance").slice(0, 3);
  return {
    toDo: mine(base.toDo),
    expiring: mine(base.expiring),
    recent: mine(base.recent),
    firstName: base.firstName,
    upcoming,
    money: findMoney(papers, today),
    people: base.people,
    anyPaper: base.recent.length > 0,
    nudge: base.nudge,
  };
}

const NUDGE_TEXT: Record<BackupNudge["kind"], (n: BackupNudge) => [string, string]> = {
  jamais: () => ["Tes papiers ne sont sauvegardés nulle part", "Si ce téléphone casse ou se perd, ils sont perdus. Une sauvegarde chiffrée prend une minute."],
  vieille: (n) => [`Ta dernière sauvegarde date de ${n.kind === "vieille" ? n.days : 0} jours`, "Les papiers ajoutés depuis seraient perdus si le téléphone casse."],
  nouveaux: (n) => [`${n.kind === "nouveaux" ? n.added : 0} papiers ne sont pas encore sauvegardés`, "Ils seraient perdus si le téléphone casse."],
  auto_echec: () => ["La sauvegarde automatique n’a pas marché", "Le dossier choisi n’est plus accessible (clé débranchée, accès retiré). Choisis-le à nouveau."],
};

/** Rappel de sauvegarde : la seule protection quand un téléphone casse. */
function BackupCard({ nudge, onSnooze }: { nudge: BackupNudge; onSnooze: () => void }) {
  const [title, text] = NUDGE_TEXT[nudge.kind](nudge);
  return (
    <Card tone="orange">
      <View style={styles.rowCenter}>
        <Icon name="shield" size={24} color={tones.orange.fg} />
        <Text style={[txt.h3, { flex: 1, color: tones.orange.fg }]}>{title}</Text>
      </View>
      <Text style={txt.small}>{text}</Text>
      <View style={styles.nudgeButtons}>
        <Button label={nudge.kind === "auto_echec" ? "Choisir le dossier" : "Sauvegarder"} icon="shield" variant="sun" onPress={() => router.push("/sauvegarde")} style={{ flex: 1 }} />
        {nudge.kind === "auto_echec" ? null : <Button label="Plus tard" variant="secondary" onPress={onSnooze} style={{ flex: 1 }} />}
      </View>
    </Card>
  );
}

export default function Home() {
  const db = useSQLiteContext();
  const { data: loaded, reload } = useFocusData(loadHome);
  const [who, setWho] = useState<Who>("tous");
  // Calendrier et pistes d'argent passent sur tous les papiers : calculés une fois par chargement, pas à chaque rendu.
  const data = useMemo(
    () => (loaded ? forWho(loaded, loaded.people.some((p) => p.id === who) || who === "moi" ? who : "tous") : null),
    [loaded, who],
  );
  const late = data?.toDo.filter((d) => d.deadline !== null && daysUntil(d.deadline) < 0).length ?? 0;
  const count = data?.toDo.length ?? 0;
  const empty = data !== null && !data.anyPaper;

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark size={30} />
          <IconButton icon="bell" label="Rappels et réglages" onPress={() => router.push("/reglages")} />
        </View>
      }
    >
      <View style={{ gap: 2 }}>
        <Text style={txt.h1}>{data?.firstName ? `Bonjour ${data.firstName} !` : "Bonjour !"}</Text>
        <Text style={txt.small}>Voilà ce qui t’attend.</Text>
      </View>
      {data && data.people.length > 0 ? <WhoPills people={data.people} value={who} onChange={setWho} withAll /> : null}

      {!canReadImages ? (
        <Card tone="blue" flat>
          <Text style={[txt.small, { color: tones.blue.fg }]}>
            Mode essai : ici, les photos ne sont pas lues (ça marche dans l’app installée). Touche + puis « Coller un texte » pour essayer le moteur.
          </Text>
        </Card>
      ) : null}

      {data && !empty ? (
        <View style={[styles.hero, pop(5)]}>
          <Text style={styles.heroCount}>{count}</Text>
          <View style={styles.heroText}>
            <Text style={[txt.strong, { fontSize: 17 }]}>
              {count === 0 ? "Rien à faire, tout est en ordre !" : `papier${count > 1 ? "s" : ""} à traiter`}
            </Text>
            {late > 0 ? <Chip label={`dont ${late} en retard`} tone="red" icon="clock" /> : null}
          </View>
          <Mascot size={62} tilt={8} />
        </View>
      ) : null}

      {data?.nudge ? (
        <BackupCard
          nudge={data.nudge}
          onSnooze={() => {
            void snoozeBackupNudge(db).then(reload);
          }}
        />
      ) : null}

      {empty ? (
        <EmptyState
          title="Aucun papier pour l’instant"
          text="Touche le gros bouton + en bas : prends un courrier en photo, je le range et je te dis quoi faire."
        />
      ) : null}

      {data && !empty ? (
        <>
          <SectionTitle>Pour toi</SectionTitle>
          <View style={styles.tiles}>
            <Tile icon="signpost" label="Moments de vie" color={tones.purple.bg} onPress={() => router.push("/vie")} />
            <Tile icon="folderCheck" label="Dossiers prêts" color={tones.blue.bg} onPress={() => router.push("/dossiers-prets")} />
            <Tile icon="calendar" label="Mon calendrier" color={tones.orange.bg} onPress={() => router.push("/calendrier")} />
            <Tile icon="shield" label="Vérifier un message" color={tones.red.bg} onPress={() => router.push("/arnaque")} />
          </View>
          {data.money.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push("/argent")}>
              <Card tone="green">
                <View style={styles.rowCenter}>
                  <Icon name="euro" size={24} color={tones.green.fg} />
                  <Text style={[txt.h3, { flex: 1, color: tones.green.fg }]}>
                    {data.money.length} piste{data.money.length > 1 ? "s" : ""} pour récupérer de l’argent
                  </Text>
                  <Icon name="chevron" size={18} color={tones.green.fg} />
                </View>
                <Text style={txt.small}>{data.money[0].title}</Text>
              </Card>
            </Pressable>
          ) : null}
          {data.upcoming.map((e, i) => (
            <Pressable key={i} accessibilityRole="button" onPress={() => router.push("/calendrier")}>
              <Card flat style={styles.rowCenter}>
                <Icon name="calendar" size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={txt.strong}>{e.title}</Text>
                  <Text style={txt.small}>{e.certainty === "approx" ? "Vers le " : "Le "}{formatDate(e.date)}</Text>
                </View>
                <Chip {...deadlineChip(e.date)} />
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      {data && data.toDo.length > 0 ? (
        <>
          <SectionTitle>À faire</SectionTitle>
          {data.toDo.map((d) => (
            <DocCard key={d.id} doc={d} />
          ))}
        </>
      ) : null}

      {data && data.expiring.length > 0 ? (
        <>
          <SectionTitle>Expire bientôt</SectionTitle>
          {data.expiring.map((d) => (
            <DocCard key={d.id} doc={d} />
          ))}
        </>
      ) : null}

      {data && data.recent.length > 0 ? (
        <>
          <SectionTitle>Ajoutés récemment</SectionTitle>
          {data.recent.map((d) => (
            <DocCard key={d.id} doc={d} showDeadline={false} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Tile({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: color }, pop(3), pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={26} />
      <Text style={[txt.strong, { textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nudgeButtons: { flexDirection: "row", gap: 10, marginTop: 10 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 92, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, padding: 10 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.sun,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 24,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 14,
  },
  heroCount: { fontFamily: fonts.titleBold, fontSize: 54, lineHeight: 60, color: colors.ink },
  heroText: { flex: 1, gap: 4 },
});
