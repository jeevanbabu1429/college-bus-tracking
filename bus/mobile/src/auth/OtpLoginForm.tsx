import { useMemo, useRef, useState, type ReactNode } from "react";
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

type Role = "admin" | "student" | "driver";

type Props = {
  title: string;
  role?: Role;
  onBack: () => void;
  requestOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  footer?: ReactNode;
};

const ACCENT = "#f5b700";
const OTP_LENGTH = 4;
const MOBILE_LENGTH = 10;

// Role-specific hero copy. Falls back to the "student" flavour when a caller
// doesn't pass `role` (a few legacy places don't yet).
const ROLE_META: Record<Role, { icon: string; hint: string }> = {
  student: {
    icon: "S",
    hint: "You'll land straight on your bus tracker.",
  },
  driver: {
    icon: "D",
    hint: "You'll land on the trip controls for your assigned bus.",
  },
  admin: {
    icon: "A",
    hint: "You'll land on your fleet dashboard.",
  },
};

function maskMobile(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return raw;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export function OtpLoginForm({
  title,
  role,
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

  const meta = useMemo(() => ROLE_META[role ?? "student"], [role]);

  async function onRequestOtp() {
    setError(null);
    setInfo(null);
    if (mobile.trim().length !== MOBILE_LENGTH) {
      setError("Enter your 10-digit mobile number");
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
      setInfo("New code sent.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(value: string) {
    setError(null);
    if (value.trim().length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code`);
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
      {/* ── Hero panel ────────────────────────────────────── */}
      <View style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>←</Text>
        </Pressable>

        <View style={styles.heroContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{meta.icon}</Text>
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <View style={styles.stepPill}>
            <Text style={styles.stepText}>
              Step {step === "mobile" ? "1" : "2"} of 2
            </Text>
          </View>
        </View>
      </View>

      {/* ── White card ────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.cardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "mobile" ? (
            // ───── Step 1: Mobile ─────────────────────────
            <>
              <Text style={styles.stepHeading}>What&apos;s your mobile?</Text>
              <Text style={styles.stepBody}>
                We&apos;ll text you a 4-digit code to confirm it&apos;s you.
                Use the number your college admin registered.
              </Text>

              <Text style={styles.label}>Mobile number</Text>
              <View
                style={[
                  styles.fieldRow,
                  mobile.length === MOBILE_LENGTH && styles.fieldRowFilled,
                ]}
              >
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  value={mobile}
                  onChangeText={(t) => {
                    const digits = t
                      .replace(/\D/g, "")
                      .slice(0, MOBILE_LENGTH);
                    setMobile(digits);
                    if (digits.length === MOBILE_LENGTH) Keyboard.dismiss();
                  }}
                  keyboardType="phone-pad"
                  maxLength={MOBILE_LENGTH}
                  placeholder="10-digit mobile"
                  placeholderTextColor="#bbb"
                  style={styles.field}
                  autoFocus
                />
                {mobile.length === MOBILE_LENGTH && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.fieldHint}>
                We never share your number. It&apos;s only used to log you in.
              </Text>
            </>
          ) : (
            // ───── Step 2: OTP ────────────────────────────
            <>
              <Text style={styles.stepHeading}>Enter the code</Text>
              <Text style={styles.stepBody}>
                We sent a 4-digit code to{" "}
                <Text style={styles.mobileMask}>{maskMobile(mobile)}</Text>. It
                arrives in a few seconds.
              </Text>

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
                <Pressable onPress={onResendOtp} hitSlop={8}>
                  <Text style={styles.linkMuted}>Resend code</Text>
                </Pressable>
                <View style={styles.linkDot} />
                <Pressable
                  onPress={() => {
                    setStep("mobile");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.linkAccent}>Change mobile</Text>
                </Pressable>
              </View>

              <Text style={styles.otpTrivia}>{meta.hint}</Text>
            </>
          )}

          {/* Feedback */}
          {error && <Text style={styles.error}>{error}</Text>}
          {info && !error && <Text style={styles.info}>{info}</Text>}

          {/* Primary CTA */}
          {busy ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 28 }} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                step === "mobile" &&
                  mobile.length !== MOBILE_LENGTH &&
                  styles.primaryDisabled,
              ]}
              onPress={step === "mobile" ? onRequestOtp : onVerifyOtp}
              disabled={step === "mobile" && mobile.length !== MOBILE_LENGTH}
            >
              <Text style={styles.primaryText}>
                {step === "mobile" ? "Send code" : "Verify & sign in"}
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

  // ─── Hero panel ────────────────────────────────────────────────
  hero: {
    height: 260,
    backgroundColor: ACCENT,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#111", fontSize: 20, fontWeight: "800" },
  heroContent: { alignItems: "center", marginTop: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarText: { color: "#111", fontSize: 26, fontWeight: "900" },
  heroTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.3,
  },
  stepPill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  stepText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.5,
  },

  // ─── White card ────────────────────────────────────────────────
  cardWrap: { flex: 1, marginTop: -40 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  cardContent: {
    paddingTop: 32,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  // ─── Step body ─────────────────────────────────────────────────
  stepHeading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.4,
  },
  stepBody: {
    fontSize: 13,
    color: "#666",
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 24,
  },
  mobileMask: { fontWeight: "800", color: "#111" },

  // ─── Mobile input ──────────────────────────────────────────────
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#666",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#fafafa",
  },
  fieldRowFilled: {
    borderColor: ACCENT,
    backgroundColor: "#fff8df",
  },
  countryCode: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  field: {
    flex: 1,
    fontSize: 16,
    color: "#111",
    paddingVertical: 4,
    fontWeight: "600",
  },
  checkmark: {
    fontSize: 16,
    color: "#2e7d32",
    fontWeight: "800",
  },
  fieldHint: {
    fontSize: 11,
    color: "#888",
    marginTop: 8,
    marginLeft: 4,
  },

  // ─── OTP boxes ─────────────────────────────────────────────────
  otpWrap: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    position: "relative",
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
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
    borderWidth: 2.5,
    backgroundColor: "#fff",
  },
  otpDigit: { fontSize: 24, fontWeight: "800", color: "#111" },
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
    alignItems: "center",
    marginTop: 18,
    gap: 10,
  },
  linkDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#ccc",
  },
  linkMuted: { color: "#666", fontSize: 13, fontWeight: "700" },
  linkAccent: { color: "#111", fontSize: 13, fontWeight: "800" },

  otpTrivia: {
    marginTop: 20,
    fontSize: 12,
    color: "#888",
    lineHeight: 17,
  },

  // ─── Feedback ──────────────────────────────────────────────────
  error: {
    color: "#c0392b",
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
    fontSize: 13,
  },
  info: {
    color: "#2e7d32",
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
    fontSize: 13,
  },

  // ─── Primary CTA ───────────────────────────────────────────────
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
  primaryPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  primaryDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  primaryText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  footerWrap: { marginTop: 22, alignItems: "center" },
});
