import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { studentAuthApi, type LiveBusItem } from "../api/studentAuth";
import { distanceMeters, formatDistance, type LatLng } from "../lib/geo";
import type { StudentStackParamList } from "../navigation/types";

const POLL_MS = 5000;
const RADIUS_M = 5000;

type Nav = NativeStackNavigationProp<StudentStackParamList, "NearbyBuses">;

// The student's own position is read once on entry and then only on demand
// from the recentre button. Re-reading GPS on the 5s bus poll would drain the
// battery to move a circle the student is standing still inside.
type Phase =
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; origin: LatLng };

type NearbyBus = { item: LiveBusItem; at: LatLng; distance: number };

export function NearbyBusesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>({ kind: "locating" });
  const [items, setItems] = useState<LiveBusItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recentring, setRecentring] = useState(false);
  const inFlight = useRef(false);
  const mapRef = useRef<MapView | null>(null);

  // `silent` keeps the map mounted while the recentre button re-reads GPS —
  // flipping back to the "locating" phase would tear the map down and flash a
  // spinner over a screen the student is already looking at.
  const locate = useCallback(async (silent = false) => {
    if (!silent) setPhase({ kind: "locating" });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setPhase({ kind: "denied" });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const origin = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setPhase({ kind: "ready", origin });
      return origin;
    } catch (e) {
      setPhase({
        kind: "failed",
        message:
          (e as Error).message ||
          "Couldn't read your location. Check that location is switched on.",
      });
      return null;
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setItems(await studentAuthApi.liveBuses());
    } catch {
      // Swallow transient errors — the last known set stays on the map rather
      // than blinking out on one dropped request.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const origin = phase.kind === "ready" ? phase.origin : null;

  // Only buses that have actually reported a position count — a driver who
  // started a trip but whose phone hasn't sent a fix yet has no place on a
  // distance-based map.
  const nearby: NearbyBus[] = useMemo(() => {
    if (!origin || !items) return [];
    const out: NearbyBus[] = [];
    for (const item of items) {
      const loc = item.driver.currentLocation;
      if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
        continue;
      }
      const at = { lat: loc.lat, lng: loc.lng };
      const distance = distanceMeters(origin, at);
      if (distance <= RADIUS_M) out.push({ item, at, distance });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }, [origin, items]);

  const selected = nearby.find((n) => n.item.bus._id === selectedId) ?? null;

  // Drop the selection when the chosen bus leaves the radius or ends its
  // trip, so the card can never describe a bus that is no longer on the map.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  async function recentre() {
    setRecentring(true);
    const next = await locate(true);
    setRecentring(false);
    if (next && mapRef.current) {
      mapRef.current.animateToRegion(regionFor(next), 600);
    }
  }

  if (phase.kind === "locating") {
    return (
      <View style={styles.container}>
        <Header
          styles={styles}
          subtitle="Finding you…"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.emptyBody, { marginTop: 12 }]}>
            Getting your location so we can look for buses around you.
          </Text>
        </View>
      </View>
    );
  }

  if (phase.kind === "denied") {
    return (
      <View style={styles.container}>
        <Header
          styles={styles}
          subtitle="Location needed"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.center}>
          <Text style={styles.emojiBig}>📍</Text>
          <Text style={styles.emptyTitle}>Location is switched off</Text>
          <Text style={styles.emptyBody}>
            We only use your location on this screen, to measure which buses
            are within {RADIUS_M / 1000} km of you. It is never sent anywhere.
          </Text>
          <View style={styles.actionRow}>
            <Pressable onPress={() => locate()} style={styles.cta}>
              <Text style={styles.ctaText}>Try again</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={styles.ctaQuiet}
            >
              <Text style={styles.ctaQuietText}>Open settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (phase.kind === "failed") {
    return (
      <View style={styles.container}>
        <Header
          styles={styles}
          subtitle="Couldn't locate you"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.center}>
          <Text style={styles.emojiBig}>🛰️</Text>
          <Text style={styles.emptyTitle}>No location fix</Text>
          <Text style={styles.emptyBody}>{phase.message}</Text>
          <Pressable onPress={() => locate()} style={[styles.cta, { marginTop: 16 }]}>
            <Text style={styles.ctaText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        styles={styles}
        subtitle={
          items === null
            ? "Loading…"
            : nearby.length === 0
            ? `No buses within ${RADIUS_M / 1000} km`
            : `${nearby.length} bus${nearby.length === 1 ? "" : "es"} within ${
                RADIUS_M / 1000
              } km`
        }
        onBack={() => navigation.goBack()}
      />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={regionFor(phase.origin)}
          onPress={() => setSelectedId(null)}
        >
          <Circle
            center={{
              latitude: phase.origin.lat,
              longitude: phase.origin.lng,
            }}
            radius={RADIUS_M}
            strokeColor={colors.accent}
            strokeWidth={2}
            fillColor={colors.accent + "1f"}
          />

          <Marker
            coordinate={{
              latitude: phase.origin.lat,
              longitude: phase.origin.lng,
            }}
            title="You are here"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.meMarker}>
              <View style={styles.meMarkerHalo} />
              <View style={styles.meMarkerDot} />
            </View>
          </Marker>

          {nearby.map(({ item, at }) => (
            <Marker
              key={item.bus._id}
              coordinate={{ latitude: at.lat, longitude: at.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => setSelectedId(item.bus._id)}
            >
              {/* The number rides with the pin rather than hiding in a
                  callout — the whole point of this screen is telling several
                  buses apart at a glance. */}
              <View style={styles.busMarker}>
                <View style={styles.busMarkerInner}>
                  <Text style={styles.busMarkerEmoji}>🚌</Text>
                </View>
                <View style={styles.busMarkerLabel}>
                  <Text style={styles.busMarkerLabelText} numberOfLines={1}>
                    {item.bus.busNumber}
                  </Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.banner}>
          <View
            style={[
              styles.bannerDot,
              nearby.length > 0 ? styles.bannerDotLive : styles.bannerDotIdle,
            ]}
          />
          <Text style={styles.bannerText} numberOfLines={1}>
            {items === null
              ? "Looking for live buses…"
              : nearby.length === 0
              ? `No bus is inside your ${RADIUS_M / 1000} km circle`
              : `Nearest · ${formatDistance(nearby[0].distance)} away`}
          </Text>
        </View>

        <Pressable
          onPress={recentre}
          disabled={recentring}
          style={({ pressed }) => [
            styles.recentre,
            pressed && { opacity: 0.8 },
          ]}
        >
          {recentring ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.recentreIcon}>◎</Text>
          )}
        </Pressable>

        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetIconBox}>
                <Text style={styles.sheetEmoji}>🚌</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  Bus {selected.item.bus.busNumber}
                </Text>
                <Text style={styles.sheetMeta} numberOfLines={1}>
                  {formatDistance(selected.distance)} away · Driver{" "}
                  {selected.item.driver.name}
                </Text>
                {selected.item.bus.route ? (
                  <Text style={styles.sheetMeta} numberOfLines={1}>
                    {selected.item.bus.route}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={10}
                style={styles.sheetClose}
              >
                <Text style={styles.sheetCloseText}>×</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() =>
                navigation.navigate("TrackOtherBusMap", {
                  busId: selected.item.bus._id,
                  busNumber: selected.item.bus.busNumber,
                })
              }
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Track this bus</Text>
            </Pressable>
          </View>
        ) : nearby.length > 0 ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Tap a bus to see how far away it is and follow its route.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Header({
  styles,
  subtitle,
  onBack,
}: {
  styles: ReturnType<typeof makeStyles>;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.appBar}>
      <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10}>
        <Text style={styles.iconBtnText}>←</Text>
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.title}>Buses near me</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );
}

