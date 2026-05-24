import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegesApi } from "../api/colleges";
import { useColleges } from "../college/CollegeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "EditCollege">;

const ACCENT = "#f5b700";

export function EditCollegeScreen({ navigation, route }: Props) {
  const { college } = route.params;
  const { refresh } = useColleges();

  const [name, setName] = useState(college.name);
  const [address, setAddress] = useState(college.address);
  const [code, setCode] = useState(college.code);
  const [busCount, setBusCount] = useState(String(college.busCount));
  const [driverCount, setDriverCount] = useState(String(college.driverCount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseCount(value: string): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    return parseInt(value, 10);
  }

  async function onSubmit() {
    setError(null);
    if (!name.trim()) return setError("College name is required");
    if (!address.trim()) return setError("College address is required");
    if (!code.trim()) return setError("College code is required");

    const buses = parseCount(busCount);
    if (buses === null) return setError("Buses must be a non-negative number");

    const drivers = parseCount(driverCount);
    if (drivers === null)
      return setError("Drivers must be a non-negative number");

    setBusy(true);
    try {
      const updated = await collegesApi.update(college._id, {
        name: name.trim(),
        address: address.trim(),
        code: code.trim().toUpperCase(),
        busCount: buses,
        driverCount: drivers,
      });
      await refresh();
      Alert.alert(
        "College updated",
        `${updated.name} (${updated.code}) saved.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.topPanel}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.cardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Edit College</Text>
          <Text style={styles.subheading}>Update name, code or planned counts</Text>

          <Text style={styles.label}>College name</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🏫</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="College name"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          <Text style={styles.label}>College code</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🔑</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          <Text style={styles.label}>College address</Text>
          <View style={[styles.fieldRow, styles.fieldRowMulti]}>
            <Text style={styles.fieldIcon}>📍</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              multiline
              placeholder="Address"
              placeholderTextColor="#bbb"
              style={[styles.field, styles.fieldMulti]}
            />
          </View>

          <Text style={styles.label}>Number of buses (planned)</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🚌</Text>
            <TextInput
              value={busCount}
              onChangeText={setBusCount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          <Text style={styles.label}>Number of drivers (planned)</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🪪</Text>
            <TextInput
              value={driverCount}
              onChangeText={setDriverCount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {busy ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 28 }} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
              ]}
              onPress={onSubmit}
            >
              <Text style={styles.primaryText}>Save changes</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ACCENT },
  topPanel: {
    height: 180,
    backgroundColor: ACCENT,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#111", fontSize: 20, fontWeight: "700" },
  cardWrap: { flex: 1, marginTop: -40 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  cardContent: { paddingTop: 36, paddingHorizontal: 28, paddingBottom: 48 },
  heading: { fontSize: 30, fontWeight: "800", color: "#111" },
  subheading: { fontSize: 14, color: "#888", marginTop: 4, marginBottom: 12 },
  label: {
    fontSize: 13,
    color: "#444",
    marginTop: 16,
    marginBottom: 6,
    fontWeight: "600",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 8,
    gap: 10,
  },
  fieldRowMulti: { alignItems: "flex-start" },
  fieldIcon: { fontSize: 16 },
  field: { flex: 1, fontSize: 16, color: "#111", paddingVertical: 4 },
  fieldMulti: { minHeight: 60, textAlignVertical: "top" },
  primary: {
    marginTop: 28,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryPressed: { opacity: 0.9 },
  primaryText: { color: "#111", fontSize: 16, fontWeight: "700" },
  error: { color: "#c0392b", marginTop: 16, textAlign: "center" },
});
