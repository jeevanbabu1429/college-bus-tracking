import { useMemo, useState } from "react";
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
import { collegeBusesApi } from "../api/collegeBuses";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "AddBuses">;
type Styles = ReturnType<typeof makeStyles>;

export function AddBusesScreen({ navigation, route }: Props) {
  const { collegeId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [busNumber, setBusNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!busNumber.trim()) return setError("Bus number is required");
    if (!plateNumber.trim()) return setError("Plate number is required");

    const cap = parseInt(capacity, 10);
    if (!/^\d+$/.test(capacity.trim()) || cap < 1)
      return setError("Capacity must be a number ≥ 1");

    setBusy(true);
    try {
      const bus = await collegeBusesApi.create(collegeId, {
        busNumber: busNumber.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        capacity: cap,
      });
      Alert.alert(
        "Bus added",
        `${bus.busNumber} (${bus.plateNumber}) saved.`,
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
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Add Bus</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Bus details</Text>
          <Text style={styles.subheading}>
            Enter the registration details for the new bus.
          </Text>

          <Field
            styles={styles}
            colors={colors}
            label="Bus number"
            required
            placeholder="e.g. 12"
            helper="A unique identifier for this bus."
            value={busNumber}
            onChangeText={setBusNumber}
          />

          <Field
            styles={styles}
            colors={colors}
            label="Seating capacity"
            required
            placeholder="e.g. 40"
            helper="Total number of seats."
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
          />

          <Field
            styles={styles}
            colors={colors}
            label="Plate number"
            required
            placeholder="e.g. KA01AB1234"
            helper="Vehicle registration number."
            value={plateNumber}
            onChangeText={(v) => setPlateNumber(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>!</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {busy ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginTop: 28 }}
            />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
              ]}
              onPress={onSubmit}
            >
              <Text style={styles.primaryText}>Save Bus</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type FieldProps = {
  styles: Styles;
  colors: Colors;
  label: string;
  required?: boolean;
  helper?: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
  autoCorrect?: boolean;
};

function Field({
  styles,
  colors,
  label,
  required,
  helper,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize,
  autoCorrect,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    appBar: {
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { color: colors.text, fontWeight: "800", fontSize: 18 },
    appTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

    body: { flex: 1 },
    bodyContent: { padding: 24, paddingBottom: 48 },

    heading: { fontSize: 26, fontWeight: "800", color: colors.text },
    subheading: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 6,
      marginBottom: 24,
    },

    field: { marginBottom: 18 },
    label: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
      marginBottom: 8,
    },
    required: { color: colors.danger },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      fontWeight: "500",
    },
    inputFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      shadowColor: colors.accent,
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    helper: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      paddingHorizontal: 2,
    },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: "rgba(192,57,43,0.08)",
      borderWidth: 1,
      borderColor: "rgba(192,57,43,0.2)",
    },
    errorIcon: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.danger,
      color: "#fff",
      textAlign: "center",
      lineHeight: 22,
      fontSize: 13,
      fontWeight: "800",
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },

    primary: {
      marginTop: 28,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    primaryPressed: { opacity: 0.9 },
    primaryText: {
      color: colors.textOnAccent,
      fontSize: 16,
      fontWeight: "800",
    },
  });
}
