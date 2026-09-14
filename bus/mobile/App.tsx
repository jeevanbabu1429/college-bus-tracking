import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "./src/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useFcmRegistration } from "./src/notifications/useFcmRegistration";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import { AlertHost } from "./src/components/AppAlert";
import { BannerModal } from "./src/components/BannerModal";
import { AndroidNavigationBar } from "./src/components/AndroidNavigationBar";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { useOnboarding } from "./src/onboarding/useOnboarding";

// Keep the native splash visible until we've drawn the animated one — avoids
// a flash of blank/white before the Lottie takes over.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignored: if this fails (already hidden, unsupported env), the JS splash
  // still overlays and the UX is unchanged.
});

function ThemedRoot() {
  const { mode } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const onboarding = useOnboarding();
  useFcmRegistration();

  // Runs once per install, after the splash and before anything else. Gated
  // here rather than inside RootNavigator so the banner poster cannot land on
  // top of it — a promo overlay on someone's first thirty seconds in the app
  // is exactly the wrong first impression.
  const showOnboarding = onboarding.ready && !onboarding.seen;

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {showOnboarding ? (
        <OnboardingScreen onDone={onboarding.markSeen} />
      ) : (
        <RootNavigator />
      )}
      {/* Mounted once rather than per screen: every screen scrolls its
          content under Android's transparent navigation bar, so every screen
          needs the band. Sits above the navigator and below the overlays, so a
          modal still covers the full window. */}
      <AndroidNavigationBar />
      {/* Mounted once, above the navigator, so AppAlert.alert() from anywhere
          (screens, hooks, plain modules) draws the same popup on every OS. */}
      <AlertHost />
      {splashDone && !showOnboarding && <BannerModal />}
      {!splashDone && (
        <AnimatedSplash
          onReady={() => {
            // Drop the native splash the moment the Lottie overlay is on
            // screen. Waiting until onFinish means iOS — where the native
            // splash sits above the React root — shows a frozen still image
            // for the animation's whole run.
            SplashScreen.hideAsync().catch(() => {
              // ignore
            });
          }}
          onFinish={() => setSplashDone(true)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Inside the theme so the crash screen matches light/dark mode, and
            around everything else so no screen can close the app. */}
        <ErrorBoundary>
          <AuthProvider>
            <ThemedRoot />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
