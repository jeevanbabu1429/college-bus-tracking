import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { Colors } from "../theme/ThemeContext";

// Lightweight confirmation toast — a dark floating pill that slides up, holds
// briefly, then fades out on its own.
//
// Deliberately not Alert.alert: confirming a photo change is a "you did the
// thing" acknowledgement, not something worth a modal the user must dismiss.
// Errors still use Alert, because those need attention and often carry an
// instruction ("enable photo access in Settings").
//
// Controlled by the parent: pass a message to show it, and clear that state in
// `onHide`. Passing a new message while one is visible restarts the animation.
export type ToastVariant = "success" | "error";

export type ToastProps = {
  colors: Colors;
  /** null hides the toast. */
  message: string | null;
  onHide: () => void;
  variant?: ToastVariant;
  /** Clearance above whatever floats at the bottom of the screen. */
  bottomOffset?: number;
  durationMs?: number;
};

export function Toast({
  colors,
  message,
  onHide,
  variant = "success",
  bottomOffset = 96,
  durationMs = 2400,
}: ToastProps) {
  const anim = useRef(new Animated.Value(0)).current;

  // Held in a ref so an inline arrow from the parent cannot restart the
  // animation on every render.
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    if (!message) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    anim.setValue(0);

    const showIn = Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    showIn.start(({ finished }) => {
      if (!finished) return;
      timer = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished: out }) => {
          if (out) onHideRef.current();
        });
      }, durationMs);
    });

    return () => {
      if (timer) clearTimeout(timer);
      anim.stopAnimation();
    };
  }, [message, durationMs, anim]);

  if (!message) return null;

  const isError = variant === "error";

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          bottom: bottomOffset,
          backgroundColor: colors.bottomBarBg,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          { backgroundColor: isError ? colors.danger : "#22c55e" },
        ]}
      >
        <Text style={styles.badgeIcon}>{isError ? "!" : "✓"}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIcon: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  // The pill is dark in both themes (it matches the floating tab bar), so the
  // text colour is a literal rather than a theme token.
  message: {
    flex: 1,
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "600",
  },
});
