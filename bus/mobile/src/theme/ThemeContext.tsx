import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "bus.theme";

export type ThemeMode = "light" | "dark";

export type Colors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceContrast: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  border: string;
  accent: string;
  accentSoft: string;
  danger: string;
  bottomBarBg: string;
  bottomBarInactive: string;
  statsBg: string;
  statsLabel: string;
};

const LIGHT: Colors = {
  background: "#f5f4f7",
  surface: "#ffffff",
  surfaceMuted: "#fafafa",
  surfaceContrast: "#f6f6f6",
  text: "#111111",
  textMuted: "#888888",
  textOnAccent: "#111111",
  border: "#f0f0f0",
  accent: "#f5b700",
  accentSoft: "#fff5cc",
  danger: "#c0392b",
  bottomBarBg: "#111111",
  bottomBarInactive: "#9aa0a6",
  statsBg: "#111111",
  statsLabel: "#9aa0a6",
};

const DARK: Colors = {
  background: "#0e0e10",
  surface: "#1b1b1f",
  surfaceMuted: "#222226",
  surfaceContrast: "#26262b",
  text: "#f5f5f5",
  textMuted: "#a3a3a8",
  textOnAccent: "#111111",
  border: "#2a2a30",
  accent: "#f5b700",
  accentSoft: "#3a2e00",
  danger: "#ef5350",
  bottomBarBg: "#1b1b1f",
  bottomBarInactive: "#7a7a80",
  statsBg: "#000000",
  statsLabel: "#a3a3a8",
};

type ThemeContextValue = {
  mode: ThemeMode;
  colors: Colors;
  setMode: (m: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === "dark" || stored === "light") setModeState(stored);
    })();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await SecureStore.setItemAsync(THEME_KEY, m);
  }, []);

  const toggle = useCallback(async () => {
    const next: ThemeMode = mode === "light" ? "dark" : "light";
    await setMode(next);
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? DARK : LIGHT,
      setMode,
      toggle,
    }),
    [mode, setMode, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
