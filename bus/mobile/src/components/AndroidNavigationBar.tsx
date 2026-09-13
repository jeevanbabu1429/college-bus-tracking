import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import { useTheme } from "../theme/ThemeContext";

/**
 * Makes Android's navigation bar disappear into the page, the way iOS has no
 * such bar to begin with.
 *
 * Two things were making it stand out, and both had to go:
 *
 * 1. The app draws edge-to-edge — AppTheme sets no `navigationBarColor`, so the
 *    bar is transparent and a scroll view runs underneath it. A section heading
 *    would sit half-visible behind the back and home buttons. The band below
 *    covers that inset in the screen's own background colour, so content is
 *    hidden rather than showing through. Padding cannot do this: the screens
 *    already pad their scroll content by `insets.bottom`, which only makes the
 *    *last* item clear the bar — everything in between still scrolls under it.
 *
 * 2. Android then painted its own translucent scrim on top to keep the buttons
 *    legible, which is what left a grey strip across the bottom whatever the
 *    app drew. That scrim is off now (`android:enforceNavigationBarContrast`
 *    in res/values/styles.xml), so the band shows its true colour — which
 *    means the app has taken on the job the scrim was doing, and has to set the
 *    button colour itself. That is the effect below, and it follows the in-app
 *    dark-mode switch rather than the system theme, because that switch is what
 *    decides the colour actually behind the buttons.
 *
 * Renders nothing where there is no bottom inset to fill: iOS, and Android
 * devices using gesture navigation.
 */
export function AndroidNavigationBar() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    // `setStyle` names the *bar's* appearance, not the button colour — it maps
    // "light" to dark buttons and "dark" to white ones (see
    // navigationBarStyleToButtonStyle in the module). So the app's own mode is
    // exactly the right value to hand it.
    NavigationBar.setStyle(mode);
  }, [mode]);

  if (Platform.OS !== "android" || insets.bottom === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: insets.bottom,
        backgroundColor: colors.background,
      }}
    />
  );
}
