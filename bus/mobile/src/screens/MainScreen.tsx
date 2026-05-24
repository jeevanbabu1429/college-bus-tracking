import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useColleges } from "../college/CollegeContext";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { collegesApi, type College } from "../api/colleges";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "Main">;
type Tab = "home" | "profile";
type Styles = ReturnType<typeof makeStyles>;

type ActionTo =
  | "AddBuses"
  | "AddDrivers"
  | "AddStudents"
  | "ViewBuses"
  | "ViewDrivers"
  | "ViewStudents"
  | "AssignDriversToBus"
  | "AssignStudentsToBus";

type Action = {
  label: string;
  emoji: string;
  bgLight: string;
  bgDark: string;
  to: ActionTo;
};

const ACTIONS: Action[] = [
  { label: "Add Buses", emoji: "🚌", bgLight: "#fff5cc", bgDark: "#3a2e00", to: "AddBuses" },
  { label: "View Buses", emoji: "🗂️", bgLight: "#fff5cc", bgDark: "#3a2e00", to: "ViewBuses" },
  { label: "Add Drivers", emoji: "👤", bgLight: "#e8e4ff", bgDark: "#2a2540", to: "AddDrivers" },
  { label: "View Drivers", emoji: "📋", bgLight: "#e8e4ff", bgDark: "#2a2540", to: "ViewDrivers" },
  { label: "Add Students", emoji: "🎓", bgLight: "#dbe7ff", bgDark: "#1f2a40", to: "AddStudents" },
  { label: "View Students", emoji: "📖", bgLight: "#dbe7ff", bgDark: "#1f2a40", to: "ViewStudents" },
  { label: "Assign Drivers", emoji: "🪪", bgLight: "#ffe8d9", bgDark: "#3a2418", to: "AssignDriversToBus" },
  { label: "Assign Students", emoji: "🚏", bgLight: "#ffe8d9", bgDark: "#3a2418", to: "AssignStudentsToBus" },
];

export function MainScreen({ navigation }: Props) {
  const { session, logout } = useAuth();
  const admin = session?.role === "admin" ? session.admin : null;
  const {
    colleges,
    selected,
    selectedId,
    selectCollege,
    refresh,
    loading,
    error,
  } = useColleges();
  const { mode, colors, setMode } = useTheme();
  const [tab, setTab] = useState<Tab>("home");

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDark = mode === "dark";

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(admin?.name ?? "A").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle} numberOfLines={1}>
            {tab === "home" ? selected?.name ?? "Bus" : "Settings"}
          </Text>
          {tab === "home" && selected && (
            <Text style={styles.appSubtitle}>{selected.code}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {tab === "home" ? (
        <HomeView
          styles={styles}
          colors={colors}
          isDark={isDark}
          loading={loading}
          colleges={colleges}
          selected={selected}
          onSwitch={() => setTab("profile")}
          onAddCollege={() => navigation.navigate("AddCollege")}
          onAction={(to) => {
            if (!selected) return;
            navigation.navigate(to, { collegeId: selected._id });
          }}
        />
      ) : (
        <ProfileView
          styles={styles}
          colors={colors}
          mode={mode}
          setMode={setMode}
          loading={loading}
          colleges={colleges}
          selectedId={selectedId}
          adminName={admin?.name}
          adminId={admin?.adminId}
          error={error}
          onSelectCollege={async (id) => {
            await selectCollege(id);
            setTab("home");
          }}
          onEditCollege={(c) => navigation.navigate("EditCollege", { college: c })}
          onAddCollege={() => navigation.navigate("AddCollege")}
          onEditAdmin={() => navigation.navigate("EditAdmin")}
          onClaimOrphans={async () => {
            try {
              const { claimed } = await collegesApi.claimOrphans();
              await refresh();
              Alert.alert(
                claimed > 0 ? "Recovered" : "Nothing to recover",
                claimed > 0
                  ? `${claimed} legacy ${
                      claimed === 1 ? "college" : "colleges"
                    } added to your account.`
                  : "No legacy colleges were found."
              );
            } catch (e) {
              Alert.alert("Recovery failed", (e as Error).message);
            }
          }}
          onLogout={() =>
            Alert.alert(
              "Logout?",
              "Are you sure you want to log out?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Logout",
                  style: "destructive",
                  onPress: () => {
                    logout();
                  },
                },
              ],
              { cancelable: true }
            )
          }
        />
      )}

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.tab, tab === "home" && styles.tabActive]}
          onPress={() => setTab("home")}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text
            style={[styles.tabLabel, tab === "home" && styles.tabLabelActive]}
          >
            Home
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "profile" && styles.tabActive]}
          onPress={() => setTab("profile")}
        >
          <Text style={styles.tabIcon}>👤</Text>
          <Text
            style={[
              styles.tabLabel,
              tab === "profile" && styles.tabLabelActive,
            ]}
          >
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type HomeViewProps = {
  styles: Styles;
  colors: Colors;
  isDark: boolean;
  loading: boolean;
  colleges: ReturnType<typeof useColleges>["colleges"];
  selected: ReturnType<typeof useColleges>["selected"];
  onSwitch: () => void;
  onAddCollege: () => void;
  onAction: (to: ActionTo) => void;
};

