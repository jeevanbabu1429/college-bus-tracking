import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { BusStop } from "../api/collegeBuses";
import type { StopArrival } from "../api/driverTrip";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { distanceMeters, formatDistance, type LatLng } from "../lib/geo";

// Close enough that "you are at this stop" is more useful than a distance in
// metres the GPS can't really justify.
const AT_STOP_M = 120;

const DONE = "#2e7d32";

type Row = {
  stop: BusStop;
  index: number;
  distance: number | null;
  arrivedAt: string | null;
};

type Props = {
  stops: BusStop[];
  /**
   * Reference point for the distance column. The driver's own position on
   * their screen; the bus's live position on a student's, where the same
   * number answers "how far is the bus from that stop".
   */
  origin: LatLng | null;
  viewer: "driver" | "student";
  /** Stops confirmed reached on the current trip. Server clears these when it ends. */
  arrivals?: StopArrival[];
  /** The student's own boarding stop, so it can be called out in the list. */
  myStop?: string | null;
  /** Driver only. Omit to render the list read-only — e.g. before a trip starts. */
  onMark?: (stop: string, arrived: boolean) => void;
  /** Stop currently being written, so its button can show progress. */
  marking?: string | null;
};

/**
 * The route as a connected line, and — during a trip — how far along it the
 * bus has got.
 *
 * Deliberately unlabelled at the ends. The same stop list is driven in both
 * directions, pickup in the morning and drop in the evening, so calling one
 * end "Start" is wrong for half of every day. Progress is therefore never
 * derived from position in the array: a stop is reached because the driver
 * said so, which holds whichever way the bus is going.
 */
