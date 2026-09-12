import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppAlert } from "../components/AppAlert";
import { useTheme, type Colors } from "../theme/ThemeContext";
import { pickScreenshot } from "../lib/images";
import {
  COMPLAINT_CATEGORIES,
  complaintsApi,
  type ComplaintCategory,
} from "../api/complaints";
import type { SupportRoutes } from "../navigation/types";

const MAX_MESSAGE = 2000;

export function ReportProblemScreen() {
  // Typed off the shared support routes rather than a stack's own param list:
  // this screen is registered in all three stacks (admin, driver, student) and
  // must not care which one it is running inside.
  const navigation = useNavigation<NativeStackNavigationProp<SupportRoutes>>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAttach() {
    setError(null);
    try {
      const picked = await pickScreenshot();
      // null means the picker was dismissed — not a failure, just nothing to do.
      if (picked) setScreenshot(picked);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!category) {
      setError("Please choose what the problem is about.");
      return;
    }
    if (!message.trim()) {
      setError("Please describe what happened.");
      return;
    }

    setBusy(true);
    try {
      await complaintsApi.create({
        category,
        message: message.trim(),
        screenshot,
      });
      AppAlert.alert(
        "Thanks — we have it",
        "Your report has gone to the support team. You can follow it under Help & support.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const remaining = MAX_MESSAGE - message.length;

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Text style={styles.iconBtnText}>←</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Report a problem</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            Tell us what went wrong in the app and we will look into it.
          </Text>

          <Text style={styles.label}>What is it about?</Text>
          <View style={styles.chipWrap}>
            {COMPLAINT_CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>What happened?</Text>
          <TextInput
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, MAX_MESSAGE))}
            placeholder="The more detail the better — what you tapped, what you expected, what you saw."
            placeholderTextColor={colors.textMuted}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{remaining} characters left</Text>

          <Text style={styles.label}>Screenshot (optional)</Text>
          {screenshot ? (
            <View style={styles.shotWrap}>
              <Image source={{ uri: screenshot }} style={styles.shot} resizeMode="contain" />
              <Pressable onPress={() => setScreenshot(null)} style={styles.shotRemove}>
                <Text style={styles.shotRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onAttach} style={styles.attachBtn}>
              <Text style={styles.attachIcon}>🖼️</Text>
              <Text style={styles.attachText}>Attach a screenshot</Text>
            </Pressable>
          )}

          <Text style={styles.note}>
            Your app version and phone model are sent along with this so we can
            reproduce the problem. Your location is not.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={[styles.submit, busy && styles.submitBusy]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.submitText}>Send report</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
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
    iconBtnText: { fontSize: 20, color: colors.text },
    appBarTitle: { fontSize: 18, fontWeight: "800", color: colors.text },

    content: { padding: 16, paddingBottom: 48, gap: 8 },
    lead: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },

    label: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },

    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    chipTextActive: { color: colors.textOnAccent },

    textArea: {
      minHeight: 140,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: 15,
      color: colors.text,
    },
    counter: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "right",
      marginTop: 6,
    },

    attachBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    attachIcon: { fontSize: 18 },
    attachText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },

    shotWrap: {
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shot: { width: "100%", height: 220, backgroundColor: colors.surfaceContrast },
    shotRemove: { padding: 12, alignItems: "center" },
    shotRemoveText: { fontSize: 13, fontWeight: "700", color: colors.danger },

    note: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 16,
    },

    error: {
      marginTop: 14,
      fontSize: 13,
      color: colors.danger,
      fontWeight: "600",
    },

    submit: {
      marginTop: 20,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    submitBusy: { opacity: 0.7 },
    submitText: { fontSize: 16, fontWeight: "800", color: colors.textOnAccent },
  });
}
