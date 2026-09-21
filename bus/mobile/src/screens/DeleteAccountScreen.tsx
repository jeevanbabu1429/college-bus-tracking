import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "../auth/AuthContext";
import { accountApi } from "../api/account";
import type { SupportRoutes } from "../navigation/types";

const MAX_REASON = 500;
const OTP_LENGTH = 4;

// Deleting your own account, from inside the app.
//
// Registered in all three stacks, so it is typed off the shared routes and
// works out what deleting means from the signed-in role rather than from where
// it was pushed.
export function DeleteAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SupportRoutes>>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, logout } = useAuth();

  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = session?.role ?? "student";
  const warning = WARNINGS[role];

  async function onSendCode() {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Please tell us why you are leaving.");
      return;
    }
    setBusy(true);
    try {
      const res = await accountApi.requestDeleteOtp();
      setSentTo(res.mobile);
      setCodeSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onConfirm() {
    if (otp.trim().length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    // Last chance to back out — after this the account is gone for good.
    AppAlert.alert(
      "Delete this account?",
      `${warning.confirm} This cannot be undone.`,
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  }

  async function doDelete() {
    setError(null);
    setBusy(true);
    try {
      await accountApi.delete(reason.trim(), otp.trim());
      // Signing out drops the session, so the app returns to the sign-in
      // screen on its own.
      await logout();
      AppAlert.alert(
        "Account deleted",
        "Your account and its data have been removed. Sorry to see you go."
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const remaining = MAX_REASON - reason.length;

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
        <Text style={styles.appBarTitle}>Delete account</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>{warning.title}</Text>
            {warning.points.map((point) => (
              <Text key={point} style={styles.warnPoint}>
                •  {point}
              </Text>
            ))}
          </View>

          <Text style={styles.label}>Why are you deleting your account?</Text>
          <TextInput
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, MAX_REASON))}
            placeholder="This helps us make Busszo better."
            placeholderTextColor={colors.textMuted}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
            editable={!codeSent && !busy}
          />
          <Text style={styles.counter}>{remaining} characters left</Text>

          {!codeSent ? (
            <Pressable
              onPress={onSendCode}
              disabled={busy}
              style={[styles.primary, busy && styles.primaryBusy]}
            >
              {busy ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.primaryText}>Send code</Text>
              )}
            </Pressable>
          ) : (
            <>
              <Text style={styles.label}>Enter the code</Text>
              <Text style={styles.sentNote}>
                We sent a {OTP_LENGTH}-digit code to {sentTo}.
              </Text>
              <TextInput
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                placeholder="----"
                placeholderTextColor={colors.textMuted}
                style={styles.otpInput}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus
              />

              <Pressable
                onPress={onConfirm}
                disabled={busy}
                style={[styles.danger, busy && styles.primaryBusy]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerText}>Delete my account</Text>
                )}
              </Pressable>

              <Pressable
                onPress={onSendCode}
                disabled={busy}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>Send a new code</Text>
              </Pressable>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.note}>
            We keep only the reason you gave, with your name and mobile number,
            so we can answer questions about the deletion later.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const WARNINGS: Record<
  "admin" | "driver" | "student",
  { title: string; points: string[]; confirm: string }
> = {
  admin: {
    title: "This deletes your college too",
    points: [
      "Every college you own is removed, with its buses, routes and stops.",
      "Every driver and student you added is removed with it.",
      "Your staff lose access to the web console.",
    ],
    confirm: "Your colleges, buses, drivers and students will all be deleted.",
  },
  driver: {
    title: "This removes you from your bus",
    points: [
      "Your account, photo and trip history are removed.",
      "The bus keeps its route and students, but has no driver until your college assigns one.",
      "Your college is told that you deleted your account.",
    ],
    confirm: "Your driver account will be deleted.",
  },
  student: {
    title: "This removes your seat on the bus",
    points: [
      "Your account and your place on the bus are removed.",
      "You stop getting alerts about your bus.",
      "Your college is told that you deleted your account.",
    ],
    confirm: "Your student account will be deleted.",
  },
};

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

    content: { padding: 16, paddingBottom: 48 },

    warnCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 8,
    },
    warnTitle: { fontSize: 15, fontWeight: "800", color: colors.danger },
    warnPoint: { fontSize: 13, lineHeight: 20, color: colors.textMuted },

    label: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    textArea: {
      minHeight: 110,
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
    sentNote: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
    otpInput: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: 10,
      textAlign: "center",
      color: colors.text,
    },

    primary: {
      marginTop: 20,
      borderRadius: 14,
      paddingVertical: 15,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    primaryBusy: { opacity: 0.7 },
    primaryText: { fontSize: 16, fontWeight: "700", color: colors.textOnAccent },

    danger: {
      marginTop: 20,
      borderRadius: 14,
      paddingVertical: 15,
      backgroundColor: colors.danger,
      alignItems: "center",
    },
    dangerText: { fontSize: 16, fontWeight: "700", color: "#fff" },

    linkBtn: { marginTop: 12, paddingVertical: 10, alignItems: "center" },
    linkText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },

    error: {
      marginTop: 14,
      fontSize: 13,
      lineHeight: 19,
      color: colors.danger,
    },
    note: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 20,
    },
  });
}
