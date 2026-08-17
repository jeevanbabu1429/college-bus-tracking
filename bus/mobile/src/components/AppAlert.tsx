import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme, type Colors } from "../theme/ThemeContext";

// One popup for every OS. This replaces React Native's `Alert.alert`, whose
// look is drawn by Android/iOS and therefore differs per platform. Same call
// signature as `Alert.alert(title, message?, buttons?, options?)`, so switching
// a call site is just renaming `Alert` → `AppAlert`.
//
// It works from anywhere — components, hooks, plain modules — because the
// trigger is a module-level function backed by a single <AlertHost /> mounted
// at the app root, rather than a hook you have to thread through the tree.

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
};

export type AlertOptions = {
  /** When false, tapping the backdrop / Android back does nothing. */
  cancelable?: boolean;
  /** Fired when dismissed by backdrop / back rather than a button. */
  onDismiss?: () => void;
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

// Set by the mounted host; the public API is a no-op (with a dev warning) until
// then, mirroring how a missing provider would behave.
let enqueue: ((cfg: AlertConfig) => void) | null = null;

export const AppAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    if (enqueue) enqueue({ title, message, buttons, options });
    else if (__DEV__)
      console.warn("AppAlert.alert called before <AlertHost /> mounted");
  },
};

const OK_ONLY: AlertButton[] = [{ text: "OK", style: "default" }];

export function AlertHost() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  // A queue so a second alert() raised while one is open shows after it,
  // matching the native behaviour rather than clobbering the first.
  const [queue, setQueue] = useState<AlertConfig[]>([]);
  const current = queue[0] ?? null;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enqueue = (cfg) => setQueue((q) => [...q, cfg]);
    return () => {
      enqueue = null;
    };
  }, []);

  // Animate the card in whenever a new one reaches the front of the queue.
  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [current, anim]);

  // Fade the card out, then drop it from the queue and run the button's
  // callback — the native Alert also fires onPress after the dialog closes.
  const advance = useCallback(
    (after?: () => void) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setQueue((q) => q.slice(1));
        after?.();
      });
    },
    [anim]
  );

  const onBackdrop = useCallback(() => {
    if (!current || current.options?.cancelable === false) return;
    const btns = current.buttons?.length ? current.buttons : OK_ONLY;
    // A lone button (e.g. "OK → go back") should still run on backdrop tap so a
    // dismiss doesn't silently skip its action. With a choice, the backdrop is
    // "cancel": the cancel button if there is one, otherwise just close.
    if (btns.length === 1) {
      advance(btns[0].onPress);
    } else {
      const cancel = btns.find((b) => b.style === "cancel");
      advance(() => {
        cancel?.onPress?.();
        current.options?.onDismiss?.();
      });
    }
  }, [current, advance]);

  // Route the Android hardware back button through the same path as the
  // backdrop while a dialog is up, so it dismisses the dialog, not the screen.
  useEffect(() => {
    if (!current) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackdrop();
      return true;
    });
    return () => sub.remove();
  }, [current, onBackdrop]);

  if (!current) return null;

  const buttons = current.buttons?.length ? current.buttons : OK_ONLY;
  // Two side by side reads cleanly; three or more get their own full-width row.
  const stacked = buttons.length > 2;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onBackdrop}
    >
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && (
            <Text style={styles.message}>{current.message}</Text>
          )}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";
              return (
                <Pressable
                  key={`${btn.text}-${i}`}
                  onPress={() => advance(btn.onPress)}
                  style={({ pressed }) => [
                    styles.button,
                    stacked && styles.buttonStacked,
                    isCancel
                      ? styles.buttonCancel
                      : isDestructive
                      ? styles.buttonDestructive
                      : styles.buttonDefault,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel
                        ? styles.buttonTextCancel
                        : isDestructive
                        ? styles.buttonTextDestructive
                        : styles.buttonTextDefault,
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingTop: 26,
      paddingBottom: 18,
      paddingHorizontal: 22,
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 16,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    message: {
      color: colors.textMuted,
      fontSize: 14.5,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 8,
    },
    buttons: {
      flexDirection: "row",
      gap: 10,
      marginTop: 22,
    },
    buttonsStacked: {
      flexDirection: "column",
    },
    button: {
      flex: 1,
      height: 50,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    buttonStacked: {
      flex: 0,
      width: "100%",
    },
    buttonDefault: {
      backgroundColor: colors.accent,
    },
    buttonDestructive: {
      backgroundColor: colors.danger,
    },
    buttonCancel: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    buttonPressed: {
      opacity: 0.82,
    },
    buttonText: {
      fontSize: 15.5,
      fontWeight: "700",
    },
    buttonTextDefault: {
      color: colors.textOnAccent,
    },
    buttonTextDestructive: {
      color: "#ffffff",
    },
    buttonTextCancel: {
      color: colors.text,
    },
  });
}
