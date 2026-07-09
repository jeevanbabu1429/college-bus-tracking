import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { studentAuthApi, type LiveBusItem } from "../api/studentAuth";
import type { StudentStackParamList } from "../navigation/types";

const POLL_MS = 5000;
type Nav = NativeStackNavigationProp<StudentStackParamList, "TrackOtherBuses">;

export function TrackOtherBusesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<LiveBusItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await studentAuthApi.liveBuses();
      setItems(data);
    } catch {
      // swallow transient errors to avoid flicker
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Text style={styles.iconBtnText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Track other bus</Text>
          <Text style={styles.subtitle}>
            {items === null
              ? "Loading…"
              : items.length === 0
              ? "No buses on a trip right now"
              : `${items.length} live bus${items.length === 1 ? "" : "es"}`}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emojiBig}>🛌</Text>
          <Text style={styles.emptyTitle}>Nobody on the road</Text>
          <Text style={styles.emptyBody}>
            When a driver taps Start Trip on their phone, their bus will
            appear here. Pull to refresh.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.bus._id}
          contentContainerStyle={styles.listPad}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          renderItem={({ item }) => {
            const loc = item.driver.currentLocation;
            const placed =
              loc && typeof loc.lat === "number" && typeof loc.lng === "number";
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate("TrackOtherBusMap", {
                    busId: item.bus._id,
                    busNumber: item.bus.busNumber,
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowIconBox}>
                  <Text style={styles.rowEmoji}>🚌</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTitleLine}>
                    <Text style={styles.rowBusNumber}>
                      Bus {item.bus.busNumber}
                    </Text>
                    <View
                      style={[
                        styles.pill,
                        placed ? styles.pillLive : styles.pillNoFix,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          placed ? styles.pillTextLive : styles.pillTextNoFix,
                        ]}
                      >
                        {placed ? "Live" : "No fix"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowDriver} numberOfLines={1}>
                    Driver · {item.driver.name}
                  </Text>
                  {item.bus.route ? (
                    <Text style={styles.rowRoute} numberOfLines={1}>
                      {item.bus.route}
                    </Text>
                  ) : null}
                  {placed && loc ? (
                    <Text style={styles.rowAge}>
                      Updated {secondsAgo(loc.updatedAt)}s ago
                    </Text>
                  ) : (
                    <Text style={styles.rowAge}>
                      Trip started · waiting for first location
                    </Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function secondsAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    appBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingTop: 50,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnText: { fontSize: 22, color: colors.text },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emojiBig: { fontSize: 48, marginBottom: 12 },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    listPad: { padding: 16, gap: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowPressed: { opacity: 0.7 },
    rowIconBox: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    rowEmoji: { fontSize: 22 },
    rowTitleLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowBusNumber: { fontSize: 16, fontWeight: "700", color: colors.text },
    rowDriver: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    rowRoute: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    rowAge: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    pillLive: { backgroundColor: "#2e7d32" + "22" },
    pillNoFix: { backgroundColor: colors.surfaceMuted },
    pillText: { fontSize: 11, fontWeight: "700" },
    pillTextLive: { color: "#2e7d32" },
    pillTextNoFix: { color: colors.textMuted },
    chevron: { fontSize: 22, color: colors.textMuted, marginLeft: 4 },
  });
}
