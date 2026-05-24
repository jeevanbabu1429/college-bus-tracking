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
import * as Location from "expo-location";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { driverTripApi, type TripStatus } from "../api/driverTrip";

type Tab = "home" | "profile";
type Styles = ReturnType<typeof makeStyles>;

export function DriverDashboardScreen() {
  const { session, logout } = useAuth();
  const driver = session?.role === "driver" ? session.driver : null;
  const { mode, colors, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState<TripStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSent, setLastSent] = useState<{
    lat: number;
    lng: number;
    at: number;
  } | null>(null);

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const sendingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    setError(null);
    try {
      const s = await driverTripApi.status();
      setStatus(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const stopWatching = useCallback(() => {
    watcherRef.current?.remove();
    watcherRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  const startWatching = useCallback(async () => {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (loc) => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        try {
          await driverTripApi.sendLocation(
            loc.coords.latitude,
            loc.coords.longitude
          );
          setLastSent({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            at: Date.now(),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          sendingRef.current = false;
        }
      }
    );
    watcherRef.current = sub;
  }, []);

  const handleStart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "We need your location to share the bus position with students."
        );
        setBusy(false);
        return;
      }
      await driverTripApi.start();
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      try {
        await driverTripApi.sendLocation(
          current.coords.latitude,
          current.coords.longitude
        );
        setLastSent({
          lat: current.coords.latitude,
          lng: current.coords.longitude,
          at: Date.now(),
        });
      } catch {
        // initial push failure is non-fatal; watcher will retry
      }
      await startWatching();
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, startWatching, loadStatus]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      stopWatching();
      await driverTripApi.stop();
      await loadStatus();
      setLastSent(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, stopWatching, loadStatus]);

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
            {(driver?.name ?? "D").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle} numberOfLines={1}>
            {tab === "home" ? `Hi, ${driver?.name ?? "Driver"}` : "Profile"}
          </Text>
          {tab === "home" && driver && (
            <Text style={styles.appSubtitle}>{driver.mobile}</Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {tab === "home" ? (
        <HomeView
          styles={styles}
          colors={colors}
          loading={loading}
          status={status}
          busy={busy}
          error={error}
          lastSent={lastSent}
          onStart={handleStart}
          onStop={handleStop}
        />
      ) : (
        <ProfileView
          styles={styles}
          colors={colors}
          mode={mode}
          setMode={setMode}
          driver={driver}
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

type Driver = NonNullable<
  Extract<ReturnType<typeof useAuth>["session"], { role: "driver" }>
>["driver"];

type HomeViewProps = {
  styles: Styles;
  colors: Colors;
  loading: boolean;
  status: TripStatus | null;
  busy: boolean;
  error: string | null;
  lastSent: { lat: number; lng: number; at: number } | null;
  onStart: () => void;
  onStop: () => void;
};

function HomeView({
  styles,
  colors,
  loading,
  status,
  busy,
  error,
  lastSent,
  onStart,
  onStop,
}: HomeViewProps) {
  const tripActive = status?.tripActive ?? false;
  const bus = status?.bus ?? null;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : bus ? (
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
          {bus.route ? (
            <View style={styles.busRouteRow}>
              <Text style={styles.busRouteLabel}>Route</Text>
              <Text style={styles.busRouteValue} numberOfLines={2}>
                {bus.route}
              </Text>
            </View>
          ) : (
            <Text style={styles.busRouteMuted}>No route set</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No bus assigned</Text>
          <Text style={styles.emptyBody}>
            You haven't been assigned to a bus yet. Please check with the
            admin.
          </Text>
        </View>
      )}

      {bus && bus.notice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>⚠️</Text>
          <Text style={styles.noticeText}>{bus.notice}</Text>
        </View>
      ) : null}

      {bus && (
        <>
          <Text style={styles.sectionLabel}>Trip Control</Text>
          <View style={styles.tripCard}>
            <Text style={styles.tripStatusBig}>
              {tripActive ? "Trip is active" : "Ready to start"}
            </Text>
            <Text style={styles.tripStatusSub}>
              {tripActive
                ? "Sharing your live location with students."
                : "Tap Start to begin sharing your live location."}
            </Text>
            {lastSent && tripActive && (
              <View style={styles.lastSentRow}>
                <View style={styles.liveDot} />
                <Text style={styles.lastSentText}>
                  Last update {lastSent.lat.toFixed(5)},{" "}
                  {lastSent.lng.toFixed(5)}
                </Text>
              </View>
            )}
            {busy ? (
              <ActivityIndicator
                color={colors.textOnAccent}
                style={{ marginTop: 16 }}
              />
            ) : tripActive ? (
              <Pressable
                onPress={onStop}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.bigBtnStop,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <Text style={styles.bigBtnText}>Stop Trip</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onStart}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.bigBtnStart,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <Text style={styles.bigBtnTextDark}>Start Trip</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.sectionLabel}>Route stops</Text>
          {bus.stops.length > 0 ? (
            <View style={styles.stopsCard}>
              {bus.stops.map((s, i) => (
                <View
                  key={`${s.name}-${i}`}
                  style={[
                    styles.stopRow,
                    i < bus.stops.length - 1 && styles.stopRowDivider,
                    s.suspended && { opacity: 0.55 },
                  ]}
                >
                  <View
                    style={[
                      styles.stopBullet,
                      s.suspended && styles.stopBulletSuspended,
                    ]}
                  >
                    <Text style={styles.stopBulletText}>{i + 1}</Text>
                  </View>
                  <Text
                    style={[
                      styles.stopText,
                      s.suspended && styles.stopTextSuspended,
                    ]}
                  >
                    {s.name}
                    {s.suspended ? "  (closed)" : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyBody}>No stops on this route yet.</Text>
            </View>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

type ProfileViewProps = {
  styles: Styles;
  colors: Colors;
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => Promise<void>;
  driver: Driver | null;
  onLogout: () => void;
};

function ProfileView({
  styles,
  colors,
  mode,
  setMode,
  driver,
  onLogout,
}: ProfileViewProps) {
  const formatDob = (value: string | undefined) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(driver?.name ?? "D").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{driver?.name ?? "Driver"}</Text>
          <Text style={styles.profileRole}>
            Driver · {driver?.mobile ?? "—"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Personal Details</Text>
      <View style={styles.groupCard}>
        <InfoRow
          styles={styles}
          icon="🎂"
          label="Date of birth"
          value={formatDob(driver?.dob as unknown as string | undefined)}
        />
        <InfoRow
          styles={styles}
          icon="⚧"
          label="Gender"
          value={driver?.gender ?? "—"}
          capitalize
        />
        <InfoRow
          styles={styles}
          icon="🪪"
          label="Licence"
          value={driver?.licenceNumber ?? "—"}
        />
        <InfoRow
          styles={styles}
          icon="🆔"
          label="Aadhar"
          value={driver?.aadharNumber ?? "—"}
        />
        <InfoRow
          styles={styles}
          icon="🏠"
          label="Address"
          value={driver?.address ?? "—"}
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
  capitalize,
}: {
  styles: Styles;
  icon: string;
  label: string;
  value: string;
  isLast?: boolean;
  capitalize?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowSublabel}>{label}</Text>
        <Text
          style={[
            styles.rowLabel,
            capitalize && { textTransform: "capitalize" },
          ]}
        >
          {value}
        </Text>
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
    busRouteRow: {
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 12,
      padding: 12,
    },
    busRouteLabel: {
      color: colors.statsLabel,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    busRouteValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
    busRouteMuted: {
      color: "#a3651b",
      marginTop: 14,
      fontSize: 13,
      fontWeight: "600",
    },

    noticeCard: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: "#fff4e5",
      borderWidth: 1,
      borderColor: "#f0c98a",
      borderRadius: 14,
      padding: 14,
      marginTop: 16,
    },
    noticeIcon: { fontSize: 16 },
    noticeText: {
      flex: 1,
      color: "#92400e",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
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

    tripCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    tripStatusBig: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    tripStatusSub: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 6,
    },
    lastSentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    lastSentText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    bigBtn: {
      marginTop: 22,
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 999,
      alignItems: "center",
      width: "100%",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    bigBtnStart: { backgroundColor: colors.accent, shadowColor: colors.accent },
    bigBtnStop: { backgroundColor: colors.danger, shadowColor: colors.danger },
    bigBtnPressed: { opacity: 0.9 },
    bigBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
    bigBtnTextDark: { color: "#111", fontSize: 17, fontWeight: "800" },

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

    error: {
      color: colors.danger,
      marginTop: 16,
      textAlign: "center",
      fontWeight: "600",
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
    stopRowDivider: { borderBottomWidth: 1, borderColor: colors.border },
    stopBullet: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stopBulletSuspended: { backgroundColor: "rgba(217,83,79,0.2)" },
    stopBulletText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
    stopText: { fontSize: 14, color: colors.text, flex: 1, fontWeight: "600" },
    stopTextSuspended: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
      fontWeight: "600",
    },

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
