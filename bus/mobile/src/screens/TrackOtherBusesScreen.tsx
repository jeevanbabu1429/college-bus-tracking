import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const [query, setQuery] = useState("");
  const inFlight = useRef(false);

  // Client-side filter. Case-insensitive substring match across bus number,
  // plate, driver name, and route — the fields a student is most likely to
  // remember about a specific bus.
  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      return (
        it.bus.busNumber.toLowerCase().includes(q) ||
        it.bus.plateNumber.toLowerCase().includes(q) ||
        it.driver.name.toLowerCase().includes(q) ||
        (it.bus.route ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

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
              : query.trim()
              ? `${filtered?.length ?? 0} of ${items.length} match`
              : `${items.length} live bus${items.length === 1 ? "" : "es"}`}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Search input — only meaningful when there's something to filter. */}
      {items && items.length > 0 && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search bus number, driver, or route"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={10}
                style={styles.searchClear}
              >
                <Text style={styles.searchClearText}>×</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

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
      ) : filtered && filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emojiBig}>🔎</Text>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>
            No live bus matches &ldquo;{query.trim()}&rdquo;. Try a different
            bus number, driver name, or route.
          </Text>
          <Pressable
            onPress={() => setQuery("")}
            style={styles.clearFilterBtn}
            hitSlop={8}
          >
            <Text style={styles.clearFilterText}>Clear search</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered ?? []}
          keyExtractor={(it) => it.bus._id}
          contentContainerStyle={styles.listPad}
          keyboardShouldPersistTaps="handled"
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
                {item.driver.mobile ? (
                  <Pressable
                    onPress={(e) => {
                      // Prevent the row's onPress from navigating to the map.
                      e.stopPropagation();
                      callDriver(item.driver.name, item.driver.mobile);
                    }}
                    style={({ pressed }) => [
                      styles.callBtn,
                      pressed && styles.callBtnPressed,
                    ]}
                    android_ripple={{ color: "#ffffff44" }}
                    hitSlop={6}
                  >
                    <Text style={styles.callIcon}>📞</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
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

function callDriver(name: string, mobile: string): void {
  const digits = mobile.replace(/\D/g, "");
  if (!digits) return;
  const url = `tel:${digits}`;
  Linking.canOpenURL(url)
    .then((can) => {
      if (can) return Linking.openURL(url);
      // Emulators or tablets without a dialer — show the number so the
      // student can copy or read it manually.
      Alert.alert("Can't open dialer", `Call ${name} on ${mobile}?`);
    })
    .catch(() => {
      Alert.alert(
        "Couldn't start the call",
        `Please dial ${mobile} manually.`
      );
    });
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
    callBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#2e7d32",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#2e7d32",
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      marginLeft: 4,
    },
    callBtnPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
    callIcon: { fontSize: 18 },

    // ─── Search box ──────────────────────────────────────────────
    searchWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: colors.background,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchIcon: { fontSize: 15 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
      fontWeight: "500",
    },
    searchClear: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    searchClearText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: "700",
      lineHeight: 18,
    },
    clearFilterBtn: {
      marginTop: 16,
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: colors.accent,
      borderRadius: 999,
    },
    clearFilterText: {
      color: colors.textOnAccent,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
  });
}
