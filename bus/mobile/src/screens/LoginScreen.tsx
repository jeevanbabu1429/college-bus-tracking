import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { OtpLoginForm } from "../auth/OtpLoginForm";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

type Role = "admin" | "student" | "driver";

type RoleCard = {
  key: Role;
  title: string;
  subtitle: string;
  caption: string;
  bg: string;
  iconBg: string;
  iconText: string;
  iconColor: string;
};

const ROLES: RoleCard[] = [
  {
    key: "admin",
    title: "Admin",
    subtitle: "Full access",
    caption: "Manage colleges, buses, drivers and students",
    bg: "#dbe7ff",
    iconBg: "#fff",
    iconText: "A",
    iconColor: "#1f4dff",
  },
  {
    key: "student",
    title: "Student",
    subtitle: "Track your ride",
    caption: "See your bus live on the map and your stop",
    bg: "#ece6ff",
    iconBg: "#fff",
    iconText: "S",
    iconColor: "#5b3df7",
  },
  {
    key: "driver",
    title: "Driver",
    subtitle: "Start your trip",
    caption: "Share your live location with students on board",
    bg: "#ffe8d9",
    iconBg: "#fff",
    iconText: "D",
    iconColor: "#e0742a",
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
  } = useAuth();
  const [role, setRole] = useState<Role | null>(route.params?.role ?? null);

  if (role === null) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
      >
        {suspendedMessage && (
          <View style={styles.suspendedBanner}>
            <Text style={styles.suspendedTitle}>Account suspended</Text>
            <Text style={styles.suspendedBody}>{suspendedMessage}</Text>
            <Pressable
              onPress={clearSuspendedMessage}
              style={styles.suspendedDismiss}
              hitSlop={10}
            >
              <Text style={styles.suspendedDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.subheading}>Choose how you'd like to sign in</Text>

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
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardSubtitle}>{r.subtitle}</Text>
              <Text style={styles.cardCaption}>{r.caption}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  if (role === "student") {
    return (
      <OtpLoginForm
        title="Student Login"
        onBack={() => setRole(null)}
        requestOtp={studentRequestOtp}
        verifyOtp={studentVerifyOtp}
      />
    );
  }

  if (role === "driver") {
    return (
      <OtpLoginForm
        title="Driver Login"
        onBack={() => setRole(null)}
        requestOtp={driverRequestOtp}
        verifyOtp={driverVerifyOtp}
      />
    );
  }

  return (
    <OtpLoginForm
      title="Admin Login"
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
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingTop: 72, paddingHorizontal: 20, paddingBottom: 40 },
  heading: { fontSize: 32, fontWeight: "700", color: "#111" },
  subheading: { fontSize: 14, color: "#666", marginTop: 6, marginBottom: 28 },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    gap: 14,
  },
  cardPressed: { opacity: 0.85 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconText: { fontSize: 24, fontWeight: "800" },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#111" },
  cardSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  cardCaption: { fontSize: 11, color: "#888", marginTop: 10 },
  linkBtn: { marginTop: 8, alignItems: "center" },
  linkText: { color: "#666", fontSize: 13 },
  linkAccent: { color: "#f5b700", fontWeight: "700" },
  suspendedBanner: {
    marginBottom: 24,
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
  suspendedDismiss: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  suspendedDismissText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8f1d1d",
    textDecorationLine: "underline",
  },
});
