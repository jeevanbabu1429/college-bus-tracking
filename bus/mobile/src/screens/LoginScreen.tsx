import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { OtpLoginForm } from "../auth/OtpLoginForm";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type Role = "admin" | "student" | "driver";

type RoleCard = {
  key: Role;
  title: string;
  tagline: string;
  description: string;
  perks: string[];
  bg: string;
  iconBg: string;
  iconText: string;
  iconColor: string;
};

const ROLES: RoleCard[] = [
  {
    key: "student",
    title: "Student",
    tagline: "Ride to class, stress-free",
    description:
      "See your bus live on the map, get told when it's near, and know if your stop is closed today.",
    perks: ["Live tracking", "Stop suspension alerts", "Route info"],
    bg: "#ece6ff",
    iconBg: "#fff",
    iconText: "S",
    iconColor: "#5b3df7",
  },
  {
    key: "driver",
    title: "Driver",
    tagline: "Share your route in one tap",
    description:
      "Start a trip and your live location is shared with every student assigned to your bus.",
    perks: ["One-tap start", "Real-time location", "Route notice"],
    bg: "#ffe8d9",
    iconBg: "#fff",
    iconText: "D",
    iconColor: "#e0742a",
  },
  {
    key: "admin",
    title: "Admin",
    tagline: "Run your fleet from anywhere",
    description:
      "Add buses, assign drivers to routes, enrol students, and watch live status across every trip.",
    perks: ["Bus & driver CRUD", "Route editor", "Live dashboard"],
    bg: "#dbe7ff",
    iconBg: "#fff",
    iconText: "A",
    iconColor: "#1f4dff",
  },
];

