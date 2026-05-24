import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { studentAuthApi, type BusLocation } from "../api/studentAuth";

const POLL_INTERVAL_MS = 5000;
type Tab = "home" | "profile";
type Styles = ReturnType<typeof makeStyles>;

export function StudentDashboardScreen() {
  const { session, refreshSession, logout } = useAuth();
  const student = session?.role === "student" ? session.student : null;
  const { mode, colors, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>("home");
  const [busLocation, setBusLocation] = useState<BusLocation | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const fetchLocation = useCallback(async () => {
    try {
      const data = await studentAuthApi.busLocation();
      setBusLocation(data);
    } catch {
      // ignore transient errors so the UI doesn't flicker
    }
  }, []);

  useEffect(() => {
    if (!student?.bus) return;
    fetchLocation();
    pollingRef.current = setInterval(fetchLocation, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [student?.bus, fetchLocation]);

  const onLogout = () =>
    Alert.alert(
      "Logout?",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => logout() },
      ],
      { cancelable: true }
    );

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(student?.name ?? "S").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle} numberOfLines={1}>
            {tab === "home"
              ? `Hi, ${student?.name ?? "Student"}`
              : "Profile"}
          </Text>
          {tab === "home" && student && (
            <Text style={styles.appSubtitle}>Roll · {student.rollNumber}</Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {tab === "home" ? (
        <HomeView
          styles={styles}
          colors={colors}
          student={student}
          busLocation={busLocation}
        />
      ) : (
        <ProfileView
          styles={styles}
          colors={colors}
          mode={mode}
          setMode={setMode}
          student={student}
          onLogout={onLogout}
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

type Student = NonNullable<
  Extract<ReturnType<typeof useAuth>["session"], { role: "student" }>
>["student"];

type HomeViewProps = {
  styles: Styles;
  colors: Colors;
  student: Student | null;
  busLocation: BusLocation | null;
};

function HomeView({ styles, colors, student, busLocation }: HomeViewProps) {
  const bus = student?.bus ?? null;
  const stops = bus?.stops ?? [];
  const tripActive = busLocation?.tripActive ?? false;
  const liveLoc = busLocation?.currentLocation ?? null;

  const mapRef = useRef<MapView | null>(null);
  const [pinPos, setPinPos] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const fromRef = useRef<{ lat: number; lng: number } | null>(null);
  const toRef = useRef<{ lat: number; lng: number } | null>(null);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!liveLoc) return;
    const target = { lat: liveLoc.lat, lng: liveLoc.lng };

    if (!pinPos) {
      setPinPos(target);
      return;
    }
    if (pinPos.lat === target.lat && pinPos.lng === target.lng) return;

    fromRef.current = pinPos;
    toRef.current = target;
    startRef.current = Date.now();

    const DURATION = 1000;
    const tick = () => {
      if (!fromRef.current || !toRef.current) return;
      const elapsed = Date.now() - startRef.current;
      const t = Math.min(1, elapsed / DURATION);
      const ease = 1 - Math.pow(1 - t, 3);
      const lat =
        fromRef.current.lat +
        (toRef.current.lat - fromRef.current.lat) * ease;
      const lng =
        fromRef.current.lng +
        (toRef.current.lng - fromRef.current.lng) * ease;
      setPinPos({ lat, lng });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    mapRef.current?.animateToRegion(
      {
        latitude: target.lat,
        longitude: target.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [liveLoc?.lat, liveLoc?.lng, liveLoc?.updatedAt]);

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      showsVerticalScrollIndicator={false}
    >
      {bus ? (
        <View style={styles.busCard}>
          <View style={styles.busHeaderRow}>
            <Text style={styles.busLabel}>Your Bus</Text>
            <View
              style={[
                styles.statusPill,
                tripActive && styles.statusPillActive,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  tripActive && styles.statusDotActive,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  tripActive && styles.statusTextActive,
                ]}
              >
                {tripActive ? "On trip" : "Idle"}
              </Text>
            </View>
          </View>
          <Text style={styles.busNumber}>Bus {bus.busNumber}</Text>
          <Text style={styles.busPlate}>{bus.plateNumber}</Text>
          <View style={styles.busMetaRow}>
            <View style={styles.busMetaCell}>
              <Text style={styles.busMetaLabel}>Capacity</Text>
              <Text style={styles.busMetaValue}>{bus.capacity}</Text>
            </View>
            <View style={styles.busMetaDivider} />
            <View style={styles.busMetaCell}>
              <Text style={styles.busMetaLabel}>Stops</Text>
              <Text style={styles.busMetaValue}>{stops.length}</Text>
            </View>
            <View style={styles.busMetaDivider} />
            <View style={styles.busMetaCell}>
              <Text style={styles.busMetaLabel}>Route</Text>
              <Text style={styles.busMetaValueSmall} numberOfLines={1}>
                {bus.route || "—"}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No bus assigned</Text>
          <Text style={styles.emptyBody}>
            You haven't been assigned to a bus yet. Please check with your
            college admin.
          </Text>
        </View>
      )}

      {bus && (
        <>
          <Text style={styles.sectionLabel}>Live Bus Location</Text>
          {tripActive && liveLoc && pinPos ? (
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: pinPos.lat,
                  longitude: pinPos.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: pinPos.lat,
                    longitude: pinPos.lng,
                  }}
                  title={`Bus ${bus.busNumber}`}
                  description={`Updated ${new Date(liveLoc.updatedAt).toLocaleTimeString()}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                  flat
                >
                  <View style={styles.busPin}>
                    <View style={styles.busPinHalo} />
                    <View style={styles.busPinInner}>
                      <Text style={styles.busPinEmoji}>🚌</Text>
                    </View>
                  </View>
                </Marker>
              </MapView>
              <Pressable
                onPress={() =>
                  mapRef.current?.animateToRegion(
                    {
                      latitude: pinPos.lat,
                      longitude: pinPos.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    },
                    600
                  )
                }
                style={({ pressed }) => [
                  styles.recenterBtn,
                  pressed && styles.recenterBtnPressed,
                ]}
                hitSlop={8}
              >
                <Text style={styles.recenterIcon}>🚌</Text>
              </Pressable>
              <View style={styles.liveBanner}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  Live · updated{" "}
                  {new Date(liveLoc.updatedAt).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <ActivityIndicator
                color={colors.accent}
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptyBody}>
                {tripActive
                  ? "Waiting for the driver's first location update…"
                  : "The driver hasn't started the trip yet."}
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Your Stop</Text>
          {student?.stop ? (
            <View style={styles.myStopCard}>
              <View style={styles.myStopIcon}>
                <Text style={styles.myStopEmoji}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myStopHint}>You board at</Text>
                <Text style={styles.myStopName}>{student.stop}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyBody}>
                Stop not assigned yet. Please check with your admin.
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>All Stops</Text>
          {stops.length > 0 ? (
            <View style={styles.stopsCard}>
              {stops.map((s, i) => {
                const isMine = student?.stop === s;
                return (
                  <View
                    key={`${s}-${i}`}
                    style={[
                      styles.stopRow,
                      i < stops.length - 1 && styles.stopRowDivider,
                    ]}
                  >
                    <View
                      style={[
                        styles.stopBullet,
                        isMine && styles.stopBulletMine,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stopBulletText,
                          isMine && styles.stopBulletTextMine,
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </View>
                    <Text
                      style={[styles.stopText, isMine && styles.stopTextMine]}
                    >
                      {s}
                    </Text>
                    {isMine && (
                      <Text style={styles.youHere}>You board here</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyBody}>No stops added yet.</Text>
            </View>
          )}
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
  student: Student | null;
  onLogout: () => void;
};

function ProfileView({
  styles,
  colors,
  mode,
  setMode,
  student,
  onLogout,
}: ProfileViewProps) {
  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(student?.name ?? "S").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{student?.name ?? "Student"}</Text>
          <Text style={styles.profileRole}>
            Student · Roll {student?.rollNumber ?? "—"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Personal Details</Text>
      <View style={styles.groupCard}>
        <InfoRow
          styles={styles}
          icon="👤"
          label="Name"
          value={student?.name ?? "—"}
        />
        <InfoRow
          styles={styles}
          icon="🆔"
          label="Roll number"
          value={student?.rollNumber ?? "—"}
        />
        <InfoRow
          styles={styles}
          icon="📱"
          label="Mobile"
          value={student?.mobile ?? "—"}
        />
        <InfoRow
          styles={styles}
          icon="🏠"
          label="Address"
          value={student?.address ?? "—"}
          isLast
        />
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.groupCard}>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>{mode === "dark" ? "🌙" : "☀️"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Dark mode</Text>
            <Text style={styles.rowSublabel}>
              {mode === "dark" ? "On" : "Off"}
            </Text>
          </View>
          <Switch
            value={mode === "dark"}
            onValueChange={(v) => setMode(v ? "dark" : "light")}
            trackColor={{ false: "#d6d6d6", true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.groupCard}>
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
          ]}
        >
          <Text style={styles.rowIcon}>🚪</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, styles.rowLabelRed]}>Logout</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  styles,
  icon,
  label,
  value,
  isLast,
}: {
  styles: Styles;
  icon: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowSublabel}>{label}</Text>
        <Text style={styles.rowLabel}>{value}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    appBar: {
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.textOnAccent, fontWeight: "800", fontSize: 18 },
    appTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    appSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    body: { flex: 1 },
    bodyContent: { padding: 16, paddingBottom: 120 },

    busCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 24,
      padding: 20,
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
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 999,
    },
    statusPillActive: { backgroundColor: "rgba(245,183,0,0.2)" },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: "#7a7a80",
    },
    statusDotActive: { backgroundColor: colors.accent },
    statusText: { color: "#9aa0a6", fontSize: 11, fontWeight: "700" },
    statusTextActive: { color: colors.accent },
    busNumber: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 16 },
    busPlate: { color: colors.accent, fontWeight: "700", marginTop: 2 },
    busMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 14,
      padding: 12,
      marginTop: 18,
    },
    busMetaCell: { flex: 1, alignItems: "center" },
    busMetaLabel: {
      color: colors.statsLabel,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    busMetaValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 4 },
    busMetaValueSmall: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 4 },
    busMetaDivider: {
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

    mapCard: {
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    map: { width: "100%", height: 280 },
    busPin: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    busPinHalo: {
      position: "absolute",
      width: 56,
      height: 56,
      borderRadius: 999,
      backgroundColor: "rgba(245,183,0,0.25)",
    },
    busPinInner: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.accent,
      borderWidth: 3,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    busPinEmoji: { fontSize: 18 },
    recenterBtn: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    recenterBtnPressed: { opacity: 0.85 },
    recenterIcon: { fontSize: 20 },
    liveBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    liveText: { color: colors.text, fontSize: 12, fontWeight: "700" },

    emptyCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 18,
      padding: 20,
      alignItems: "center",
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
    },

    myStopCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.accent,
      borderRadius: 18,
      padding: 16,
    },
    myStopIcon: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    myStopEmoji: { fontSize: 22 },
    myStopHint: {
      color: "rgba(0,0,0,0.6)",
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    myStopName: {
      color: "#111",
      fontSize: 22,
      fontWeight: "800",
      marginTop: 2,
    },

    stopsCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 4,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
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
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stopBulletMine: { backgroundColor: colors.accent },
    stopBulletText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    stopBulletTextMine: { color: colors.textOnAccent },
    stopText: { fontSize: 14, color: colors.text, flex: 1, fontWeight: "600" },
    stopTextMine: { color: colors.accent, fontWeight: "800" },
    youHere: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    profileAvatar: {
      width: 56,
      height: 56,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    profileAvatarText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 22,
    },
    profileName: { fontSize: 18, fontWeight: "700", color: colors.text },
    profileRole: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

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
    rowLabel: { fontSize: 16, color: colors.text, fontWeight: "700" },
    rowLabelRed: { color: colors.danger },
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

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
    tabLabel: {
      color: colors.bottomBarInactive,
      fontWeight: "700",
      fontSize: 13,
    },
    tabLabelActive: { color: colors.textOnAccent },
  });
}
