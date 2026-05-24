import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeStudentsApi, type Student } from "../api/collegeStudents";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "SelectStudentsForBus">;

type Filter = "all" | "unassigned" | "onThis" | "onOther";

const FILTERS: Array<[Filter, string]> = [
  ["all", "All"],
  ["unassigned", "Unassigned"],
  ["onThis", "On this bus"],
  ["onOther", "On other bus"],
];

export function SelectStudentsForBusScreen({ navigation, route }: Props) {
  const {
    collegeId,
    busId,
    busNumber,
    plateNumber,
    capacity,
    route: busRouteName,
    stops,
  } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [students, setStudents] = useState<Student[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pickStopFor, setPickStopFor] = useState<Student | null>(null);

  const reload = useCallback(() => {
    return collegeStudentsApi.list(collegeId).then(setStudents);
  }, [collegeId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      collegeStudentsApi
        .list(collegeId)
        .then((list) => {
          if (!cancelled) setStudents(list);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, [collegeId])
  );

  const taken = students?.filter((s) => s.bus?._id === busId).length ?? 0;
  const remaining = capacity - taken;
  const full = remaining <= 0;

  const stateOf = useCallback(
    (s: Student): Exclude<Filter, "all"> =>
      s.bus?._id === busId
        ? "onThis"
        : s.bus
        ? "onOther"
        : "unassigned",
    [busId]
  );

  const visible = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    const rank: Record<Exclude<Filter, "all">, number> = {
      onThis: 0,
      unassigned: 1,
      onOther: 2,
    };
    return students
      .filter((s) => filter === "all" || stateOf(s) === filter)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const sa = rank[stateOf(a)];
        const sb = rank[stateOf(b)];
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
  }, [students, query, filter, stateOf]);

  async function assign(student: Student, stop: string | null) {
    setError(null);
    setPendingId(student._id);
    setPickStopFor(null);
    try {
      await collegeStudentsApi.assignBus(
        collegeId,
        student._id,
        busId,
        stop
      );
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  async function remove(student: Student) {
    setError(null);
    setPendingId(student._id);
    try {
      await collegeStudentsApi.assignBus(collegeId, student._id, null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  function onTapRow(student: Student) {
    const onThisBus = student.bus?._id === busId;
    if (onThisBus) {
      remove(student);
      return;
    }
    if (stops.length === 0) {
      assign(student, null);
      return;
    }
    setPickStopFor(student);
  }

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
          disabled={pendingId !== null}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Select Students</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          visible.length === 0 && students && styles.emptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={styles.busCard}>
              <View style={styles.busHeaderRow}>
                <Text style={styles.busLabel}>Bus</Text>
                <View
                  style={[
                    styles.seatBadge,
                    full && styles.seatBadgeFull,
                  ]}
                >
                  <Text
                    style={[
                      styles.seatNum,
                      full && styles.seatNumFull,
                    ]}
                  >
                    {Math.max(0, remaining)}
                  </Text>
                  <Text
                    style={[
                      styles.seatLabel,
                      full && styles.seatLabelFull,
                    ]}
                  >
                    {full ? "FULL" : "left"}
                  </Text>
                </View>
              </View>
              <Text style={styles.busNumber}>Bus {busNumber}</Text>
              <Text style={styles.busPlate}>{plateNumber}</Text>
              {busRouteName ? (
                <View style={styles.routeRow}>
                  <Text style={styles.routeIcon}>🛣️</Text>
                  <Text style={styles.routeName} numberOfLines={2}>
                    {busRouteName}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.capacityLine}>
                {taken} of {capacity} seats taken
              </Text>
            </View>

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or roll"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
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

            <View style={styles.chips}>
              {FILTERS.map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[styles.chip, filter === key && styles.chipActive]}
                  onPress={() => setFilter(key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filter === key && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!students && !error && (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 32 }}
              />
            )}
          </>
        }
        renderItem={({ item }) => {
          const onThisBus = item.bus?._id === busId;
          const onOtherBus = !!item.bus && !onThisBus;
          const disableTap =
            pendingId !== null || (full && !onThisBus);
          const action = onThisBus
            ? "Remove"
            : onOtherBus
            ? "Move here"
            : "Add";

          const stateBadge = onThisBus
            ? styles.stateOnThis
            : onOtherBus
            ? styles.stateOnOther
            : styles.stateUnassigned;
          const stateBadgeText = onThisBus
            ? styles.stateOnThisText
            : onOtherBus
            ? styles.stateOnOtherText
            : styles.stateUnassignedText;
          const stateLabel = onThisBus
            ? "On this"
            : onOtherBus
            ? `Bus ${item.bus?.busNumber}`
            : "Open";

          return (
            <Pressable
              style={({ pressed }) => [
                styles.studentCard,
                onThisBus && styles.studentCardSelected,
                pressed && !disableTap && styles.studentCardPressed,
              ]}
              onPress={() => onTapRow(item)}
              disabled={disableTap}
            >
              <View
                style={[styles.avatar, onThisBus && styles.avatarSelected]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    onThisBus && styles.avatarTextSelected,
                  ]}
                >
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHeader}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.rollChip}>
                    <Text style={styles.rollChipText}>{item.rollNumber}</Text>
                  </View>
                </View>
                <View style={styles.subRow}>
                  <View style={[styles.stateBadge, stateBadge]}>
                    <Text style={[styles.stateBadgeText, stateBadgeText]}>
                      {stateLabel}
                    </Text>
                  </View>
                  {onThisBus && item.stop && (
                    <Text style={styles.stopText}>· {item.stop}</Text>
                  )}
                  {onThisBus && !item.stop && (
                    <Text style={styles.stopMuted}>· no stop</Text>
                  )}
                </View>
              </View>
              {pendingId === item._id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <View
                  style={[
                    styles.action,
                    onThisBus
                      ? styles.actionRemove
                      : disableTap
                      ? styles.actionDisabled
                      : styles.actionAdd,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      onThisBus && styles.actionRemoveText,
                      disableTap &&
                        !onThisBus &&
                        styles.actionDisabledText,
                      !onThisBus &&
                        !disableTap &&
                        styles.actionAddText,
                    ]}
                  >
                    {action}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          students ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎓</Text>
              <Text style={styles.emptyTitle}>
                {students.length === 0 ? "No students yet" : "No matches"}
              </Text>
              <Text style={styles.emptyBody}>
                {students.length === 0
                  ? "Add students to this college first."
                  : "Try a different search or filter."}
              </Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={pickStopFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickStopFor(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPickStopFor(null)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Pick a stop for {pickStopFor?.name}
            </Text>
            {busRouteName ? (
              <View style={styles.sheetRouteChip}>
                <Text style={styles.sheetRouteIcon}>🛣️</Text>
                <Text style={styles.sheetRouteText} numberOfLines={1}>
                  {busRouteName}
                </Text>
              </View>
            ) : null}
            <View style={styles.stopList}>
              {stops.map((s, i) => (
                <Pressable
                  key={`${s}-${i}`}
                  style={({ pressed }) => [
                    styles.stopRow,
                    pressed && styles.stopRowPressed,
                  ]}
                  onPress={() => pickStopFor && assign(pickStopFor, s)}
                >
                  <View style={styles.stopBullet}>
                    <Text style={styles.stopBulletText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stopRowText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.cancelBtnPressed,
              ]}
              onPress={() => setPickStopFor(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

    listContent: { padding: 16, paddingBottom: 40 },
    emptyContent: { flexGrow: 1, justifyContent: "center" },

    busCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 20,
      padding: 18,
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
    seatBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(245,183,0,0.2)",
    },
    seatBadgeFull: { backgroundColor: "rgba(192,57,43,0.25)" },
    seatNum: { color: colors.accent, fontSize: 16, fontWeight: "800" },
    seatNumFull: { color: colors.danger },
    seatLabel: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    seatLabelFull: { color: colors.danger },

    busNumber: {
      color: "#fff",
      fontSize: 26,
      fontWeight: "800",
      marginTop: 12,
    },
    busPlate: { color: colors.accent, fontWeight: "700", marginTop: 2 },
    routeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      backgroundColor: "rgba(255,255,255,0.05)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    routeIcon: { fontSize: 12 },
    routeName: { color: "#fff", fontSize: 12, fontWeight: "700" },
    capacityLine: {
      color: colors.statsLabel,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 8,
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
      marginTop: 14,
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

    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
      marginBottom: 6,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: colors.textOnAccent },

    studentCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      marginTop: 10,
      borderWidth: 1.5,
      borderColor: "transparent",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    studentCardPressed: { backgroundColor: colors.surfaceMuted },
    studentCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSelected: { backgroundColor: colors.accent },
    avatarText: {
      color: colors.textMuted,
      fontWeight: "800",
      fontSize: 18,
    },
    avatarTextSelected: { color: colors.textOnAccent },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    studentName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
    rollChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    rollChipText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    subRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      flexWrap: "wrap",
    },
    stateBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    stateBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    stateOnThis: { backgroundColor: colors.accent },
    stateOnThisText: { color: colors.textOnAccent },
    stateOnOther: { backgroundColor: "rgba(192,57,43,0.12)" },
    stateOnOtherText: { color: colors.danger },
    stateUnassigned: { backgroundColor: colors.surfaceMuted },
    stateUnassignedText: { color: colors.textMuted },
    stopText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    stopMuted: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },

    action: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      minWidth: 84,
      alignItems: "center",
    },
    actionAdd: { backgroundColor: colors.accent },
    actionAddText: { color: colors.textOnAccent },
    actionRemove: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    actionRemoveText: { color: colors.danger },
    actionDisabled: { backgroundColor: colors.surfaceMuted },
    actionDisabledText: { color: colors.textMuted },
    actionText: { fontSize: 12, fontWeight: "800" },

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

    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 40,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    sheetRouteChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
      marginTop: 8,
    },
    sheetRouteIcon: { fontSize: 12 },
    sheetRouteText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    stopList: { gap: 8, marginTop: 16 },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    stopRowPressed: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    stopBullet: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    stopBulletText: {
      color: colors.textOnAccent,
      fontSize: 11,
      fontWeight: "800",
    },
    stopRowText: { fontSize: 14, color: colors.text, flex: 1, fontWeight: "700" },

    cancelBtn: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
    },
    cancelBtnPressed: { backgroundColor: colors.surfaceContrast },
    cancelText: { color: colors.text, fontWeight: "800" },
  });
}
