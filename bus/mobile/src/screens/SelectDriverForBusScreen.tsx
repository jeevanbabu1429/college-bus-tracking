import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeBusesApi } from "../api/collegeBuses";
import { collegeDriversApi, type Driver } from "../api/collegeDrivers";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "SelectDriverForBus">;

export function SelectDriverForBusScreen({ navigation, route }: Props) {
  const { collegeId, busId, busNumber, plateNumber, currentDriverId } =
    route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    collegeDriversApi
      .list(collegeId)
      .then(setDrivers)
      .catch((e: Error) => setError(e.message));
  }, [collegeId]);

  async function assign(driverId: string | null) {
    setError(null);
    setBusy(true);
    try {
      await collegeBusesApi.assignDriver(collegeId, busId, driverId);
      Alert.alert(
        driverId ? "Driver assigned" : "Driver unassigned",
        driverId
          ? `Driver assigned to Bus ${busNumber}.`
          : `Bus ${busNumber} is now unassigned.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
          disabled={busy}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Select Driver</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {drivers && (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContent,
            drivers.length === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={styles.busCard}>
                <View style={styles.busHeaderRow}>
                  <Text style={styles.busLabel}>Bus</Text>
                </View>
                <Text style={styles.busNumber}>Bus {busNumber}</Text>
                <Text style={styles.busPlate}>{plateNumber}</Text>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorIcon}>!</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {busy && (
                <ActivityIndicator
                  color={colors.accent}
                  style={{ marginTop: 16, marginBottom: 8 }}
                />
              )}

              <Text style={styles.sectionLabel}>Drivers</Text>

              {currentDriverId !== null && (
                <Pressable
                  style={({ pressed }) => [
                    styles.unassignCard,
                    pressed && styles.unassignCardPressed,
                  ]}
                  onPress={() => assign(null)}
                  disabled={busy}
                >
                  <View style={styles.unassignIcon}>
                    <Text style={styles.unassignIconText}>×</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unassignTitle}>
                      Unassign current driver
                    </Text>
                    <Text style={styles.unassignSub}>
                      Bus {busNumber} will have no driver.
                    </Text>
                  </View>
                </Pressable>
              )}
            </>
          }
          renderItem={({ item }) => {
            const isCurrent = item._id === currentDriverId;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.driverCard,
                  isCurrent && styles.driverCardCurrent,
                  pressed && !isCurrent && styles.driverCardPressed,
                ]}
                onPress={() => assign(item._id)}
                disabled={busy || isCurrent}
              >
                <View
                  style={[styles.avatar, isCurrent && styles.avatarCurrent]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      isCurrent && styles.avatarTextCurrent,
                    ]}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.driverName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isCurrent && (
                      <View style={styles.currentTag}>
                        <Text style={styles.currentTagText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaIcon}>📱</Text>
                      <Text style={styles.metaText}>{item.mobile}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaIcon}>🪪</Text>
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.licenceNumber}
                      </Text>
                    </View>
                  </View>
                </View>
                {!isCurrent && <Text style={styles.chevron}>›</Text>}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🪪</Text>
              <Text style={styles.emptyTitle}>No drivers yet</Text>
              <Text style={styles.emptyBody}>
                Add drivers to this college first, then come back to assign.
              </Text>
            </View>
          }
        />
      )}

      {!drivers && !error && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
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

    busCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 20,
      padding: 18,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    busHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    busLabel: {
      color: colors.statsLabel,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    busNumber: {
      color: "#fff",
      fontSize: 26,
      fontWeight: "800",
      marginTop: 10,
    },
    busPlate: { color: colors.accent, fontWeight: "700", marginTop: 2 },

    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: 22,
      marginBottom: 10,
      paddingHorizontal: 4,
    },

    unassignCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: "rgba(192,57,43,0.06)",
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "rgba(192,57,43,0.25)",
      padding: 14,
      marginBottom: 12,
    },
    unassignCardPressed: { backgroundColor: "rgba(192,57,43,0.12)" },
    unassignIcon: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    unassignIconText: {
      color: "#fff",
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 24,
    },
    unassignTitle: { fontSize: 15, fontWeight: "800", color: colors.danger },
    unassignSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    driverCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: "transparent",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    driverCardPressed: { backgroundColor: colors.surfaceMuted },
    driverCardCurrent: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarCurrent: { backgroundColor: colors.accent },
    avatarText: {
      color: colors.textMuted,
      fontWeight: "800",
      fontSize: 20,
    },
    avatarTextCurrent: { color: colors.textOnAccent },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    driverName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    currentTag: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    currentTagText: {
      color: colors.textOnAccent,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    metaRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 6,
      flexWrap: "wrap",
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaIcon: { fontSize: 12 },
    metaText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
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
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: "rgba(192,57,43,0.08)",
      borderWidth: 1,
      borderColor: "rgba(192,57,43,0.2)",
    },
    errorIcon: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.danger,
      color: "#fff",
      textAlign: "center",
      lineHeight: 22,
      fontSize: 13,
      fontWeight: "800",
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
  });
}
