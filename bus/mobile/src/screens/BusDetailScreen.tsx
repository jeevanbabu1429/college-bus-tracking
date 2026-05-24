import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeBusesApi, type Bus } from "../api/collegeBuses";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "BusDetail">;

export function BusDetailScreen({ navigation, route }: Props) {
  const { collegeId, busId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [bus, setBus] = useState<Bus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      collegeBusesApi
        .list(collegeId)
        .then((list) => {
          if (cancelled) return;
          const found = list.find((b) => b._id === busId);
          if (!found) setError("Bus not found");
          else setBus(found);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, [collegeId, busId])
  );

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Bus Details</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!bus && !error && (
          <ActivityIndicator
            color={colors.accent}
            style={{ marginTop: 32 }}
          />
        )}

        {bus && (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroHeaderRow}>
                <Text style={styles.heroLabel}>Bus</Text>
                <View
                  style={[
                    styles.statusPill,
                    bus.driver
                      ? styles.statusPillActive
                      : styles.statusPillIdle,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      bus.driver
                        ? styles.statusDotActive
                        : styles.statusDotIdle,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      bus.driver
                        ? styles.statusTextActive
                        : styles.statusTextIdle,
                    ]}
                  >
                    {bus.driver ? "Active" : "No driver"}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroNumber}>Bus {bus.busNumber}</Text>
              <Text style={styles.heroPlate}>{bus.plateNumber}</Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaCell}>
                  <Text style={styles.heroMetaLabel}>Capacity</Text>
                  <Text style={styles.heroMetaValue}>{bus.capacity}</Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaCell}>
                  <Text style={styles.heroMetaLabel}>Stops</Text>
                  <Text style={styles.heroMetaValue}>{bus.stops.length}</Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaCell}>
                  <Text style={styles.heroMetaLabel}>Route</Text>
                  <Text style={styles.heroMetaValueSmall} numberOfLines={1}>
                    {bus.route || "—"}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Driver</Text>
            {bus.driver ? (
              <Pressable
                style={({ pressed }) => [
                  styles.driverCard,
                  pressed && styles.driverCardPressed,
                ]}
                onPress={() =>
                  navigation.navigate("SelectDriverForBus", {
                    collegeId,
                    busId: bus._id,
                    busNumber: bus.busNumber,
                    plateNumber: bus.plateNumber,
                    currentDriverId: bus.driver?._id ?? null,
                  })
                }
              >
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {bus.driver.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{bus.driver.name}</Text>
                  <Text style={styles.driverMeta}>Tap to change driver</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🪪</Text>
                <Text style={styles.emptyTitle}>No driver assigned</Text>
                <Text style={styles.emptyBody}>
                  Pick a driver to operate this bus.
                </Text>
                <Pressable
                  style={styles.assignBtn}
                  onPress={() =>
                    navigation.navigate("SelectDriverForBus", {
                      collegeId,
                      busId: bus._id,
                      busNumber: bus.busNumber,
                      plateNumber: bus.plateNumber,
                      currentDriverId: null,
                    })
                  }
                >
                  <Text style={styles.assignBtnText}>+ Assign driver</Text>
                </Pressable>
              </View>
            )}

            {bus.notice ? (
              <View
                style={{
                  backgroundColor: "#fff4e5",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#f0c98a",
                }}
              >
                <Text style={{ color: "#92400e", fontSize: 13 }}>
                  ⚠️ {bus.notice}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Route</Text>
            {bus.route || bus.stops.length > 0 ? (
              <View style={styles.routeCard}>
                {bus.route ? (
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeIcon}>🛣️</Text>
                    <Text style={styles.routeName} numberOfLines={2}>
                      {bus.route}
                    </Text>
                  </View>
                ) : null}

                {bus.stops.length > 0 && (
                  <View style={styles.stopsList}>
                    {bus.stops.map((stop, i) => (
                      <View
                        key={`${stop.name}-${i}`}
                        style={[
                          styles.stopRow,
                          i < bus.stops.length - 1 && styles.stopRowDivider,
                          stop.suspended && { opacity: 0.5 },
                        ]}
                      >
                        <View style={styles.stopBullet}>
                          <Text style={styles.stopBulletText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stopText}>
                          {stop.name}
                          {stop.suspended ? "  (suspended)" : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🛣️</Text>
                <Text style={styles.emptyTitle}>No route set</Text>
                <Text style={styles.emptyBody}>
                  Add a route name and the stops this bus will pick up from.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
              ]}
              onPress={() =>
                navigation.navigate("SetBusRoute", { collegeId, bus })
              }
            >
              <Text style={styles.primaryText}>
                {bus.route || bus.stops.length > 0
                  ? "Edit Route & Stops"
                  : "Set Route & Stops"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    appBar: {
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { color: colors.text, fontWeight: "800", fontSize: 18 },
    appTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

    body: { flex: 1 },
    bodyContent: { padding: 16, paddingBottom: 40 },

    heroCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 24,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    heroHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroLabel: {
      color: colors.statsLabel,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusPillActive: { backgroundColor: "rgba(245,183,0,0.2)" },
    statusPillIdle: { backgroundColor: "rgba(255,255,255,0.08)" },
    statusDot: { width: 8, height: 8, borderRadius: 999 },
    statusDotActive: { backgroundColor: colors.accent },
    statusDotIdle: { backgroundColor: "#7a7a80" },
    statusText: { fontSize: 11, fontWeight: "700" },
    statusTextActive: { color: colors.accent },
    statusTextIdle: { color: "#9aa0a6" },
    heroNumber: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 16 },
    heroPlate: { color: colors.accent, fontWeight: "700", marginTop: 2 },
    heroMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 14,
      padding: 12,
      marginTop: 18,
    },
    heroMetaCell: { flex: 1, alignItems: "center" },
    heroMetaLabel: {
      color: colors.statsLabel,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    heroMetaValue: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800",
      marginTop: 4,
    },
    heroMetaValueSmall: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
      marginTop: 4,
    },
    heroMetaDivider: {
      width: 1,
      height: 28,
      backgroundColor: "rgba(255,255,255,0.08)",
    },

    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 10,
      paddingHorizontal: 4,
    },

    driverCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    driverCardPressed: { backgroundColor: colors.surfaceMuted },
    driverAvatar: {
      width: 48,
      height: 48,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    driverAvatarText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 18,
    },
    driverName: { fontSize: 16, fontWeight: "700", color: colors.text },
    driverMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

    routeCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    routeHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    routeIcon: { fontSize: 18 },
    routeName: { fontSize: 16, fontWeight: "800", color: colors.text, flex: 1 },
    stopsList: { paddingTop: 4 },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 14,
    },
    stopRowDivider: {
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    stopBullet: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stopBulletText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    stopText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      fontWeight: "600",
    },

    emptyCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      padding: 22,
      alignItems: "center",
    },
    emptyEmoji: { fontSize: 36, marginBottom: 8 },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      paddingHorizontal: 8,
    },
    assignBtn: {
      marginTop: 14,
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
    },
    assignBtnText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 13,
    },

    primary: {
      marginTop: 28,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    primaryPressed: { opacity: 0.9 },
    primaryText: {
      color: colors.textOnAccent,
      fontSize: 16,
      fontWeight: "800",
    },

    errorBox: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: "rgba(192,57,43,0.08)",
      borderWidth: 1,
      borderColor: "rgba(192,57,43,0.2)",
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
