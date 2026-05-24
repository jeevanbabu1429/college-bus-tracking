import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeBusesApi, type Bus } from "../api/collegeBuses";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "ViewBuses">;

export function ViewBusesScreen({ navigation, route }: Props) {
  const { collegeId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      collegeBusesApi
        .list(collegeId)
        .then((list) => {
          if (!cancelled) setBuses(list);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, [collegeId])
  );

  const totalBuses = buses?.length ?? 0;
  const withDriver = buses?.filter((b) => b.driver).length ?? 0;

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
          <Text style={styles.appTitle}>Buses</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("AddBuses", { collegeId })}
          style={styles.addBtn}
          hitSlop={12}
        >
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!buses && !error && (
        <ActivityIndicator
          color={colors.accent}
          style={{ marginTop: 32 }}
        />
      )}

      {buses && (
        <FlatList
          data={buses}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContent,
            buses.length === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            buses.length > 0 ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryNum}>{totalBuses}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryNum}>{withDriver}</Text>
                  <Text style={styles.summaryLabel}>With driver</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryNum}>
                    {totalBuses - withDriver}
                  </Text>
                  <Text style={styles.summaryLabel}>Unassigned</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.busCard,
                pressed && styles.busCardPressed,
              ]}
              onPress={() =>
                navigation.navigate("BusDetail", {
                  collegeId,
                  busId: item._id,
                })
              }
            >
              <View style={styles.badge}>
                <Text style={styles.badgeNumber}>{item.busNumber}</Text>
                <Text style={styles.badgeLabel}>BUS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.plate}>{item.plateNumber}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaIcon}>👥</Text>
                    <Text style={styles.metaText}>
                      {item.capacity} seats
                    </Text>
                  </View>
                  {item.route ? (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaIcon}>🛣️</Text>
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.route}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.driver ? (
                  <View style={styles.driverChip}>
                    <Text style={styles.driverChipDot}>●</Text>
                    <Text style={styles.driverChipText} numberOfLines={1}>
                      {item.driver.name}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.driverChipNone}>
                    <Text style={styles.driverChipNoneText}>
                      No driver assigned
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🚌</Text>
              <Text style={styles.emptyTitle}>No buses yet</Text>
              <Text style={styles.emptyBody}>
                Add your first bus to start assigning drivers and students.
              </Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("AddBuses", { collegeId })}
              >
                <Text style={styles.emptyBtnText}>+ Add Bus</Text>
              </Pressable>
            </View>
          }
        />
      )}
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
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 22,
      lineHeight: 24,
    },

    listContent: { padding: 16, paddingBottom: 32 },
    emptyContent: { flexGrow: 1, justifyContent: "center" },

    summaryRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    summaryChip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    summaryNum: { fontSize: 22, fontWeight: "800", color: colors.text },
    summaryLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "700",
      marginTop: 2,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    busCard: {
      flexDirection: "row",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    busCardPressed: { backgroundColor: colors.surfaceMuted },
    badge: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeNumber: {
      color: colors.textOnAccent,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 22,
    },
    badgeLabel: {
      color: "rgba(0,0,0,0.5)",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      marginTop: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    plate: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: 0.5,
    },
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },
    metaRow: {
      flexDirection: "row",
      gap: 14,
      marginTop: 6,
      flexWrap: "wrap",
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaIcon: { fontSize: 12 },
    metaText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },

    driverChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
    },
    driverChipDot: { color: colors.accent, fontSize: 10, lineHeight: 12 },
    driverChipText: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "700",
    },
    driverChipNone: {
      alignSelf: "flex-start",
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
    },
    driverChipNoneText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "700",
    },

    emptyState: { alignItems: "center", paddingVertical: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 6,
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      paddingHorizontal: 24,
    },
    emptyBtn: {
      marginTop: 18,
      backgroundColor: colors.accent,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 999,
    },
    emptyBtnText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 14,
    },

    errorBox: {
      margin: 16,
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
