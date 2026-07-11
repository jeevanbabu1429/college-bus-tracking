import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  title: string;
  onBack: () => void;
  requestOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  footer?: ReactNode;
};

const ACCENT = "#f5b700";
const OTP_LENGTH = 4;
const MOBILE_LENGTH = 10;

export function OtpLoginForm({
  title,
  onBack,
  requestOtp,
  verifyOtp,
  footer,
}: Props) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);

  async function onRequestOtp() {
    setError(null);
    setInfo(null);
    if (!mobile.trim()) {
      setError("Enter your mobile number");
      return;
    }
    setBusy(true);
    try {
      await requestOtp(mobile.trim());
      setStep("otp");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResendOtp() {
    setError(null);
    setInfo(null);
    setOtp("");
    setBusy(true);
    try {
      await requestOtp(mobile.trim());
      setInfo("OTP resent. Check the API server terminal.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Extracted so both the manual Login tap and the auto-submit path can call
  // it with a fresh OTP value (avoids the state-timing pitfall).
  async function submitOtp(value: string) {
    setError(null);
    if (value.trim().length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(mobile.trim(), value.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp() {
    await submitOtp(otp);
  }

  return (
    <View style={styles.root}>
      <View style={styles.topPanel}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
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
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.subheading}>{title}</Text>

          <Text style={styles.label}>Mobile number</Text>
          <View
            style={[
              styles.fieldRow,
              step !== "mobile" && styles.fieldRowDisabled,
            ]}
          >
            <Text style={styles.fieldIcon}>📱</Text>
            <TextInput
              value={mobile}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, MOBILE_LENGTH);
                setMobile(digits);
                if (digits.length === MOBILE_LENGTH) Keyboard.dismiss();
              }}
              editable={step === "mobile"}
              keyboardType="phone-pad"
              maxLength={MOBILE_LENGTH}
              placeholder="10-digit mobile"
              placeholderTextColor="#bbb"
              style={styles.field}
            />
          </View>

          {step === "otp" && (
            <>
              <Text style={styles.label}>OTP</Text>
              <Pressable
                onPress={() => otpInputRef.current?.focus()}
                style={styles.otpWrap}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                  const digit = otp[i] ?? "";
                  const isActive = otp.length === i;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        digit !== "" && styles.otpBoxFilled,
                        isActive && styles.otpBoxActive,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
                <TextInput
                  ref={otpInputRef}
                  value={otp}
                  onChangeText={(t) => {
                    const digits = t.replace(/\D/g, "").slice(0, OTP_LENGTH);
                    setOtp(digits);
                    if (digits.length === OTP_LENGTH) {
                      Keyboard.dismiss();
                      if (!busy) submitOtp(digits);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  autoFocus
                  caretHidden
                  style={styles.otpHiddenInput}
                />
              </Pressable>
              <View style={styles.linksRow}>
                <Pressable onPress={onResendOtp}>
                  <Text style={styles.linkMuted}>Resend OTP</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setStep("mobile");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  <Text style={styles.linkAccent}>Change mobile</Text>
                </Pressable>
              </View>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          {busy ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 28 }} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
              ]}
              onPress={step === "mobile" ? onRequestOtp : onVerifyOtp}
            >
              <Text style={styles.primaryText}>
                {step === "mobile" ? "Send OTP" : "Login"}
              </Text>
            </Pressable>
          )}

          {footer && <View style={styles.footerWrap}>{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ACCENT },
  topPanel: {
    height: 220,
    backgroundColor: ACCENT,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
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
  cardContent: {
    paddingTop: 36,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  heading: { fontSize: 32, fontWeight: "700", color: "#111" },
  subheading: { fontSize: 14, color: "#888", marginTop: 4, marginBottom: 24 },
  label: {
    fontSize: 13,
    color: "#444",
    marginTop: 18,
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
  fieldRowDisabled: { opacity: 0.6 },
  fieldIcon: { fontSize: 16 },
  field: {
    flex: 1,
    fontSize: 16,
    color: "#111",
    paddingVertical: 4,
  },
  otpWrap: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    position: "relative",
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: {
    borderColor: ACCENT,
    backgroundColor: "#fff8df",
  },
  otpBoxActive: {
    borderColor: ACCENT,
    borderWidth: 2,
    backgroundColor: "#fff",
  },
  otpDigit: { fontSize: 22, fontWeight: "700", color: "#111" },
  otpHiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  linkMuted: { color: "#888", fontSize: 12, fontWeight: "600" },
  linkAccent: { color: ACCENT, fontSize: 12, fontWeight: "700" },
  primary: {
    marginTop: 32,
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
  info: { color: "#2e7d32", marginTop: 16, textAlign: "center" },
  footerWrap: { marginTop: 16, alignItems: "center" },
});
