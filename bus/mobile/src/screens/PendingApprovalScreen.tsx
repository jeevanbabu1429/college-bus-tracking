import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";

// How often to re-read the admin to see whether the super admin has verified
// them. Without this the admin would sit here until they signed out and back
// in.
const POLL_INTERVAL_MS = 30_000;

// Shown in place of the entire admin app while a new signup awaits
// verification. Deliberately offers no route into the app — the only actions
// are signing out and calling support.
export function PendingApprovalScreen() {
  const { session, refreshAdmin, logout } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const admin = session?.role === "admin" ? session.admin : null;
  const [checking, setChecking] = useState(false);

  // Held in a ref so the polling effect does not restart on every new
  // function identity from the auth context.
  const refreshRef = useRef(refreshAdmin);
  refreshRef.current = refreshAdmin;

  const check = useCallback(async () => {
    setChecking(true);
    try {
      await refreshRef.current();
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(check, POLL_INTERVAL_MS);
    // Also check when the app returns to the foreground, so someone opening
    // the app after the approval push does not wait out the interval.
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [check]);

  const firstName = (admin?.name ?? "").split(/\s+/)[0] || "there";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>⏳</Text>
        </View>

        <Text style={styles.title}>Your account is being verified</Text>

        <Text style={styles.body}>
          Thanks for signing up, {firstName}. Our team is reviewing the details
          you submitted.{" "}
          <Text style={styles.bodyStrong}>
            This usually completes within 24 hours.
          </Text>{" "}
          You&rsquo;ll be able to add your colleges, buses and drivers as soon as
          it&rsquo;s done.
        </Text>

        {!!admin?.adminId && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Your admin ID</Text>
            <Text style={styles.metaValue}>{admin.adminId}</Text>
          </View>
        )}

        <View style={styles.statusRow}>
          {checking ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <View style={styles.dot} />
          )}
          <Text style={styles.statusText}>
            {checking
              ? "Checking for an update…"
              : "This screen updates automatically."}
          </Text>
        </View>

        <Pressable onPress={check} style={styles.refreshBtn} disabled={checking}>
          <Text style={styles.refreshText}>Check now</Text>
        </Pressable>
      </View>

      <Pressable onPress={logout} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 20,
      paddingTop: 80,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 26,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: 999,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    icon: { fontSize: 30 },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      marginBottom: 10,
    },
    body: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
      textAlign: "center",
    },
    bodyStrong: { color: colors.text, fontWeight: "700" },
    metaRow: {
      marginTop: 20,
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    metaLabel: { fontSize: 12.5, color: colors.textMuted },
    metaValue: { fontSize: 13.5, fontWeight: "800", color: colors.text },
    statusRow: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 20,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
    },
    statusText: { fontSize: 12.5, color: colors.textMuted },
    refreshBtn: {
      marginTop: 18,
      paddingVertical: 11,
      paddingHorizontal: 22,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
    },
    refreshText: { fontSize: 13.5, fontWeight: "700", color: colors.text },
    signOutBtn: { marginTop: 22, alignSelf: "center", padding: 12 },
    signOutText: { fontSize: 13.5, fontWeight: "700", color: colors.danger },
  });
}
