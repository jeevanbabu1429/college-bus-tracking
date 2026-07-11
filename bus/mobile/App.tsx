import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "./src/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useFcmRegistration } from "./src/notifications/useFcmRegistration";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import { BannerModal } from "./src/components/BannerModal";

// Keep the native splash visible until we've drawn the animated one — avoids
// a flash of blank/white before the Lottie takes over.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignored: if this fails (already hidden, unsupported env), the JS splash
  // still overlays and the UX is unchanged.
});

function ThemedRoot() {
  const { mode } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  useFcmRegistration();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
      {splashDone && <BannerModal />}
      {!splashDone && (
        <AnimatedSplash
          onFinish={() => {
            SplashScreen.hideAsync().catch(() => {
              // ignore
            });
            setSplashDone(true);
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedRoot />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
