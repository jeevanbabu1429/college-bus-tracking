import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

function ThemedRoot() {
  const { mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
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