function HomeView({
  styles,
  colors,
  isDark,
  loading,
  colleges,
  selected,
  onSwitch,
  onAddCollege,
  onAction,
}: HomeViewProps) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.bodyContent, { paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Your Dashboard</Text>

      {loading && !colleges && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      )}

      {!loading && (!colleges || colleges.length === 0) && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No colleges yet</Text>
          <Text style={styles.emptyBody}>
            Create your first college to get started.
          </Text>
          <Pressable onPress={onAddCollege} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>+ Add College</Text>
          </Pressable>
        </View>
      )}

      {selected && (
        <>
          <View style={styles.statsCard}>
            <Text style={styles.statsHeading}>Overview</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <View style={styles.statIcon}>
                  <Text style={styles.statEmoji}>🚌</Text>
                </View>
                <Text style={styles.statBig}>{selected.actualBusCount}</Text>
                <Text style={styles.statSmall}>
                  of {selected.busCount} planned
                </Text>
                <Text style={styles.statLabel}>Buses</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <View style={styles.statIcon}>
                  <Text style={styles.statEmoji}>🪪</Text>
                </View>
                <Text style={styles.statBig}>
                  {selected.actualDriverCount}
                </Text>
                <Text style={styles.statSmall}>
                  of {selected.driverCount} planned
                </Text>
                <Text style={styles.statLabel}>Drivers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <View style={styles.statIcon}>
                  <Text style={styles.statEmoji}>🎓</Text>
                </View>
                <Text style={styles.statBig}>
                  {selected.actualStudentCount}
                </Text>
                <Text style={styles.statSmall}>enrolled</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <Pressable onPress={onSwitch} style={styles.viewAll}>
              <Text style={styles.viewAllText}>Switch college →</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {ACTIONS.map((a) => (
              <Pressable
                key={a.to}
                style={({ pressed }) => [
                  styles.gridItem,
                  pressed && styles.gridItemPressed,
                ]}
                onPress={() => onAction(a.to)}
              >
                <View
                  style={[
                    styles.gridIcon,
                    { backgroundColor: isDark ? a.bgDark : a.bgLight },
                  ]}
                >
                  <Text style={styles.gridEmoji}>{a.emoji}</Text>
                </View>
                <Text style={styles.gridLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

type ProfileViewProps = {
  styles: Styles;
  colors: Colors;
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => Promise<void>;
  loading: boolean;
  colleges: ReturnType<typeof useColleges>["colleges"];
  selectedId: string | null;
  adminName?: string;
  adminId?: string;
  error: string | null;
  onSelectCollege: (id: string) => Promise<void>;
  onEditCollege: (college: College) => void;
  onAddCollege: () => void;
  onEditAdmin: () => void;
  onClaimOrphans: () => Promise<void>;
  onLogout: () => Promise<void> | void;
};

type RowProps = {
  styles: Styles;
  colors: Colors;
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  onEdit?: () => void;
  rightChip?: { text: string; color: string };
  rightSlot?: React.ReactNode;
  isLast?: boolean;
  destructive?: boolean;
};

function Row({
  styles,
  colors,
  icon,
  label,
  sublabel,
  onPress,
  onEdit,
  rightChip,
  rightSlot,
  isLast,
  destructive,
}: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelRed]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {onEdit && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && styles.editBtnPressed,
          ]}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </Pressable>
      )}
      {rightSlot ? (
        rightSlot
      ) : rightChip ? (
        <View style={[styles.chip, { backgroundColor: rightChip.color }]}>
          <Text style={styles.chipText}>{rightChip.text}</Text>
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

function ProfileView({
  styles,
  colors,
  mode,
  setMode,
  loading,
  colleges,
  selectedId,
  adminName,
  adminId,
  error,
  onSelectCollege,
  onEditCollege,
  onAddCollege,
  onEditAdmin,
  onClaimOrphans,
  onLogout,
}: ProfileViewProps) {
  return (
    <ScrollView
      style={styles.profileScroll}
      contentContainerStyle={styles.profileContent}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={onEditAdmin}
        style={({ pressed }) => [
          styles.profileCard,
          pressed && styles.profileCardPressed,
        ]}
      >
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(adminName ?? "A").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{adminName ?? "Account"}</Text>
          <Text style={styles.profileRole}>
            {adminId ? `Admin · ID ${adminId}` : "Tap to edit profile"}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.groupLabel}>Appearance</Text>
      <View style={styles.groupCard}>
        <Row
          styles={styles}
          colors={colors}
          icon={mode === "dark" ? "🌙" : "☀️"}
          label="Dark mode"
          sublabel={mode === "dark" ? "On" : "Off"}
          rightSlot={
            <Switch
              value={mode === "dark"}
              onValueChange={(v) => setMode(v ? "dark" : "light")}
              trackColor={{ false: "#d6d6d6", true: colors.accent }}
              thumbColor="#fff"
            />
          }
          isLast
        />
      </View>

      <Text style={styles.groupLabel}>Colleges</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {loading && !colleges && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      )}

      {colleges && colleges.length > 0 && (
        <View style={styles.groupCard}>
          {colleges.map((c, idx) => {
            const isActive = c._id === selectedId;
            return (
              <Row
                key={c._id}
                styles={styles}
                colors={colors}
                icon="🏫"
                label={c.name}
                sublabel={c.code}
                rightChip={
                  isActive
                    ? { text: "Active", color: colors.accent }
                    : undefined
                }
                onPress={async () => {
                  if (isActive) return;
                  await onSelectCollege(c._id);
                }}
                onEdit={() => onEditCollege(c)}
                isLast={idx === colleges.length - 1}
              />
            );
          })}
        </View>
      )}

      {colleges && colleges.length === 0 && (
        <View style={styles.groupCard}>
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>
              No colleges yet. Tap "Add College" below.
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.groupCard, { marginTop: 12 }]}>
        <Row
          styles={styles}
          colors={colors}
          icon="➕"
          label="Add College"
          onPress={onAddCollege}
        />
        <Row
          styles={styles}
          colors={colors}
          icon="♻️"
          label="Recover legacy colleges"
          sublabel="Claim colleges created before per-admin scoping"
          onPress={onClaimOrphans}
          isLast
        />
      </View>

      <Text style={styles.groupLabel}>Account</Text>
      <View style={styles.groupCard}>
        <Row
          styles={styles}
          colors={colors}
          icon="🚪"
          label="Logout"
          onPress={onLogout}
          destructive
          isLast
        />
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    appBar: {
      paddingTop: 56,
      paddingBottom: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.textOnAccent, fontWeight: "800", fontSize: 16 },
    appTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    appSubtitle: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: "700",
      marginTop: 2,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnText: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 22,
      lineHeight: 24,
    },

    bodyContent: { padding: 20, backgroundColor: colors.background },
    heading: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 16,
    },
    emptyState: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 20,
      padding: 28,
      marginTop: 12,
    },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    emptyBody: { color: colors.textMuted, marginTop: 6, textAlign: "center" },
    emptyBtn: {
      marginTop: 16,
      backgroundColor: colors.accent,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 999,
    },
    emptyBtnText: { color: colors.textOnAccent, fontWeight: "700" },

    statsCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 24,
      paddingTop: 18,
      paddingBottom: 22,
      paddingHorizontal: 16,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    statsHeading: {
      color: colors.statsLabel,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    statsRow: { flexDirection: "row", alignItems: "center" },
    statCol: { flex: 1, alignItems: "center", paddingVertical: 4 },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: "rgba(245,183,0,0.15)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    statEmoji: { fontSize: 20 },
    statBig: { color: "#fff", fontSize: 28, fontWeight: "800" },
    statSmall: {
      color: colors.statsLabel,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    statLabel: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 8,
    },
    statDivider: {
      width: 1,
      height: 80,
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 28,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    viewAll: {
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    viewAllText: { color: colors.accent, fontWeight: "700", fontSize: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    gridItem: {
      width: "47.5%",
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: colors.border,
    },
    gridItemPressed: { backgroundColor: colors.surfaceMuted },
    gridIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    gridEmoji: { fontSize: 22 },
    gridLabel: { fontSize: 14, fontWeight: "700", color: colors.text },

    profileScroll: { flex: 1, backgroundColor: colors.background },
    profileContent: { padding: 16, paddingBottom: 120 },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    profileCardPressed: { opacity: 0.96 },
    profileAvatar: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    profileAvatarText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 18,
    },
    profileName: { fontSize: 16, fontWeight: "700", color: colors.text },
    profileRole: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    groupLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "600",
      paddingHorizontal: 4,
      marginTop: 24,
      marginBottom: 10,
    },
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    row: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginLeft: 50,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    rowIcon: { fontSize: 18, width: 24, textAlign: "center" },
    rowLabel: { fontSize: 16, color: colors.text, fontWeight: "600" },
    rowLabelRed: { color: colors.danger },
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    chipText: { color: colors.textOnAccent, fontWeight: "700", fontSize: 11 },
    editBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 4,
    },
    editBtnPressed: { backgroundColor: colors.surfaceMuted },
    editIcon: { fontSize: 14 },
    emptyRow: { paddingVertical: 18, paddingHorizontal: 20 },
    emptyText: { color: colors.textMuted, fontSize: 13 },
    error: { color: colors.danger, marginHorizontal: 20, marginTop: 8 },

    bottomBar: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 20,
      flexDirection: "row",
      backgroundColor: colors.bottomBarBg,
      borderRadius: 999,
      padding: 6,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
    },
    tabActive: { backgroundColor: colors.accent },
    tabIcon: { fontSize: 16 },
    tabLabel: { color: colors.bottomBarInactive, fontWeight: "700", fontSize: 13 },
    tabLabelActive: { color: colors.textOnAccent },
  });
}
