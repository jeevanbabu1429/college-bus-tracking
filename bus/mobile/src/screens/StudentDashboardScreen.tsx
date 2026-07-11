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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { studentAuthApi, type BusLocation } from "../api/studentAuth";
import type { BusStop } from "../api/collegeBuses";
import type { StudentStackParamList } from "../navigation/types";

const POLL_INTERVAL_MS = 5000;
type Tab = "home" | "profile";
type Styles = ReturnType<typeof makeStyles>;

type PlacedStop = { name: string; lat: number; lng: number; suspended: boolean };

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// When the student's own stop is suspended, tell them what to do. Two modes:
//   - "temporary": the admin explicitly set a replacement stop name — show it
//     verbatim, no distance (it might not even be a real stop on this route).
//   - "nearest": auto-suggest the closest non-suspended stop on the route.
//     Prefers a real distance if both have coords, else falls back to route
//     order.
type SuspensionHint =
  | { kind: "temporary"; name: string }
  | { kind: "nearest"; name: string; distance: number | null };

function suspensionHint(
  stops: BusStop[],
  myStopName: string | null
): SuspensionHint | null {
  if (!myStopName) return null;
  const mine = stops.find((s) => s.name === myStopName);
  if (!mine || !mine.suspended) return null;

  // Admin explicitly told us where to redirect this stop.
  const temp = mine.temporaryReplacement?.trim();
  if (temp) return { kind: "temporary", name: temp };

  // Fall back to computing the nearest open stop on the route.
  const open = stops.filter((s) => !s.suspended && s.name !== myStopName);
  if (open.length === 0) return null;

  if (typeof mine.lat === "number" && typeof mine.lng === "number") {
    const m = { lat: mine.lat, lng: mine.lng };
    const withCoords = open.filter(
      (s) => typeof s.lat === "number" && typeof s.lng === "number"
    );
    if (withCoords.length > 0) {
      let best = withCoords[0];
      let bestD = distanceMeters(m, { lat: best.lat!, lng: best.lng! });
      for (const c of withCoords.slice(1)) {
        const d = distanceMeters(m, { lat: c.lat!, lng: c.lng! });
        if (d < bestD) {
          best = c;
          bestD = d;
        }
      }
      return { kind: "nearest", name: best.name, distance: bestD };
    }
  }
  return { kind: "nearest", name: open[0].name, distance: null };
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function StudentDashboardScreen() {
  const { session, refreshSession, logout } = useAuth();
  const student = session?.role === "student" ? session.student : null;
  const { mode, colors, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation =
    useNavigation<
      NativeStackNavigationProp<StudentStackParamList, "StudentDashboard">
    >();
  const goTrackOther = useCallback(
    () => navigation.navigate("TrackOtherBuses"),
    [navigation]
  );

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
          onTrackOther={goTrackOther}
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
  onTrackOther: () => void;
};

const ISSUE_META: Record<
  string,
  { emoji: string; label: string; hint: string }
> = {
  breakdown: { emoji: "🚨", label: "Bus breakdown", hint: "The bus can't move right now." },
  flat_tyre: { emoji: "🛞", label: "Flat tyre", hint: "The driver is changing a tyre." },
  refuelling: { emoji: "⛽", label: "Refuelling", hint: "The bus is at a petrol station." },
  traffic: { emoji: "🚦", label: "Traffic delay", hint: "Expect a slower trip today." },
  mechanical: { emoji: "🔧", label: "Mechanical issue", hint: "The driver is checking the bus." },
  weather: { emoji: "🌧️", label: "Weather delay", hint: "The bus is slowed by weather." },
  other: { emoji: "❗", label: "Issue reported", hint: "See the driver's note below." },
};

function HomeView({ styles, colors, student, busLocation, onTrackOther }: HomeViewProps) {
  const bus = student?.bus ?? null;
  // Prefer fresh data from the live poll (notice/suspension can change during
  // the day) and fall back to the session copy.
  const liveBus = busLocation?.bus ?? null;
  const stops: BusStop[] = liveBus?.stops ?? bus?.stops ?? [];
  const notice = liveBus?.notice ?? bus?.notice ?? "";
  const tripActive = busLocation?.tripActive ?? false;
  const liveLoc = busLocation?.currentLocation ?? null;
  const currentIssue = busLocation?.currentIssue ?? null;
  const issueMeta = currentIssue ? ISSUE_META[currentIssue.type] : null;

  const myStopName = student?.stop ?? null;
  const myStop = stops.find((s) => s.name === myStopName) ?? null;
  const hint = suspensionHint(stops, myStopName);

  const placedStops = useMemo(
    () =>
      stops.filter(
        (s) => typeof s.lat === "number" && typeof s.lng === "number"
      ) as PlacedStop[],
    [stops]
  );

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

  const liveActive = Boolean(tripActive && liveLoc && pinPos);
  // Show the map if the bus is live OR we have at least one placed stop to draw.
  const mapCenter = pinPos
    ? pinPos
    : placedStops[0]
    ? { lat: placedStops[0].lat, lng: placedStops[0].lng }
    : null;

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

      <Pressable
        onPress={onTrackOther}
        style={({ pressed }) => [
          styles.trackOtherCard,
          pressed && styles.trackOtherCardPressed,
        ]}
      >
        <View style={styles.trackOtherIconBox}>
          <Text style={styles.trackOtherEmoji}>🚌</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackOtherTitle}>Track other bus</Text>
          <Text style={styles.trackOtherSub}>
            See every bus in your college that&rsquo;s on a trip right now
          </Text>
        </View>
        <Text style={styles.trackOtherChevron}>›</Text>
      </Pressable>

      {bus && notice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeIcon}>⚠️</Text>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {bus && currentIssue && issueMeta ? (
        <View style={styles.driverIssueCard}>
          <View style={styles.driverIssueHeader}>
            <Text style={styles.driverIssueEmoji}>{issueMeta.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverIssueLabel}>Driver alert</Text>
              <Text style={styles.driverIssueTitle}>{issueMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.driverIssueHint}>{issueMeta.hint}</Text>
          {currentIssue.message ? (
            <View style={styles.driverIssueQuote}>
              <Text style={styles.driverIssueQuoteText}>
                “{currentIssue.message}”
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {bus && (
        <>
          <Text style={styles.sectionLabel}>Live Bus Location</Text>
          {mapCenter ? (
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: mapCenter.lat,
                  longitude: mapCenter.lng,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                {placedStops.length >= 2 && (
                  <Polyline
                    coordinates={placedStops.map((s) => ({
                      latitude: s.lat,
                      longitude: s.lng,
                    }))}
                    strokeColor={colors.accent}
                    strokeWidth={3}
                  />
                )}
                {placedStops.map((s) => (
                  <Marker
                    key={s.name}
                    coordinate={{ latitude: s.lat, longitude: s.lng }}
                    title={s.name + (s.suspended ? " (suspended)" : "")}
                    pinColor={
                      s.suspended
                        ? "gray"
                        : s.name === myStopName
                        ? "orange"
                        : "red"
                    }
                  />
                ))}
                {liveActive && liveLoc && pinPos && (
                  <Marker
                    coordinate={{ latitude: pinPos.lat, longitude: pinPos.lng }}
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
                )}
              </MapView>
              {liveActive && pinPos && (
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
              )}
              <View style={styles.liveBanner}>
                <View
                  style={[styles.liveDot, !liveActive && styles.liveDotIdle]}
                />
                <Text style={styles.liveText}>
                  {liveActive && liveLoc
                    ? `Live · updated ${new Date(liveLoc.updatedAt).toLocaleTimeString()}`
                    : tripActive
                    ? "Waiting for the driver's first location…"
                    : "Route shown · bus is idle"}
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
            <View>
              {/* When the admin set an explicit temporary stop, promote it to
                  the primary card — the student needs to know WHERE to board
                  today, not that their regular stop is closed. */}
              {myStop?.suspended && hint?.kind === "temporary" ? (
                <>
                  <View style={[styles.myStopCard, styles.myStopCardTemp]}>
                    <View
                      style={[
                        styles.myStopIcon,
                        { backgroundColor: "#c8e6c9" },
                      ]}
                    >
                      <Text style={styles.myStopEmoji}>📍</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.myStopHint, styles.myStopHintTemp]}>
                        Board here today
                      </Text>
                      <Text style={[styles.myStopName, styles.myStopNameTemp]}>
                        {hint.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.tempSubnoteCard}>
                    <Text style={styles.tempSubnoteText}>
                      Your regular stop{" "}
                      <Text style={styles.tempSubnoteStrong}>
                        {student.stop}
                      </Text>{" "}
                      is temporarily closed.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={[
                      styles.myStopCard,
                      myStop?.suspended && styles.myStopCardSuspended,
                    ]}
                  >
                    <View style={styles.myStopIcon}>
                      <Text style={styles.myStopEmoji}>
                        {myStop?.suspended ? "🚧" : "📍"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.myStopHint}>
                        {myStop?.suspended
                          ? "Stop temporarily closed"
                          : "You board at"}
                      </Text>
                      <Text
                        style={[
                          styles.myStopName,
                          myStop?.suspended && styles.myStopNameSuspended,
                        ]}
                      >
                        {student.stop}
                      </Text>
                    </View>
                  </View>
                  {myStop?.suspended && (
                    <View style={styles.suggestionCard}>
                      <Text style={styles.suggestionText}>
                        {!hint
                          ? "Please check the notice above for an alternate stop."
                          : `Nearest open stop: ${hint.name}${
                              hint.kind === "nearest" && hint.distance != null
                                ? ` · ${formatDistance(hint.distance)} away`
                                : ""
                            }`}
                      </Text>
                    </View>
                  )}
                </>
              )}
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
                const isMine = student?.stop === s.name;
                return (
                  <View
                    key={`${s.name}-${i}`}
                    style={[
                      styles.stopRow,
                      i < stops.length - 1 && styles.stopRowDivider,
                    ]}
                  >
                    <View
                      style={[
                        styles.stopBullet,
                        isMine && styles.stopBulletMine,
                        s.suspended && styles.stopBulletSuspended,
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
                      style={[
                        styles.stopText,
                        isMine && styles.stopTextMine,
                        s.suspended && styles.stopTextSuspended,
                      ]}
                    >
                      {s.name}
                      {s.suspended ? "  (closed)" : ""}
                    </Text>
                    {isMine && !s.suspended && (
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
      <View style={styles.phHero}>
        <View style={styles.phAvatarLg}>
          <Text style={styles.phAvatarLgText}>{initialsOf(student?.name, "S")}</Text>
        </View>
        <Text style={styles.phName}>{student?.name ?? "Student"}</Text>
        <Text style={styles.phSubtitle}>Roll · {student?.rollNumber ?? "—"}</Text>
        <View style={styles.phPillRow}>
          <View style={styles.phPillAccent}>
            <Text style={styles.phPillAccentText}>Student</Text>
          </View>
          {student?.bus && (
            <View style={styles.phPill}>
              <Text style={styles.phPillText}>Bus {student.bus.busNumber}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.phSectionHeader}>Personal details</Text>
      <View style={styles.phCard}>
        <InfoLine styles={styles} label="Full name" value={student?.name ?? "—"} first />
        <InfoLine styles={styles} label="Roll number" value={student?.rollNumber ?? "—"} />
        <InfoLine styles={styles} label="Mobile" value={student?.mobile ?? "—"} />
        <InfoLine styles={styles} label="Address" value={student?.address ?? "—"} />
      </View>
      <Text style={styles.phHelp}>
        These details are managed by your college admin. Reach out to them to
        make changes.
      </Text>

      {student?.bus && (
        <>
          <Text style={styles.phSectionHeader}>Your bus</Text>
          <View style={styles.phCard}>
            <InfoLine
              styles={styles}
              label="Bus"
              value={`${student.bus.busNumber} · ${student.bus.plateNumber}`}
              first
            />
            <InfoLine
              styles={styles}
              label="Boarding stop"
              value={student.stop ?? "Not assigned yet"}
            />
          </View>
        </>
      )}

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
    liveDotIdle: { backgroundColor: "#9aa0a6" },

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

    // ─── Driver-reported issue alert ─────────────────────────────
    driverIssueCard: {
      backgroundColor: "#fdecec",
      borderWidth: 1,
      borderColor: "#f5c2c2",
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
    },
    driverIssueHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    driverIssueEmoji: { fontSize: 32 },
    driverIssueLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: "#8f1d1d",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    driverIssueTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#8f1d1d",
      marginTop: 2,
    },
    driverIssueHint: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: "600",
      color: "#8f1d1d",
      lineHeight: 18,
    },
    driverIssueQuote: {
      marginTop: 10,
      paddingLeft: 10,
      borderLeftWidth: 3,
      borderLeftColor: "#8f1d1d",
    },
    driverIssueQuoteText: {
      fontSize: 13,
      fontStyle: "italic",
      color: "#8f1d1d",
      fontWeight: "500",
      lineHeight: 18,
    },

    trackOtherCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    trackOtherCardPressed: { opacity: 0.7 },
    trackOtherIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    trackOtherEmoji: { fontSize: 22 },
    trackOtherTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    trackOtherSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    trackOtherChevron: { fontSize: 22, color: colors.textMuted, marginLeft: 4 },
    noticeIcon: { fontSize: 16 },
    noticeText: {
      flex: 1,
      color: "#92400e",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },

    myStopCardSuspended: { backgroundColor: "#9aa0a6" },
    myStopNameSuspended: { textDecorationLine: "line-through", color: "#fff" },
    // Temporary-stop primary card — green-tinted, "board here today" mood.
    myStopCardTemp: {
      backgroundColor: "#e6f4ea",
      borderWidth: 1,
      borderColor: "#a5d6a7",
    },
    myStopHintTemp: { color: "#1b5e20" },
    myStopNameTemp: { color: "#1b5e20" },
    // Small subnote under the primary temp card explaining WHY they're being
    // sent somewhere new. Muted so it doesn't fight the main message.
    tempSubnoteCard: {
      marginTop: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      padding: 12,
    },
    tempSubnoteText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    tempSubnoteStrong: { fontWeight: "700", color: colors.text },
    suggestionCard: {
      marginTop: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      padding: 12,
    },
    suggestionText: { color: colors.text, fontSize: 13, fontWeight: "700" },

    stopBulletSuspended: { backgroundColor: "rgba(217,83,79,0.2)" },
    stopTextSuspended: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
      fontWeight: "600",
    },

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
