import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import {
  driverTripApi,
  type CurrentIssue,
  type IssueType,
  type TripStatus,
} from "../api/driverTrip";

const ISSUE_OPTIONS: { type: IssueType; emoji: string; label: string }[] = [
  { type: "breakdown", emoji: "🚨", label: "Breakdown" },
  { type: "flat_tyre", emoji: "🛞", label: "Flat tyre" },
  { type: "refuelling", emoji: "⛽", label: "Refuelling" },
  { type: "traffic", emoji: "🚦", label: "Traffic delay" },
  { type: "mechanical", emoji: "🔧", label: "Mechanical" },
  { type: "weather", emoji: "🌧️", label: "Weather" },
  { type: "other", emoji: "❓", label: "Other" },
];

function issueLabel(type: IssueType): string {
  return ISSUE_OPTIONS.find((o) => o.type === type)?.label ?? type;
}
function issueEmoji(type: IssueType): string {
  return ISSUE_OPTIONS.find((o) => o.type === type)?.emoji ?? "❗";
}

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

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueBusy, setIssueBusy] = useState(false);

  const handleReportIssue = useCallback(
    async (type: IssueType, message: string) => {
      setIssueBusy(true);
      setError(null);
      try {
        const res = await driverTripApi.reportIssue(type, message);
        setStatus((prev) =>
          prev ? { ...prev, currentIssue: res.currentIssue } : prev
        );
        setIssueModalOpen(false);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIssueBusy(false);
      }
    },
    []
  );

  const handleClearIssue = useCallback(async () => {
    setIssueBusy(true);
    setError(null);
    try {
      await driverTripApi.clearIssue();
      setStatus((prev) => (prev ? { ...prev, currentIssue: null } : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIssueBusy(false);
    }
  }, []);

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
          onOpenIssue={() => setIssueModalOpen(true)}
          onClearIssue={handleClearIssue}
          issueBusy={issueBusy}
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

      <IssueReportModal
        visible={issueModalOpen}
        busy={issueBusy}
        onCancel={() => setIssueModalOpen(false)}
        onReport={handleReportIssue}
      />
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
  onOpenIssue: () => void;
  onClearIssue: () => void;
  issueBusy: boolean;
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
  onOpenIssue,
  onClearIssue,
  issueBusy,
}: HomeViewProps) {
  const tripActive = status?.tripActive ?? false;
  const bus = status?.bus ?? null;
  const currentIssue = status?.currentIssue ?? null;

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

          <Text style={styles.sectionLabel}>Bus Condition</Text>
          {currentIssue ? (
            <View style={styles.issueActiveCard}>
              <View style={styles.issueHeaderRow}>
                <Text style={styles.issueEmoji}>
                  {issueEmoji(currentIssue.type)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueTypeLabel}>
                    {issueLabel(currentIssue.type)}
                  </Text>
                  <Text style={styles.issueAgo}>
                    Reported{" "}
                    {formatAgo(new Date(currentIssue.reportedAt).getTime())}
                  </Text>
                </View>
              </View>
              {currentIssue.message ? (
                <Text style={styles.issueMessage}>{currentIssue.message}</Text>
              ) : null}
              <Pressable
                onPress={onClearIssue}
                disabled={issueBusy}
                style={({ pressed }) => [
                  styles.issueClearBtn,
                  pressed && { opacity: 0.85 },
                  issueBusy && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.issueClearText}>
                  {issueBusy ? "Clearing…" : "Mark resolved"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onOpenIssue}
              style={({ pressed }) => [
                styles.issueReportBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.issueReportEmoji}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.issueReportTitle}>Report an issue</Text>
                <Text style={styles.issueReportSub}>
                  Breakdown, flat tyre, refuelling, etc.
                </Text>
              </View>
              <Text style={styles.chevron}></Text>
            </Pressable>
          )}

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

// Human-friendly relative time. Handles negatives + huge deltas.
function formatAgo(reportedMs: number): string {
  const diff = Math.max(0, Date.now() - reportedMs);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function IssueReportModal({
  visible,
  busy,
  onCancel,
  onReport,
}: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onReport: (type: IssueType, message: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<IssueType | null>(null);
  const [message, setMessage] = useState("");

  // Reset state when the modal closes.
  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setMessage("");
    }
  }, [visible]);

  const canReport = selected !== null && (selected !== "other" || message.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={reportStyles.backdrop}>
        <View style={reportStyles.sheet}>
          <View style={reportStyles.handle} />
          <Text style={reportStyles.title}>Report an issue</Text>
          <Text style={reportStyles.subtitle}>
            Let your students know what&apos;s going on with the bus.
          </Text>

          <View style={reportStyles.grid}>
            {ISSUE_OPTIONS.map((opt) => {
              const isSelected = selected === opt.type;
              return (
                <Pressable
                  key={opt.type}
                  onPress={() => setSelected(opt.type)}
                  style={({ pressed }) => [
                    reportStyles.option,
                    isSelected && reportStyles.optionSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={reportStyles.optionEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      reportStyles.optionLabel,
                      isSelected && reportStyles.optionLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={reportStyles.messageLabel}>
            Add a note{" "}
            {selected === "other" ? (
              <Text style={reportStyles.messageRequired}>(required)</Text>
            ) : (
              <Text style={reportStyles.messageOptional}>(optional)</Text>
            )}
          </Text>
          <TextInput
            style={reportStyles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="e.g. Back in 10 minutes"
            placeholderTextColor="#999"
            multiline
            maxLength={240}
            editable={!busy}
          />

          <View style={reportStyles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                reportStyles.cancelBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={reportStyles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                selected && onReport(selected, message.trim())
              }
              disabled={!canReport || busy}
              style={({ pressed }) => [
                reportStyles.submitBtn,
                (!canReport || busy) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={reportStyles.submitText}>
                {busy ? "Reporting…" : "Report issue"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const reportStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 30,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111" },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  option: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "#f5f5f7",
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  optionSelected: {
    backgroundColor: "#fff4e5",
    borderColor: "#f5b700",
  },
  optionEmoji: { fontSize: 28, marginBottom: 4 },
  optionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },
  optionLabelSelected: { color: "#111" },
  messageLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageRequired: { color: "#c62828", fontWeight: "700" },
  messageOptional: { color: "#999", fontWeight: "500" },
  messageInput: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111",
    minHeight: 70,
    maxHeight: 100,
    textAlignVertical: "top",
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: "#333" },
  submitBtn: {
    flex: 1.6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#c62828",
  },
  submitText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

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
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Aadhar is a 12-digit national ID — never show all 12 in the UI.
  const maskedAadhar = driver?.aadharNumber
    ? `•••• •••• ${driver.aadharNumber.slice(-4)}`
    : "—";

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.bodyContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.phHero}>
        <View style={styles.phAvatarLg}>
          <Text style={styles.phAvatarLgText}>{initialsOf(driver?.name, "D")}</Text>
        </View>
        <Text style={styles.phName}>{driver?.name ?? "Driver"}</Text>
        <Text style={styles.phSubtitle}>{driver?.mobile ?? "—"}</Text>
        <View style={styles.phPillRow}>
          <View style={styles.phPillAccent}>
            <Text style={styles.phPillAccentText}>Driver</Text>
          </View>
          {driver?.licenceNumber && (
            <View style={styles.phPill}>
              <Text style={styles.phPillText}>
                Licence · {driver.licenceNumber}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.phSectionHeader}>Personal details</Text>
      <View style={styles.phCard}>
        <InfoLine
          styles={styles}
          label="Date of birth"
          value={formatDob(driver?.dob as unknown as string | undefined)}
          first
        />
        <InfoLine
          styles={styles}
          label="Gender"
          value={driver?.gender ? capitalise(driver.gender) : "—"}
        />
      </View>

      <Text style={styles.phSectionHeader}>Documents</Text>
      <View style={styles.phCard}>
        <InfoLine
          styles={styles}
          label="Licence number"
          value={driver?.licenceNumber ?? "—"}
          first
        />
        <InfoLine
          styles={styles}
          label="Aadhar (last 4)"
          value={maskedAadhar}
        />
      </View>

      <Text style={styles.phSectionHeader}>Contact</Text>
      <View style={styles.phCard}>
        <InfoLine styles={styles} label="Mobile" value={driver?.mobile ?? "—"} first />
        <InfoLine
          styles={styles}
          label="Address"
          value={driver?.address ?? "—"}
        />
      </View>
      <Text style={styles.phHelp}>
        Need to update any of these? Contact your college admin.
      </Text>

      <Text style={styles.phSectionHeader}>Appearance</Text>
      <View style={styles.phCard}>
        <View style={styles.phToggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.phToggleLabel}>Dark mode</Text>
            <Text style={styles.phToggleHelp}>
              {mode === "dark" ? "Currently on" : "Currently off"}
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

      <View style={{ marginTop: 24, marginBottom: 24 }}>
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [
            styles.phLogout,
            pressed && styles.phLogoutPressed,
          ]}
        >
          <Text style={styles.phLogoutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function initialsOf(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InfoLine({
  styles,
  label,
  value,
  first,
}: {
  styles: Styles;
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.phInfoRow, !first && styles.phInfoRowDivider]}>
      <Text style={styles.phInfoLabel}>{label}</Text>
      <Text style={styles.phInfoValue}>{value}</Text>
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

    // ─── Bus condition (issue reporting) ─────────────────────────
    issueReportBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    issueReportEmoji: { fontSize: 26 },
    issueReportTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
    issueReportSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },

    issueActiveCard: {
      backgroundColor: "#fdecec",
      borderWidth: 1,
      borderColor: "#f5c2c2",
      borderRadius: 16,
      padding: 16,
    },
    issueHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    issueEmoji: { fontSize: 32 },
    issueTypeLabel: {
      fontSize: 16,
      fontWeight: "800",
      color: "#8f1d1d",
    },
    issueAgo: {
      fontSize: 12,
      color: "#8f1d1d",
      opacity: 0.75,
      marginTop: 2,
      fontWeight: "600",
    },
    issueMessage: {
      marginTop: 10,
      fontSize: 13,
      color: "#8f1d1d",
      fontWeight: "600",
      lineHeight: 18,
    },
    issueClearBtn: {
      marginTop: 14,
      backgroundColor: "#8f1d1d",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    issueClearText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
      letterSpacing: 0.3,
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
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    chevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

    // ─── Profile redesign ──────────────────────────────────────────────
    phHero: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
      borderRadius: 22,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginBottom: 18,
    },
    phAvatarLg: {
      width: 88,
      height: 88,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    phAvatarLgText: {
      color: colors.textOnAccent,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    phName: { fontSize: 19, fontWeight: "800", color: colors.text },
    phSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    phPillRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    phPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    phPillText: { fontSize: 12, fontWeight: "700", color: colors.text },
    phPillAccent: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
    },
    phPillAccentText: { fontSize: 12, fontWeight: "700", color: colors.accent },
    phSectionHeader: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: "uppercase",
      marginTop: 18,
      marginBottom: 10,
      marginLeft: 4,
    },
    phCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    phInfoRow: { paddingVertical: 14, paddingHorizontal: 18 },
    phInfoRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    phInfoLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    phInfoValue: { fontSize: 15, fontWeight: "600", color: colors.text },
    phToggleRow: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    phToggleLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    phToggleHelp: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    phHelp: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
      marginTop: 10,
      marginHorizontal: 4,
    },
    phLogout: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: "transparent",
    },
    phLogoutPressed: { opacity: 0.55 },
    phLogoutText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.danger,
      letterSpacing: 0.2,
    },

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
