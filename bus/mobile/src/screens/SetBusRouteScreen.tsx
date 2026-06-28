import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegeBusesApi, type BusStop } from "../api/collegeBuses";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "SetBusRoute">;

const emptyStop = (): BusStop => ({
  name: "",
  lat: null,
  lng: null,
  suspended: false,
});

export function SetBusRouteScreen({ navigation, route }: Props) {
  const { collegeId, bus } = route.params;
  const [routeName, setRouteName] = useState(bus.route);
  const [notice, setNotice] = useState(bus.notice ?? "");
  const [stops, setStops] = useState<BusStop[]>(
    bus.stops.length > 0 ? bus.stops : [emptyStop()]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStopName(index: number, value: string) {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, name: value } : s))
    );
  }

  function toggleSuspend(index: number) {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, suspended: !s.suspended } : s))
    );
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }

  function addStop() {
    setStops((prev) => [...prev, emptyStop()]);
  }

  function moveStop(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= stops.length) return;
    setStops((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function onSave() {
    setError(null);
    if (!routeName.trim()) return setError("Route name is required");
    const cleaned = stops
      .map((s) => ({ ...s, name: s.name.trim() }))
      .filter((s) => s.name.length > 0);
    if (cleaned.length === 0) return setError("Add at least one stop");

    setBusy(true);
    try {
      await collegeBusesApi.setRoute(collegeId, bus._id, {
        route: routeName.trim(),
        stops: cleaned,
        notice: notice.trim(),
      });
      Alert.alert(
        "Route saved",
        `Bus ${bus.busNumber}: ${cleaned.length} stop${cleaned.length === 1 ? "" : "s"}.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>
        Bus {bus.busNumber} · {bus.plateNumber}
      </Text>

      <Text style={styles.label}>Route name</Text>
      <TextInput
        value={routeName}
        onChangeText={setRouteName}
        placeholder="e.g. Indiranagar → MG Road"
        style={styles.input}
      />

      <Text style={[styles.label, { marginTop: 16 }]}>
        Notice (shown to students &amp; drivers)
      </Text>
      <TextInput
        value={notice}
        onChangeText={setNotice}
        placeholder="e.g. Anna Nagar closed May 24–31 — board at Main Road"
        style={[styles.input, styles.noticeInput]}
        multiline
      />

      <Text style={[styles.label, { marginTop: 24 }]}>Stops (in order)</Text>
      {stops.map((stop, idx) => (
        <View key={idx} style={styles.stopCard}>
          <View style={styles.stopRow}>
            <Text style={styles.stopIndex}>{idx + 1}.</Text>
            <TextInput
              value={stop.name}
              onChangeText={(v) => updateStopName(idx, v)}
              placeholder={`Stop ${idx + 1}`}
              style={[styles.input, styles.stopInput]}
            />
          </View>
          <View style={styles.stopActions}>
            <Pressable
              style={[
                styles.suspendBtn,
                stop.suspended && styles.suspendBtnActive,
              ]}
              onPress={() => toggleSuspend(idx)}
            >
              <Text
                style={[
                  styles.suspendText,
                  stop.suspended && styles.suspendTextActive,
                ]}
              >
                {stop.suspended ? "Suspended" : "Suspend"}
              </Text>
            </Pressable>
            <Text style={styles.placed}>
              {stop.lat != null && stop.lng != null ? "📍 placed" : "no location"}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.iconBtn}
              onPress={() => moveStop(idx, -1)}
              disabled={idx === 0}
            >
              <Text style={[styles.icon, idx === 0 && styles.iconDisabled]}>↑</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => moveStop(idx, 1)}
              disabled={idx === stops.length - 1}
            >
              <Text
                style={[
                  styles.icon,
                  idx === stops.length - 1 && styles.iconDisabled,
                ]}
              >
                ↓
              </Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => removeStop(idx)}
              disabled={stops.length === 1}
            >
              <Text
                style={[
                  styles.iconRemove,
                  stops.length === 1 && styles.iconDisabled,
                ]}
              >
                ✕
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.addStop} onPress={addStop}>
        <Text style={styles.addStopText}>+ Add stop</Text>
      </Pressable>

      <Text style={styles.hint}>
        Tip: set stop locations on the map in the web admin. Suspending a stop
        keeps students assigned to it and shows them the notice.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {busy ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <Pressable style={styles.primary} onPress={onSave}>
          <Text style={styles.primaryText}>Save route</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 48 },
  back: { marginBottom: 8, alignSelf: "flex-start" },
  backText: { color: "#0a66c2", fontSize: 14 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 16 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  noticeInput: { minHeight: 64, textAlignVertical: "top" },
  stopCard: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stopIndex: { width: 22, color: "#666", fontWeight: "600" },
  stopInput: { flex: 1, backgroundColor: "#fff" },
  stopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  suspendBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  suspendBtnActive: { backgroundColor: "#fdecea", borderColor: "#e0a4a0" },
  suspendText: { fontSize: 12, color: "#444", fontWeight: "600" },
  suspendTextActive: { color: "#c0392b" },
  placed: { fontSize: 11, color: "#888" },
  iconBtn: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  icon: { fontSize: 18, color: "#111" },
  iconRemove: { fontSize: 16, color: "#c0392b", fontWeight: "700" },
  iconDisabled: { color: "#bbb" },
  addStop: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bbb",
    borderRadius: 8,
  },
  addStopText: { color: "#0a66c2", fontWeight: "600" },
  hint: { marginTop: 12, fontSize: 12, color: "#888", lineHeight: 17 },
  primary: {
    marginTop: 24,
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "red", marginTop: 12 },
});
