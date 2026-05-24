import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeDriversApi, type Driver } from "../api/collegeDrivers";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "ViewDrivers">;

export function ViewDriversScreen({ navigation, route }: Props) {
  const { collegeId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      collegeDriversApi
        .list(collegeId)
        .then((list) => {
          if (!cancelled) setDrivers(list);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, [collegeId])
  );

  const filtered = useMemo(() => {
    if (!drivers) return null;
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.mobile.toLowerCase().includes(q) ||
        d.licenceNumber.toLowerCase().includes(q)
    );
  }, [drivers, query]);

  const total = drivers?.length ?? 0;

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
          <Text style={styles.appTitle}>Drivers</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("AddDrivers", { collegeId })}
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

      {!drivers && !error && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      )}

      {drivers && (
        <FlatList
          data={filtered ?? []}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContent,
            (filtered?.length ?? 0) === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            drivers.length > 0 ? (
              <>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryNum}>{total}</Text>
                  <Text style={styles.summaryLabel}>
                    {total === 1 ? "Driver" : "Drivers"}
                  </Text>
                </View>
                <View style={styles.searchWrap}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by name, mobile, licence"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                  />
                  {query.length > 0 && (
                    <Pressable
                      onPress={() => setQuery("")}
                      hitSlop={8}
                      style={styles.clearBtn}
                    >
                      <Text style={styles.clearText}>×</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.driverCard,
                pressed && styles.driverCardPressed,
              ]}
              onPress={() =>
                navigation.navigate("EditDriver", {
                  collegeId,
                  driver: item,
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.driverName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.genderChip}>
                    <Text style={styles.genderChipText}>{item.gender}</Text>
                  </View>
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
                <Text style={styles.address} numberOfLines={1}>
                  📍 {item.address}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            drivers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🪪</Text>
                <Text style={styles.emptyTitle}>No drivers yet</Text>
                <Text style={styles.emptyBody}>
                  Add your first driver to start assigning buses.
                </Text>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() =>
                    navigation.navigate("AddDrivers", { collegeId })
                  }
                >
                  <Text style={styles.emptyBtnText}>+ Add Driver</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.noResults}>
                <Text style={styles.noResultsEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>
                  Try a different name, mobile, or licence number.
                </Text>
              </View>
            )
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

    summaryChip: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
      marginBottom: 14,
    },
    summaryNum: { fontSize: 14, fontWeight: "800", color: colors.accent },
    summaryLabel: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 14,
    },
    searchIcon: { fontSize: 14 },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 12,
    },
    clearBtn: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
    },
    clearText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 16,
    },

    driverCard: {
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
    driverCardPressed: { backgroundColor: colors.surfaceMuted },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 20,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    driverName: { fontSize: 16, fontWeight: "800", color: colors.text, flex: 1 },
    genderChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    genderChipText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 6,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaIcon: { fontSize: 12 },
    metaText: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    address: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
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

    noResults: { alignItems: "center", paddingVertical: 24 },
    noResultsEmoji: { fontSize: 36, marginBottom: 8 },

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
