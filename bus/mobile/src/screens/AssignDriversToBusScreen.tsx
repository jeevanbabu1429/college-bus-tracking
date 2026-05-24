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

type Props = NativeStackScreenProps<AppStackParamList, "AssignDriversToBus">;

export function AssignDriversToBusScreen({ navigation, route }: Props) {
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

  const total = buses?.length ?? 0;
  const withDriver = buses?.filter((b) => b.driver).length ?? 0;
  const without = total - withDriver;

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
          <Text style={styles.appTitle}>Assign Drivers</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!buses && !error && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
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
              <>
                <Text style={styles.heading}>Tap a bus to pick its driver</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryChip}>
                    <Text style={styles.summaryNum}>{total}</Text>
                    <Text style={styles.summaryLabel}>Total</Text>
                  </View>
                  <View style={styles.summaryChip}>
                    <Text style={styles.summaryNum}>{withDriver}</Text>
                    <Text style={styles.summaryLabel}>Assigned</Text>
                  </View>
                  <View style={styles.summaryChip}>
                    <Text style={styles.summaryNum}>{without}</Text>
                    <Text style={styles.summaryLabel}>Open</Text>
                  </View>
                </View>
              </>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.busCard,
                pressed && styles.busCardPressed,
              ]}
              onPress={() =>
                navigation.navigate("SelectDriverForBus", {
                  collegeId,
                  busId: item._id,
                  busNumber: item.busNumber,
                  plateNumber: item.plateNumber,
                  currentDriverId: item.driver?._id ?? null,
                })
              }
            >
              <View style={styles.badge}>
                <Text style={styles.badgeNumber}>{item.busNumber}</Text>
                <Text style={styles.badgeLabel}>BUS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.plate}>{item.plateNumber}</Text>
                {item.driver ? (
                  <View style={styles.driverChip}>
                    <View style={styles.driverDot} />
                    <Text style={styles.driverChipText} numberOfLines={1}>
                      {item.driver.name}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.driverChipNone}>
                    <Text style={styles.driverChipNoneText}>
                      Tap to assign a driver
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🚌</Text>
              <Text style={styles.emptyTitle}>No buses yet</Text>
              <Text style={styles.emptyBody}>
                Add a bus first to start assigning drivers.
              </Text>
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

    listContent: { padding: 16, paddingBottom: 32 },
    emptyContent: { flexGrow: 1, justifyContent: "center" },

    heading: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "600",
      marginBottom: 12,
    },

    summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
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
      alignItems: "center",
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
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeNumber: {
      color: colors.textOnAccent,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 20,
    },
    badgeLabel: {
      color: "rgba(0,0,0,0.5)",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      marginTop: 2,
    },
    plate: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: 0.5,
    },
    driverChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
    },
    driverDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    driverChipText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    driverChipNone: {
      alignSelf: "flex-start",
      marginTop: 6,
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
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

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
