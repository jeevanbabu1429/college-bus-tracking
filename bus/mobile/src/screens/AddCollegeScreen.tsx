import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collegesApi } from "../api/colleges";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "AddCollege">;

export function AddCollegeScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [busCount, setBusCount] = useState("");
  const [driverCount, setDriverCount] = useState("");
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
      const college = await collegesApi.create({
        name: name.trim(),
        address: address.trim(),
        code: code.trim().toUpperCase(),
        busCount: buses,
        driverCount: drivers,
      });
      Alert.alert("College added", `${college.name} (${college.code}) saved.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
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

      <Text style={styles.title}>Add College</Text>

      <Text style={styles.label}>College name</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />

      <Text style={styles.label}>College address</Text>
      <TextInput
        value={address}
        onChangeText={setAddress}
        multiline
        style={[styles.input, styles.multiline]}
      />

      <Text style={styles.label}>College code</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
      />

      <Text style={styles.label}>Number of buses</Text>
      <TextInput
        value={busCount}
        onChangeText={setBusCount}
        keyboardType="number-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Number of bus drivers</Text>
      <TextInput
        value={driverCount}
        onChangeText={setDriverCount}
        keyboardType="number-pad"
        style={styles.input}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {busy ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <Pressable style={styles.primary} onPress={onSubmit}>
          <Text style={styles.primaryText}>Save college</Text>
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
  title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  multiline: { minHeight: 64, textAlignVertical: "top" },
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