export function LoginScreen({ navigation, route }: Props) {
  const {
    adminRequestOtp,
    adminVerifyOtp,
    driverRequestOtp,
    driverVerifyOtp,
    studentRequestOtp,
    studentVerifyOtp,
    suspendedMessage,
    clearSuspendedMessage,
    expiredMessage,
    clearExpiredMessage,
  } = useAuth();
  const [role, setRole] = useState<Role | null>(route.params?.role ?? null);

  if (role === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Session banners */}
          {suspendedMessage && (
            <View style={styles.suspendedBanner}>
              <Text style={styles.suspendedTitle}>Account suspended</Text>
              <Text style={styles.suspendedBody}>{suspendedMessage}</Text>
              <Pressable
                onPress={clearSuspendedMessage}
                style={styles.dismissBtn}
                hitSlop={10}
              >
                <Text style={styles.suspendedDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          )}
          {!suspendedMessage && expiredMessage && (
            <View style={styles.expiredBanner}>
              <Text style={styles.expiredTitle}>Session expired</Text>
              <Text style={styles.expiredBody}>{expiredMessage}</Text>
              <Pressable
                onPress={clearExpiredMessage}
                style={styles.dismissBtn}
                hitSlop={10}
              >
                <Text style={styles.expiredDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          )}

          {/* Brand + hero */}
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>🐝</Text>
            </View>
            <Text style={styles.brandName}>BusBee</Text>
          </View>

          <Text style={styles.heroTitle}>Welcome aboard</Text>
          <Text style={styles.heroSubtitle}>
            Track your college bus in real time. Reach class on time, every day.
          </Text>

          <View style={styles.accentBar} />

          <Text style={styles.sectionLabel}>Sign in as</Text>
          <Text style={styles.sectionHint}>
            Pick your role to receive a one-time code on your mobile.
          </Text>

          {/* Role cards */}
          {ROLES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRole(r.key)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: r.bg },
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: r.iconBg }]}>
                <Text style={[styles.iconText, { color: r.iconColor }]}>
                  {r.iconText}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  <Text style={styles.chevron}></Text>
                </View>
                <Text style={styles.cardTagline}>{r.tagline}</Text>
                <Text style={styles.cardDescription}>{r.description}</Text>
                <View style={styles.perksRow}>
                  {r.perks.map((p) => (
                    <View key={p} style={styles.perkChip}>
                      <Text style={styles.perkText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
          ))}

          {/* Footer help block */}
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>Need help getting started?</Text>
            <Text style={styles.helpBody}>
              Your college admin creates your account and adds you to a bus.
              Once you&apos;re added, sign in with the mobile number they
              registered.
            </Text>
          </View>

          <Text style={styles.tos}>
            By continuing you agree to receive one-time login codes on your
            registered mobile.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role === "student") {
    return (
      <OtpLoginForm
        title="Student sign in"
        role="student"
        onBack={() => setRole(null)}
        requestOtp={studentRequestOtp}
        verifyOtp={studentVerifyOtp}
      />
    );
  }

  if (role === "driver") {
    return (
      <OtpLoginForm
        title="Driver sign in"
        role="driver"
        onBack={() => setRole(null)}
        requestOtp={driverRequestOtp}
        verifyOtp={driverVerifyOtp}
      />
    );
  }

  return (
    <OtpLoginForm
      title="Admin sign in"
      role="admin"
      onBack={() => setRole(null)}
      requestOtp={adminRequestOtp}
      verifyOtp={adminVerifyOtp}
      footer={
        <Pressable
          onPress={() => navigation.navigate("Register")}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>
            New admin? <Text style={styles.linkAccent}>Sign up</Text>
          </Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 40 },

  // ─── Brand ─────────────────────────────────────────────────────
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff8df",
    borderWidth: 1,
    borderColor: "#f5b700",
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: { fontSize: 20 },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#111",
  },

  // ─── Hero copy ──────────────────────────────────────────────────
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  accentBar: {
    height: 4,
    width: 44,
    borderRadius: 2,
    backgroundColor: "#f5b700",
    marginBottom: 26,
  },

  // ─── Section header ────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#888",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionHint: { fontSize: 13, color: "#888", marginBottom: 16 },

  // ─── Role cards ────────────────────────────────────────────────
  card: {
    flexDirection: "row",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    alignItems: "flex-start",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconText: { fontSize: 24, fontWeight: "800" },
  cardBody: { flex: 1 },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: "#111" },
  chevron: { fontSize: 22, color: "#111", fontWeight: "500" },
  cardTagline: {
    fontSize: 13,
    color: "#111",
    fontWeight: "700",
    marginTop: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: "#333",
    lineHeight: 17,
    marginTop: 4,
  },
  perksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  perkChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  perkText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 0.3,
  },

  // ─── Footer help ───────────────────────────────────────────────
  helpCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff8df",
    borderWidth: 1,
    borderColor: "#f0e0a3",
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
    marginBottom: 6,
  },
  helpBody: {
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
  },
  tos: {
    marginTop: 16,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 12,
  },

  // ─── OTP form footer link (admin only) ─────────────────────────
  linkBtn: { marginTop: 8, alignItems: "center" },
  linkText: { color: "#666", fontSize: 13 },
  linkAccent: { color: "#f5b700", fontWeight: "700" },

  // ─── Session banners ───────────────────────────────────────────
  suspendedBanner: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fdecec",
    borderWidth: 1,
    borderColor: "#f5c2c2",
  },
  suspendedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#8f1d1d",
    marginBottom: 6,
  },
  suspendedBody: {
    fontSize: 13,
    color: "#8f1d1d",
    fontWeight: "600",
    lineHeight: 19,
  },
  suspendedDismissText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8f1d1d",
    textDecorationLine: "underline",
  },
  expiredBanner: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fff4e5",
    borderWidth: 1,
    borderColor: "#f0c98a",
  },
  expiredTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#92400e",
    marginBottom: 6,
  },
  expiredBody: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "600",
    lineHeight: 19,
  },
  expiredDismissText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
    textDecorationLine: "underline",
  },
  dismissBtn: { marginTop: 10, alignSelf: "flex-start" },
});
