import { useEffect, useMemo, useState } from "react";
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
import { collegeStudentsApi } from "../api/collegeStudents";
import type { Gender } from "../api/collegeStudents";
import { collegeBusesApi, type Bus } from "../api/collegeBuses";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AppStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "AddStudents">;
type Styles = ReturnType<typeof makeStyles>;

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

export function AddStudentsScreen({ navigation, route }: Props) {
  const { collegeId } = route.params;
  const { colors, mode: themeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [busId, setBusId] = useState<string | null>(null);
  const [stop, setStop] = useState<string | null>(null);
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [occupancy, setOccupancy] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      collegeBusesApi.list(collegeId),
      collegeStudentsApi.list(collegeId),
    ])
      .then(([b, s]) => {
        if (cancelled) return;
        setBuses(b);
        const map: Record<string, number> = {};
        for (const st of s) {
          if (st.bus) map[st.bus._id] = (map[st.bus._id] ?? 0) + 1;
        }
        setOccupancy(map);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [collegeId]);

  const sortedBuses = useMemo(() => {
    if (!buses) return [];
    return [...buses].sort((a, b) => a.busNumber.localeCompare(b.busNumber));
  }, [buses]);

  const selectedBus = useMemo(
    () => sortedBuses.find((b) => b._id === busId) ?? null,
    [sortedBuses, busId]
  );

  function pickBus(id: string | null) {
    setBusId(id);
    setStop(null);
  }

  const onDobChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setPickerOpen(false);
    if (event.type === "dismissed") return;
    if (selected) setDob(toIsoDate(selected));
  };

  async function onSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!rollNumber.trim()) return setError("Roll number is required");
    if (!gender) return setError("Select a gender");
    if (!isValidDob(dob)) return setError("Pick a valid date of birth");
    if (!address.trim()) return setError("Address is required");
    if (!mobile.trim()) return setError("Mobile is required");
    if (
      busId &&
      selectedBus &&
      selectedBus.stops &&
      selectedBus.stops.length > 0 &&
      !stop
    ) {
      return setError("Please pick a stop on this bus's route");
    }

    setBusy(true);
    try {
      const student = await collegeStudentsApi.create(collegeId, {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        gender,
        dob,
        address: address.trim(),
        mobile: mobile.trim(),
        busId: busId ?? null,
        stop: busId ? stop : null,
      });
      const busLabel = student.bus
        ? ` · Bus ${student.bus.busNumber}${
            student.stop ? ` (${student.stop})` : ""
          }`
        : "";
      Alert.alert(
        "Student added",
        `${student.name} (${student.rollNumber})${busLabel} saved.`,
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
          <Text style={styles.appTitle}>Add Student</Text>
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
          <Text style={styles.heading}>Student details</Text>
          <Text style={styles.subheading}>
            Capture identity, contact, and (optionally) bus assignment.
          </Text>

          <Text style={styles.groupLabel}>Personal</Text>

          <Field
            styles={styles}
            colors={colors}
            label="Full name"
            required
            placeholder="e.g. Arjun Sharma"
            value={name}
            onChangeText={setName}
          />

          <Field
            styles={styles}
            colors={colors}
            label="Roll number"
            required
            placeholder="e.g. 21CS045"
            value={rollNumber}
            onChangeText={(v) => setRollNumber(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

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
                  value={dob ? new Date(dob) : new Date(2005, 0, 1)}
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

          <Text style={styles.groupLabel}>Contact</Text>

          <Field
            styles={styles}
            colors={colors}
            label="Mobile number"
            required
            placeholder="10-digit mobile"
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
            placeholder="Street, area, city"
            value={address}
            onChangeText={setAddress}
            multiline
          />

          <Text style={styles.groupLabel}>Bus assignment (optional)</Text>

          {!buses ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 4 }} />
          ) : sortedBuses.length === 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeEmoji}>🚌</Text>
              <Text style={styles.noticeText}>
                No buses for this college yet. You can assign one later.
              </Text>
            </View>
          ) : (
            <View style={styles.busList}>
              <Pressable
                onPress={() => pickBus(null)}
                style={[
                  styles.busOption,
                  busId === null && styles.busOptionActive,
                ]}
              >
                <View
                  style={[
                    styles.busBadge,
                    busId === null && styles.busBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.busBadgeText,
                      busId === null && styles.busBadgeTextActive,
                    ]}
                  >
                    —
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.busOptionTitle}>Unassigned</Text>
                  <Text style={styles.busOptionSub}>
                    Assign a bus later from settings.
                  </Text>
                </View>
                {busId === null && <Text style={styles.tick}>✓</Text>}
              </Pressable>

              {sortedBuses.map((bus) => {
                const taken = occupancy[bus._id] ?? 0;
                const free = Math.max(0, bus.capacity - taken);
                const full = free === 0;
                const selected = busId === bus._id;
                const disabled = full && !selected;
                return (
                  <Pressable
                    key={bus._id}
                    onPress={() => !disabled && pickBus(bus._id)}
                    disabled={disabled}
                    style={[
                      styles.busOption,
                      selected && styles.busOptionActive,
                      disabled && styles.busOptionDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.busBadge,
                        selected && styles.busBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.busBadgeText,
                          selected && styles.busBadgeTextActive,
                        ]}
                      >
                        {bus.busNumber}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busOptionTitle}>
                        Bus {bus.busNumber}
                      </Text>
                      <Text style={styles.busOptionSub}>
                        {bus.plateNumber}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.seatPill,
                        full && styles.seatPillFull,
                        selected && !full && styles.seatPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.seatPillText,
                          full && styles.seatPillTextFull,
                        ]}
                      >
                        {full ? "FULL" : `${free} free`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedBus && (
            <View style={styles.field}>
              <Text style={styles.label}>Boarding stop</Text>
              {!selectedBus.stops || selectedBus.stops.length === 0 ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeEmoji}>🛣️</Text>
                  <Text style={styles.noticeText}>
                    This bus has no route set yet. You can pick a stop after
                    the route is added.
                  </Text>
                </View>
              ) : (
                <>
                  {selectedBus.route && (
                    <View style={styles.routeChip}>
                      <Text style={styles.routeChipIcon}>🛣️</Text>
                      <Text style={styles.routeChipText} numberOfLines={1}>
                        {selectedBus.route}
                      </Text>
                    </View>
                  )}
                  <View style={styles.stopList}>
                    {selectedBus.stops.map((s, i) => {
                      const selected = stop === s.name;
                      return (
                        <Pressable
                          key={`${s.name}-${i}`}
                          onPress={() => setStop(s.name)}
                          style={[
                            styles.stopRow,
                            selected && styles.stopRowActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.stopBullet,
                              selected && styles.stopBulletActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stopBulletText,
                                selected && styles.stopBulletTextActive,
                              ]}
                            >
                              {i + 1}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.stopText,
                              selected && styles.stopTextActive,
                            ]}
                          >
                            {s.name}
                            {s.suspended ? "  (suspended)" : ""}
                          </Text>
                          {selected && <Text style={styles.tick}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

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
              <Text style={styles.primaryText}>Save Student</Text>
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

    heading: { fontSize: 26, fontWeight: "800", color: colors.text },
    subheading: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 6,
      marginBottom: 16,
    },

    groupLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: 16,
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

    busList: { gap: 10 },
    busOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    busOptionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    busOptionDisabled: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      opacity: 0.55,
    },
    busBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    busBadgeActive: { backgroundColor: colors.accent },
    busBadgeText: {
      color: colors.textMuted,
      fontWeight: "800",
      fontSize: 16,
    },
    busBadgeTextActive: { color: colors.textOnAccent },
    busOptionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    busOptionSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

    seatPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    seatPillSelected: { backgroundColor: colors.accent },
    seatPillFull: { backgroundColor: "rgba(192,57,43,0.12)" },
    seatPillText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
    },
    seatPillTextFull: { color: colors.danger },

    tick: {
      color: colors.accent,
      fontSize: 18,
      fontWeight: "800",
    },

    routeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.accentSoft,
      borderRadius: 999,
      marginBottom: 8,
    },
    routeChipIcon: { fontSize: 12 },
    routeChipText: { color: colors.accent, fontSize: 12, fontWeight: "700" },

    stopList: { gap: 8 },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    stopRowActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    stopBullet: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stopBulletActive: { backgroundColor: colors.accent },
    stopBulletText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
    },
    stopBulletTextActive: { color: colors.textOnAccent },
    stopText: { fontSize: 14, color: colors.text, flex: 1, fontWeight: "600" },
    stopTextActive: { color: colors.text, fontWeight: "800" },

    noticeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
    },
    noticeEmoji: { fontSize: 22 },
    noticeText: { flex: 1, color: colors.textMuted, fontSize: 13 },

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
