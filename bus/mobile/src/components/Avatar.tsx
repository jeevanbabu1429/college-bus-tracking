import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { Colors } from "../theme/ThemeContext";

// One avatar for every surface that shows a person: the driver's own profile,
// the driver card on the student dashboard, and the admin's driver list.
//
// Photos arrive two different ways depending on the screen, so both are
// supported:
//   `dataUrl` — the photo is already in hand (admin list responses embed it)
//   `source`  — an authenticated remote image (see driverPhotoSource)
//
// Whichever is used, a failed or absent photo falls back to initials rather
// than a broken-image box. That fallback is load-bearing: the photo endpoint
// answers 404 for a driver who has not set one, which is the normal case.
export type AvatarProps = {
  colors: Colors;
  /** Drives the initials fallback. */
  name?: string | null;
  dataUrl?: string | null;
  source?: { uri: string; headers: Record<string, string> } | null;
  size?: number;
  /** Fallback glyph when there is no name to derive initials from. */
  fallback?: string;
  /**
   * Rendered instead of initials when there is no photo. Lets a surface keep
   * its existing empty-state look (the student bus card uses an emoji) while
   * still gaining photo support.
   */
  fallbackNode?: ReactNode;
  /**
   * Colour of the initials fallback. Defaults to the on-accent colour, which
   * suits the default accent-filled circle; surfaces that override the
   * background must override this too or the initials can vanish in dark mode.
   */
  initialsColor?: string;
  /**
   * Fires with whether a real photo (rather than the fallback) is on screen.
   * Lets a parent gate behaviour on it — the student dashboard uses this so
   * tapping an initials circle does not open an empty photo viewer.
   */
  onPhotoAvailable?: (available: boolean) => void;
  style?: ViewStyle;
};

function initialsOf(name: string | undefined | null, fallback: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  colors,
  name,
  dataUrl,
  source,
  size = 64,
  fallback = "?",
  fallbackNode,
  initialsColor,
  onPhotoAvailable,
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // A new photo (or a different person) deserves a fresh attempt — otherwise
  // one 404 would suppress the image for the rest of the screen's life.
  useEffect(() => {
    setFailed(false);
  }, [dataUrl, source?.uri]);

  const imageSource = dataUrl ? { uri: dataUrl } : source ?? null;
  const showImage = !!imageSource && !failed;

  // Held in a ref so an inline arrow from the parent does not re-fire the
  // effect on every render.
  const availableRef = useRef(onPhotoAvailable);
  availableRef.current = onPhotoAvailable;
  useEffect(() => {
    availableRef.current?.(showImage);
  }, [showImage]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accent,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={imageSource}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : fallbackNode ? (
        fallbackNode
      ) : (
        <Text
          style={{
            color: initialsColor ?? colors.textOnAccent,
            fontSize: Math.round(size * 0.36),
            fontWeight: "700",
          }}
        >
          {initialsOf(name, fallback)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
