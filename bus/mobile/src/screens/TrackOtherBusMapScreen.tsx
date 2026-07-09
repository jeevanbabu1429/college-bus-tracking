import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { studentAuthApi, type LiveBusItem } from "../api/studentAuth";
import type { StudentStackParamList } from "../navigation/types";

const POLL_MS = 5000;

type Nav = NativeStackNavigationProp<StudentStackParamList, "TrackOtherBusMap">;
type Rt = RouteProp<StudentStackParamList, "TrackOtherBusMap">;

type PlacedStop = { name: string; lat: number; lng: number; suspended: boolean };

export function TrackOtherBusMapScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { busId, busNumber } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [item, setItem] = useState<LiveBusItem | null | undefined>(undefined);
  const inFlight = useRef(false);
  const mapRef = useRef<MapView | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const list = await studentAuthApi.liveBuses();
      const found = list.find((it) => it.bus._id === busId) ?? null;
      setItem(found);
    } catch {
      // swallow transient errors — keep the last known state on screen
    } finally {
      inFlight.current = false;
    }
  }, [busId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const bus = item?.bus ?? null;
  const loc = item?.driver.currentLocation ?? null;
  const placedStops: PlacedStop[] = useMemo(() => {
    if (!bus) return [];
    return bus.stops
      .filter(
        (s): s is PlacedStop & { suspended: boolean } =>
          typeof s.lat === "number" && typeof s.lng === "number"
      )
      .map((s) => ({
        name: s.name,
        lat: s.lat as number,
        lng: s.lng as number,
        suspended: s.suspended,
      }));
  }, [bus]);

  // Pan camera to the bus whenever its position updates. Quick animation, no
  // interpolation — students see the bus jump by ≤50m every 5s, acceptable
  // for a "where's it now" view.
  useEffect(() => {
    if (!loc || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      800
    );
  }, [loc?.lat, loc?.lng, loc?.updatedAt]);

  const initialCenter = loc
    ? { lat: loc.lat, lng: loc.lng }
    : placedStops[0]
    ? { lat: placedStops[0].lat, lng: placedStops[0].lng }
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Text style={styles.iconBtnText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Bus {busNumber}</Text>
          {item === undefined ? (
            <Text style={styles.subtitle}>Loading…</Text>
          ) : item === null ? (
            <Text style={[styles.subtitle, { color: colors.danger }]}>
              Trip ended
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Driver · {item.driver.name}
            </Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {item === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : item === null ? (
        <View style={styles.center}>
          <Text style={styles.emojiBig}>🏁</Text>
          <Text style={styles.emptyTitle}>This trip just ended</Text>
          <Text style={styles.emptyBody}>
            The driver of Bus {busNumber} stopped their trip. Go back to see
            other buses that are still on the road.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.cta, { marginTop: 16 }]}
          >
            <Text style={styles.ctaText}>Back to list</Text>
          </Pressable>
        </View>
      ) : !initialCenter ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyBody}>
            Waiting for the driver&rsquo;s first location update…
          </Text>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: initialCenter.lat,
              longitude: initialCenter.lng,
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
                pinColor={s.suspended ? "gray" : "red"}
              />
            ))}
            {loc && (
              <Marker
                coordinate={{ latitude: loc.lat, longitude: loc.lng }}
                title={`Bus ${bus?.busNumber ?? ""}`}
                description={`Updated ${secondsAgo(loc.updatedAt)}s ago`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.busMarker}>
                  <View style={styles.busMarkerHalo} />
                  <View style={styles.busMarkerInner}>
                    <Text style={styles.busMarkerEmoji}>🚌</Text>
                  </View>
                </View>
              </Marker>
            )}
          </MapView>

          <View style={styles.banner}>
            <View
              style={[
                styles.bannerDot,
                loc ? styles.bannerDotLive : styles.bannerDotIdle,
              ]}
            />
            <Text style={styles.bannerText}>
              {loc
                ? `Live · updated ${secondsAgo(loc.updatedAt)}s ago`
                : "Waiting for first location…"}
            </Text>
          </View>

          {bus?.notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeIcon}>⚠️</Text>
              <Text style={styles.noticeText} numberOfLines={3}>
                {bus.notice}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function secondsAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
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
    cta: {
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
    },
    ctaText: { color: colors.textOnAccent, fontWeight: "700" },
    mapWrap: { flex: 1 },
    map: { flex: 1 },
    busMarker: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    busMarkerHalo: {
      position: "absolute",
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      opacity: 0.25,
    },
    busMarkerInner: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    busMarkerEmoji: { fontSize: 14 },
    banner: {
      position: "absolute",
      top: 12,
      left: 12,
      right: 12,
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
    bannerText: { fontSize: 12, color: colors.text, fontWeight: "600" },
    notice: {
      position: "absolute",
      bottom: 16,
      left: 12,
      right: 12,
      flexDirection: "row",
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noticeIcon: { fontSize: 18 },
    noticeText: { flex: 1, fontSize: 13, color: colors.text },
  });
}
