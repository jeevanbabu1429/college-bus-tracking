import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  appVersionApi,
  installedVersion,
  storeUrl,
  type UpdateCheck,
} from "../api/appVersion";
import { useTheme, type Colors } from "../theme/ThemeContext";

// "Please update" and "You must update", set by the super admin in the
// console. Checked when the app opens and each time it comes back to the
// foreground, so raising the minimum reaches people on their next launch
// without waiting for a release.
//
// A required update has no way past it. An optional one has Later, and saying
// Later settles it until the app is next opened — not a popup every time they
// switch back from Maps.

export function UpdateGate() {
  const { colors } = useTheme();
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const skippedRef = useRef(false);

  const run = useCallback(async () => {
    const result = await appVersionApi.check();
    if (result.action === "none") {
      setCheck(null);
      return;
    }
    // Someone who tapped Later is asked again only once the app is required
    // to update, never for the same optional nudge.
    if (result.action === "optional" && skippedRef.current) return;
    setCheck(result);
  }, []);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => sub.remove();
  }, [run]);

  if (!check) return null;

  const required = check.action === "required";
  const styles = makeStyles(colors);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android's back button dismisses a modal by default; a required
      // update must not have a way around it.
      onRequestClose={() => {
        if (!required) dismiss();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>↑</Text>
          </View>

          <Text style={styles.title}>
            {required ? "Update required" : "Update available"}
          </Text>

          <Text style={styles.body}>
            {required
              ? "This version of Busszo is too old to keep using. Update to carry on."
              : "A newer version of Busszo is ready. Updating takes a moment."}
          </Text>

          {check.latest ? (
            <Text style={styles.versions}>
              You have {installedVersion()} · latest is {check.latest}
            </Text>
          ) : null}

          <Pressable
            onPress={openStore}
            accessibilityRole="button"
            style={({ pressed }) => [styles.update, pressed && styles.pressed]}
          >
            <Text style={styles.updateText}>Update now</Text>
          </Pressable>

          {!required && (
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              style={({ pressed }) => [styles.later, pressed && styles.pressed]}
            >
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );

  function dismiss() {
    skippedRef.current = true;
    setCheck(null);
  }

  function openStore() {
    Linking.openURL(storeUrl()).catch(() => {
      // No store app and no browser: nothing useful to say, and the popup
      // stays where it is so they can try again.
    });
  }
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 26,
      alignItems: "center",
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    iconText: { fontSize: 26, fontWeight: "800", color: "#b37f00" },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
    },
    versions: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 10,
      textAlign: "center",
    },
    update: {
      alignSelf: "stretch",
      marginTop: 22,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    updateText: { fontSize: 16, fontWeight: "700", color: colors.textOnAccent },
    later: {
      alignSelf: "stretch",
      marginTop: 10,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
    },
    laterText: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
    pressed: { opacity: 0.85 },
  });
}
