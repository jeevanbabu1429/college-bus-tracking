import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type Colors } from "../theme/ThemeContext";

type Slide = {
  key: string;
  animation: ReturnType<typeof require>;
  /**
   * The animation's own width/height ratio, taken from the Lottie file. The
   * art box is sized from this so each one fills its space properly instead
   * of being letterboxed inside a square.
   */
  aspect: number;
  /** Share of the slide width the art occupies. */
  widthPct: `${number}%`;
  /** Rendered in the accent colour, inline with the rest of the title. */
  titleAccent?: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "track",
    animation: require("../../assets/onboarding/school-bus-driving.json"),
    aspect: 1, // 1000x1000
    widthPct: "84%",
    titleAccent: "Track",
    title: "your bus live",
    body: "See exactly where your college bus is on a live map, every morning.",
  },
  {
    key: "alerts",
    animation: require("../../assets/onboarding/guy-with-phone.json"),
    aspect: 1, // 1080x1080
    widthPct: "80%",
    titleAccent: "Never",
    title: "miss your stop",
    body: "Get an alert when the bus is one stop away, so you are ready to board.",
  },
  {
    key: "roles",
    animation: require("../../assets/onboarding/connect.json"),
    aspect: 270 / 118, // markedly wider than the other two
    widthPct: "92%",
    titleAccent: "Everyone",
    title: "in one place",
    body: "Admins manage routes and drivers. Students just open the app and go.",
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = makeStyles(colors);

  const scrollRef = useRef<ScrollView>(null);
  const lottieRefs = useRef<(LottieView | null)[]>([]);
  const [index, setIndex] = useState(0);

  // Only the visible animation runs. All three are mounted by the pager, and
  // looping the offscreen ones would burn CPU and battery for nothing.
  useEffect(() => {
    lottieRefs.current.forEach((ref, i) => {
      if (!ref) return;
      if (i === index) ref.play();
      else ref.pause();
    });
  }, [index]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Round rather than floor so a half-swipe that snaps back does not
      // leave the dots on the wrong slide.
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex((prev) => (prev === next ? prev : next));
    },
    [width]
  );

  const isLast = index === SLIDES.length - 1;

  const advance = useCallback(() => {
    if (isLast) {
      onDone();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    // Set immediately so the button label and dots do not lag the animation.
    setIndex(next);
  }, [isLast, index, width, onDone]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.skipRow}>
        {!isLast && (
          <Pressable onPress={onDone} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View style={styles.artPanel}>
              {/* The soft band the artwork sits on, as in the design. */}
              <View style={styles.artBand} />
              <LottieView
                ref={(ref) => {
                  lottieRefs.current[i] = ref;
                }}
                source={slide.animation}
                // The effect above drives playback; autoPlay covers the first
                // slide in case it mounts before that effect runs.
                autoPlay={i === 0}
                loop
                resizeMode="contain"
                style={{ width: slide.widthPct, aspectRatio: slide.aspect }}
              />
            </View>

            <View style={styles.copy}>
              <Text style={styles.title}>
                {!!slide.titleAccent && (
                  <Text style={styles.titleAccent}>{slide.titleAccent} </Text>
                )}
                {slide.title}
              </Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={advance}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>
            {isLast ? "Get started" : "Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },

    skipRow: {
      height: 44,
      paddingHorizontal: 20,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    skipBtn: { paddingVertical: 6, paddingHorizontal: 8 },
    skipText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },

    pager: { flex: 1 },
    slide: { flex: 1, alignItems: "center" },

    artPanel: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    artBand: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "42%",
      height: "34%",
      backgroundColor: colors.accentSoft,
    },

    copy: {
      paddingHorizontal: 34,
      paddingTop: 8,
      paddingBottom: 18,
      alignItems: "center",
    },
    title: {
      fontSize: 25,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
      letterSpacing: -0.4,
    },
    titleAccent: { color: colors.accent },
    body: {
      marginTop: 12,
      fontSize: 14.5,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
    },

    dots: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingBottom: 22,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    // The active dot stretches into a pill, as in the design.
    dotActive: {
      width: 22,
      backgroundColor: colors.accent,
    },

    footer: { paddingHorizontal: 24 },
    cta: {
      height: 54,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    ctaText: {
      fontSize: 15.5,
      fontWeight: "800",
      color: colors.textOnAccent,
      letterSpacing: 0.2,
    },
  });
}
