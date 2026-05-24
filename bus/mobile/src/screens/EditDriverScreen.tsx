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
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { collegeDriversApi } from "../api/collegeDrivers";
import type { Gender } from "../api/collegeDrivers";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "EditDriver">;
type Styles = ReturnType<typeof makeStyles>;

const GENDERS: Gender[] = ["male", "female", "other"];

function isValidDob(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function isoToYmd(value: string): string {
  return value.slice(0, 10);
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EditDriverScreen({ navigation, route }: Props) {
  const { collegeId, driver } = route.params;
  const { colors, mode: themeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState(driver.name);
  const [dob, setDob] = useState(isoToYmd(driver.dob));
  const [gender, setGender] = useState<Gender>(driver.gender);
  const [licenceNumber, setLicenceNumber] = useState(driver.licenceNumber);
  const [aadharNumber, setAadharNumber] = useState(driver.aadharNumber);
  const [mobile, setMobile] = useState(driver.mobile);
  const [address, setAddress] = useState(driver.address);
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
    if (!isValidDob(dob)) return setError("Pick a valid date of birth");
    if (!licenceNumber.trim()) return setError("Licence number is required");
    if (!/^\d{12}$/.test(aadharNumber.trim()))
      return setError("Aadhar must be 12 digits");
    if (!mobile.trim()) return setError("Mobile is required");
    if (!address.trim()) return setError("Address is required");

    setBusy(true);
    try {
      await collegeDriversApi.update(collegeId, driver._id, {
        name: name.trim(),
        dob,
        gender,
        licenceNumber: licenceNumber.trim().toUpperCase(),
        aadharNumber: aadharNumber.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
      });
      Alert.alert("Driver updated", `${name.trim()} saved.`, [
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
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Edit Driver</Text>
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
          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(driver.name ?? "D").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.identityName}>{driver.name}</Text>
              <Text style={styles.identityMeta}>
                {driver.licenceNumber}
              </Text>
            </View>
          </View>

          <Text style={styles.groupLabel}>Personal</Text>

          <Field
            styles={styles}
            colors={colors}
            label="Full name"
            required
            value={name}
            onChangeText={setName}
          />

          <View style={styles.field}>
            <Text style={styles.label}>
              Date of birth <Text style={styles.required}>*</Text>
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                styles.input,
                pressed && styles.inputPressed,
              ]}
            >
              <Text style={[styles.inputText, !dob && styles.placeholder]}>
                {dob || "Select date"}
              </Text>
            </Pressable>
            {pickerOpen && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={dob ? new Date(dob) : new Date(1990, 0, 1)}
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
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Gender <Text style={styles.required}>*</Text>
            </Text>
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
          </View>

          <Text style={styles.groupLabel}>Identification</Text>

          <Field
            styles={styles}
            colors={colors}
            label="Driving licence"
            required
            value={licenceNumber}
            onChangeText={(v) => setLicenceNumber(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Field
            styles={styles}
            colors={colors}
            label="Aadhar number"
            required
            value={aadharNumber}
            onChangeText={(v) =>
              setAadharNumber(v.replace(/\D/g, "").slice(0, 12))
            }
            keyboardType="number-pad"
            helper="Numeric only, no spaces."
          />

          <Text style={styles.groupLabel}>Contact</Text>

          <Field
            styles={styles}
            colors={colors}
            label="Mobile number"
            required
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            helper="Used for OTP login."
          />

          <Field
            styles={styles}
            colors={colors}
            label="Home address"
            required
            value={address}
            onChangeText={setAddress}
            multiline
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
              <Text style={styles.primaryText}>Save Changes</Text>
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
  multiline?: boolean;
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
  multiline,
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
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          focused && styles.inputFocused,
        ]}
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

    identityCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 20,
    },
    identityName: { fontSize: 16, fontWeight: "800", color: colors.text },
    identityMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    groupLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 12,
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
    inputMulti: { minHeight: 80, textAlignVertical: "top" },
    inputPressed: { opacity: 0.85 },
    inputText: { fontSize: 16, color: colors.text, fontWeight: "500" },
    placeholder: { color: colors.textMuted, fontWeight: "500" },
    inputFocused: {
      borderColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    },
    helper: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      paddingHorizontal: 2,
    },
    pickerWrap: {
      marginTop: 8,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingBottom: 8,
    },
    doneBtn: {
      alignSelf: "flex-end",
      marginRight: 12,
      marginTop: 4,
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 999,
    },
    doneBtnPressed: { opacity: 0.85 },
    doneText: { color: colors.textOnAccent, fontWeight: "800", fontSize: 13 },

    genderRow: { flexDirection: "row", gap: 8 },
    genderChip: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    genderChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    genderText: {
      textTransform: "capitalize",
      color: colors.textMuted,
      fontWeight: "700",
      fontSize: 14,
    },
    genderTextActive: { color: colors.textOnAccent },

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
