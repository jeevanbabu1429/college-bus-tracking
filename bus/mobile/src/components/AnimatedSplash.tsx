import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import LottieView from "lottie-react-native";

type Props = {
  // Fired when the Lottie animation reaches its final frame. The parent
  // hides the native splash + swaps to the real app UI.
  onFinish: () => void;
};

// Full-screen splash overlay. Plays the rastreo Lottie once, then fades out.
// The "BusBee" wordmark under the animation is styled to match the yellow
// accent used across the mobile app.
export function AnimatedSplash({ onFinish }: Props) {
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(10)).current;

  // Fade the wordmark in shortly after the animation kicks off — feels less
  // "poster-y" than everything appearing on frame 0.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        duration: 700,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkTranslate, {
        toValue: 0,
        duration: 700,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [wordmarkOpacity, wordmarkTranslate]);

  return (
    <View style={styles.container as ViewStyle}>
      <LottieView
        source={require("../../assets/rastreo.json")}
        autoPlay
        loop={false}
        onAnimationFinish={onFinish}
        resizeMode="contain"
        style={styles.animation}
      />
      <Animated.Text
        style={[
          styles.wordmark,
          {
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslate }],
          },
        ]}
      >
        BusBee
      </Animated.Text>
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslate }],
          },
        ]}
      >
        Track every ride, live.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Matches expo.splash.backgroundColor in app.json so the native → JS
    // handoff has no visible flash.
    backgroundColor: "#0e0e10",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  animation: {
    width: 280,
    height: 280,
  },
  wordmark: {
    marginTop: 8,
    fontSize: 40,
    fontWeight: "800",
    color: "#f5b700",
    letterSpacing: 2,
    textAlign: "center",
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#a3a3a8",
    letterSpacing: 1,
    textAlign: "center",
  },
});