export function RouteStops({
  stops,
  origin,
  viewer,
  arrivals,
  myStop,
  onMark,
  marking,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const arrivedAt = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of arrivals ?? []) map.set(a.stop, a.at);
    return map;
  }, [arrivals]);

  const rows: Row[] = useMemo(
    () =>
      stops.map((stop, index) => {
        const placed =
          typeof stop.lat === "number" && typeof stop.lng === "number";
        return {
          stop,
          index,
          distance:
            origin && placed
              ? distanceMeters(origin, {
                  lat: stop.lat as number,
                  lng: stop.lng as number,
                })
              : null,
          arrivedAt: arrivedAt.get(stop.name) ?? null,
        };
      }),
    [stops, origin, arrivedAt]
  );

  // Where the bus is now: the stop marked most recently, not the one furthest
  // along the array. On an evening run the latest mark is near the front of
  // the list, and that is still the right answer.
  const current = useMemo(() => {
    let best: Row | null = null;
    for (const row of rows) {
      if (!row.arrivedAt) continue;
      if (!best || row.arrivedAt > (best.arrivedAt as string)) best = row;
    }
    return best;
  }, [rows]);

  // A closed stop is not somewhere the bus is heading, so it never wins the
  // callout even when it is physically the closest thing.
  const nearest = useMemo(() => {
    let best: Row | null = null;
    for (const row of rows) {
      if (row.stop.suspended || row.distance === null) continue;
      if (!best || row.distance < (best.distance as number)) best = row;
    }
    return best;
  }, [rows]);

  // The driver has pulled up somewhere they haven't marked yet — the one
  // moment this screen has something to ask of them.
  const promptable =
    viewer === "driver" &&
    onMark &&
    nearest &&
    !nearest.arrivedAt &&
    (nearest.distance as number) <= AT_STOP_M
      ? nearest
      : null;

  const doneCount = rows.filter((r) => r.arrivedAt).length;
  const suspendedCount = stops.filter((s) => s.suspended).length;
  const lastIndex = stops.length - 1;

  return (
    <View style={styles.card}>
      {promptable ? (
        <View style={[styles.banner, styles.bannerAction]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerLabel}>You are at</Text>
            <Text style={styles.bannerName} numberOfLines={1}>
              {promptable.stop.name}
            </Text>
          </View>
          <Pressable
            onPress={() => onMark?.(promptable.stop.name, true)}
            disabled={marking === promptable.stop.name}
            style={({ pressed }) => [
              styles.bannerBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            {marking === promptable.stop.name ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.bannerBtnText}>Mark arrived</Text>
            )}
          </Pressable>
        </View>
      ) : current ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerEmoji}>🚌</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerLabel}>
              {viewer === "student" ? "Bus is here now" : "Last marked"}
            </Text>
            <Text style={styles.bannerName} numberOfLines={1}>
              {current.stop.name}
            </Text>
          </View>
          <Text style={styles.bannerDistance}>
            {clockTime(current.arrivedAt as string)}
          </Text>
        </View>
      ) : nearest ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerEmoji}>📍</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerLabel}>
              {viewer === "student"
                ? "Bus is nearest to"
                : (nearest.distance as number) <= AT_STOP_M
                ? "You are at"
                : "Nearest stop"}
            </Text>
            <Text style={styles.bannerName} numberOfLines={1}>
              {nearest.stop.name}
            </Text>
          </View>
          <Text style={styles.bannerDistance}>
            {formatDistance(nearest.distance as number)}
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {rows.map(({ stop, index, distance, arrivedAt: at }) => {
          const isFirst = index === 0;
          const isLast = index === lastIndex;
          const isCurrent = current?.index === index;
          const isMine = !!myStop && stop.name === myStop;
          const replacement = stop.suspended
            ? stop.temporaryReplacement?.trim()
            : "";
          const busy = marking === stop.name;

          return (
            <View
              key={`${stop.name}-${index}`}
              style={[styles.row, isCurrent && styles.rowCurrent]}
            >
              {/* The rail: two half-height segments behind an opaque ring, so
                  the line runs continuously between stops but never dangles
                  past the first or the last one. The segment leading into a
                  reached stop is filled, which is what makes the covered part
                  of the route readable at a glance. */}
              <View style={styles.rail}>
                {!isFirst && (
                  <View
                    style={[
                      styles.line,
                      styles.lineTop,
                      at && styles.lineDone,
                    ]}
                  />
                )}
                {!isLast && <View style={[styles.line, styles.lineBottom]} />}
                <View
                  style={[
                    styles.ring,
                    stop.suspended && styles.ringOff,
                    at && styles.ringDone,
                    isCurrent && styles.ringCurrent,
                  ]}
                >
                  {at ? (
                    <Text
                      style={[
                        styles.ringGlyph,
                        isCurrent && styles.ringGlyphCurrent,
                      ]}
                    >
                      ✓
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.name,
                      stop.suspended && styles.nameOff,
                      at && !isCurrent && styles.nameDone,
                      isCurrent && styles.nameCurrent,
                    ]}
                    numberOfLines={2}
                  >
                    {stop.name}
                  </Text>
                  {isMine && (
                    <View style={styles.tagMine}>
                      <Text style={styles.tagTextMine}>Your stop</Text>
                    </View>
                  )}
                  {stop.suspended && (
                    <View style={styles.tagOff}>
                      <Text style={styles.tagTextOff}>Closed</Text>
                    </View>
                  )}
                </View>

                {replacement ? (
                  <Text style={styles.replacement} numberOfLines={2}>
                    Pick up at {replacement} instead
                  </Text>
                ) : null}

                {at ? (
                  <Text style={styles.metaDone}>
                    {isCurrent && viewer === "student"
                      ? `Bus arrived ${clockTime(at)}`
                      : `Arrived ${clockTime(at)}`}
                  </Text>
                ) : distance !== null ? (
                  <Text style={styles.meta}>{formatDistance(distance)} away</Text>
                ) : null}
              </View>

              {onMark ? (
                <Pressable
                  onPress={() => onMark(stop.name, !at)}
                  disabled={busy}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.markBtn,
                    at ? styles.markBtnUndo : styles.markBtnDo,
                    promptable?.index === index && styles.markBtnPrompt,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator
                      size="small"
                      color={at ? colors.textMuted : colors.textOnAccent}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.markBtnText,
                        at ? styles.markBtnTextUndo : styles.markBtnTextDo,
                      ]}
                    >
                      {at ? "Undo" : "Arrived"}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {(doneCount > 0 || suspendedCount > 0) && (
        <View style={styles.footer}>
          {doneCount > 0 && (
            <Text style={styles.footerStrong}>
              {doneCount} of {stops.length} stops reached
            </Text>
          )}
          {suspendedCount > 0 && (
            <Text style={styles.footerText}>
              {suspendedCount} closed {suspendedCount === 1 ? "stop" : "stops"} —
              {viewer === "driver"
                ? ` drive past ${suspendedCount === 1 ? "it" : "them"} unless your college says otherwise.`
                : ` the bus does not pick up ${suspendedCount === 1 ? "there" : "at those"}.`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// Hand-rolled rather than toLocaleTimeString: this has to read the same on
// every Android build regardless of which locale data shipped with it.
function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${
    h < 12 ? "am" : "pm"
  }`;
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 6,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      marginBottom: 2,
      borderRadius: 16,
      backgroundColor: colors.accentSoft,
    },
    bannerAction: { paddingVertical: 10 },
    bannerIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    bannerEmoji: { fontSize: 16 },
    bannerLabel: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.textMuted,
    },
    bannerName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginTop: 1,
    },
    bannerDistance: { fontSize: 13, fontWeight: "800", color: colors.text },
    bannerBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      minWidth: 118,
      alignItems: "center",
    },
    bannerBtnText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 13,
    },

    list: { paddingVertical: 6, paddingHorizontal: 8 },

    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowCurrent: {
      backgroundColor: colors.accentSoft,
      borderRadius: 14,
      paddingRight: 6,
    },

    rail: {
      width: 22,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },
    line: {
      position: "absolute",
      width: 2,
      left: 10,
      backgroundColor: colors.border,
    },
    lineTop: { top: 0, height: "50%" },
    lineBottom: { bottom: 0, height: "50%" },
    lineDone: { backgroundColor: DONE },
    ring: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    ringOff: { borderColor: colors.danger, opacity: 0.7 },
    ringDone: { borderColor: DONE, backgroundColor: DONE },
    ringCurrent: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    ringGlyph: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
    ringGlyphCurrent: { color: colors.textOnAccent, fontSize: 12 },

    body: { flex: 1, paddingVertical: 11 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { flexShrink: 1, fontSize: 15, fontWeight: "600", color: colors.text },
    nameCurrent: { fontWeight: "800" },
    nameDone: { color: colors.textMuted },
    nameOff: { color: colors.textMuted, textDecorationLine: "line-through" },

    tagMine: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
    },
    tagTextMine: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.text,
    },
    tagOff: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "rgba(217,83,79,0.15)",
    },
    tagTextOff: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.danger,
    },

    replacement: {
      fontSize: 12.5,
      fontWeight: "600",
      color: colors.text,
      marginTop: 3,
    },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    metaDone: { fontSize: 12, color: DONE, fontWeight: "700", marginTop: 2 },

    markBtn: {
      minWidth: 74,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    markBtnDo: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    markBtnPrompt: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    markBtnUndo: { backgroundColor: "transparent" },
    markBtnText: { fontSize: 12.5, fontWeight: "800" },
    markBtnTextDo: { color: colors.text },
    markBtnTextUndo: { color: colors.textMuted },

    footer: {
      padding: 10,
      marginTop: 2,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      gap: 3,
    },
    footerStrong: {
      fontSize: 12.5,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
      textAlign: "center",
    },
  });
}