// A window that comfortably contains the whole circle. Longitude degrees get
// shorter as you leave the equator, so the horizontal span is widened by
// 1/cos(lat) to keep the circle round instead of squashed.
function regionFor(origin: LatLng) {
  const latitudeDelta = ((2 * RADIUS_M) / 111320) * 1.4;
  const longitudeDelta =
    latitudeDelta / Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180));
  return {
    latitude: origin.lat,
    longitude: origin.lng,
    latitudeDelta,
    longitudeDelta,
  };
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    appBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingTop: 50,
      paddingBottom: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnText: { fontSize: 22, color: colors.text },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emojiBig: { fontSize: 48, marginBottom: 12 },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
    },
    actionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
    cta: {
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
    },
    ctaText: { color: colors.textOnAccent, fontWeight: "700" },
    ctaQuiet: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ctaQuietText: { color: colors.text, fontWeight: "700" },

    mapWrap: { flex: 1 },
    map: { flex: 1 },

    meMarker: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    meMarkerHalo: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#1976d2",
      opacity: 0.22,
    },
    meMarkerDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#1976d2",
      borderWidth: 2,
      borderColor: "#fff",
    },

    busMarker: { alignItems: "center" },
    busMarkerInner: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    busMarkerEmoji: { fontSize: 15 },
    busMarkerLabel: {
      marginTop: -4,
      maxWidth: 96,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#111111",
      borderWidth: 1,
      borderColor: "#ffffff",
    },
    busMarkerLabelText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "800",
    },

    banner: {
      position: "absolute",
      top: 12,
      left: 12,
      right: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerDot: { width: 8, height: 8, borderRadius: 4 },
    bannerDotLive: { backgroundColor: "#2e7d32" },
    bannerDotIdle: { backgroundColor: colors.textMuted },
    bannerText: { flex: 1, fontSize: 12, color: colors.text, fontWeight: "600" },

    recentre: {
      position: "absolute",
      top: 10,
      right: 12,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    recentreIcon: { fontSize: 20, color: colors.text, fontWeight: "700" },

    hint: {
      position: "absolute",
      bottom: 16,
      left: 12,
      right: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hintText: { fontSize: 12.5, color: colors.textMuted, textAlign: "center" },

    sheet: {
      position: "absolute",
      bottom: 16,
      left: 12,
      right: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    sheetIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetEmoji: { fontSize: 20 },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    sheetMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    sheetClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetCloseText: {
      fontSize: 18,
      lineHeight: 20,
      color: colors.text,
      fontWeight: "700",
    },
  });
}
