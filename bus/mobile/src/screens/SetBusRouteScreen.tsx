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
import { collegeBusesApi } from "../api/collegeBuses";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "SetBusRoute">;

export function SetBusRouteScreen({ navigation, route }: Props) {
  const { collegeId, bus } = route.params;
  const [routeName, setRouteName] = useState(bus.route);
  const [stops, setStops] = useState<string[]>(
    bus.stops.length > 0 ? bus.stops : [""]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStop(index: number, value: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }

  function addStop() {
    setStops((prev) => [...prev, ""]);
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
    const cleaned = stops.map((s) => s.trim()).filter((s) => s.length > 0);
    if (cleaned.length === 0) return setError("Add at least one stop");

    setBusy(true);
    try {
      await collegeBusesApi.setRoute(collegeId, bus._id, {
        route: routeName.trim(),
        stops: cleaned,
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

      <Text style={[styles.label, { marginTop: 24 }]}>Stops (in order)</Text>
      {stops.map((stop, idx) => (
        <View key={idx} style={styles.stopRow}>
          <Text style={styles.stopIndex}>{idx + 1}.</Text>
          <TextInput
            value={stop}
            onChangeText={(v) => updateStop(idx, v)}
            placeholder={`Stop ${idx + 1}`}
            style={[styles.input, styles.stopInput]}
          />
          <Pressable
            style={styles.iconBtn}
            onPress={() => moveStop(idx, -1)}
            disabled={idx === 0}
          >
            <Text style={[styles.icon, idx === 0 && styles.iconDisabled]}>
              ↑
            </Text>
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
      ))}

      <Pressable style={styles.addStop} onPress={addStop}>
        <Text style={styles.addStopText}>+ Add stop</Text>
      </Pressable>

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
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  stopIndex: { width: 22, color: "#666", fontWeight: "600" },
  stopInput: { flex: 1 },
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
