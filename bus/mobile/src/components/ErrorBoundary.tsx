import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

// Catches a crash while drawing any screen. Without it a release build simply
// closes the app; with it the person sees what happened and can carry on.
// Errors in button handlers and network calls are not render crashes — those
// are still handled by each screen.

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) return <CrashScreen onRetry={this.retry} />;
    return this.props.children;
  }
}

function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="alert"
      >
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          This screen ran into a problem. Tap Try again. If it keeps happening,
          close the app and open it again.
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 26, fontWeight: "800", color: "#b37f00" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 22 },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
