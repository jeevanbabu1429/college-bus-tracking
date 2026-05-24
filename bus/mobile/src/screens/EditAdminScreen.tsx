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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import type { Gender } from "../api/auth";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "EditAdmin">;

const ACCENT = "#f5b700";
const GENDERS: Gender[] = ["male", "female", "other"];

function isValidDob(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EditAdminScreen({ navigation }: Props) {
  const { session, updateAdmin } = useAuth();
  const { mode: themeMode, colors } = useTheme();
  const admin = session?.role === "admin" ? session.admin : null;

  const [name, setName] = useState(admin?.name ?? "");
  const [gender, setGender] = useState<Gender | null>(
    (admin?.gender as Gender) ?? null
  );
  const [dob, setDob] = useState(
    admin?.dob ? toIsoDate(new Date(admin.dob)) : ""
  );
  const [mobile, setMobile] = useState(admin?.mobile ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const onDobChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setPickerOpen(false);
    if (event.type === "dismissed") return;
    if (selected) setDob(toIsoDate(selected));
  };

  async function onSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!gender) return setError("Select a gender");
    if (!isValidDob(dob)) return setError("DOB is invalid");
    if (!mobile.trim()) return setError("Mobile is required");
    if (!email.trim()) return setError("Email is required");

    setBusy(true);
    try {
      await updateAdmin({
        name: name.trim(),
        gender,
        dob,
        mobile: mobile.trim(),
        email: email.trim(),
      });
      Alert.alert("Profile updated", "Your details have been saved.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
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
          <Text style={styles.heading}>Edit Profile</Text>
          <Text style={styles.subheading}>
            Admin ID · {admin?.adminId ?? ""}
          </Text>

          <Text style={styles.label}>Name</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>👤</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[
                  styles.genderChip,
                  gender === g && styles.genderChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === g && styles.genderTextActive,
                  ]}
                >
                  {g}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Date of birth</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={styles.fieldRow}
          >
            <Text style={styles.fieldIcon}>📅</Text>
            <Text style={[styles.fieldText, !dob && styles.fieldPlaceholder]}>
              {dob || "Pick your date of birth"}
            </Text>
          </Pressable>
          {pickerOpen && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={dob ? new Date(dob) : new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                maximumDate={new Date()}
                onChange={onDobChange}
                themeVariant={themeMode}
                accentColor={colors.accent}
                textColor={colors.text}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setPickerOpen(false)}
                  style={({ pressed }) => [
                    styles.doneBtn,
                    pressed && styles.doneBtnPressed,
                  ]}
                >
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>📱</Text>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder="10-digit mobile"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>✉️</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
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
  subheading: { fontSize: 13, color: ACCENT, fontWeight: "700", marginTop: 4 },
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
  fieldIcon: { fontSize: 16 },
  field: { flex: 1, fontSize: 16, color: "#111", paddingVertical: 4 },
  fieldText: { flex: 1, fontSize: 16, color: "#111", paddingVertical: 4 },
  fieldPlaceholder: { color: "#bbb" },
  pickerWrap: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    paddingBottom: 8,
  },
  doneBtn: {
    alignSelf: "flex-end",
    marginRight: 12,
    marginTop: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  doneBtnPressed: { opacity: 0.85 },
  doneText: { color: "#111", fontWeight: "800", fontSize: 13 },
  genderRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 999,
    backgroundColor: "#fafafa",
  },
  genderChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  genderText: { textTransform: "capitalize", color: "#666", fontWeight: "600" },
  genderTextActive: { color: "#111" },
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
