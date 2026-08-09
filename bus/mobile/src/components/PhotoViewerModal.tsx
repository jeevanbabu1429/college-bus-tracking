import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";

// Full-screen viewer for a profile photo. Built for the student tapping their
// driver's avatar on the bus card — a 36px circle is enough to spot a familiar
// face, not enough to recognise an unfamiliar one.
//
// Follows BannerModal's conventions: dark backdrop, tap-outside to dismiss,
// explicit close button, and Android back handled via onRequestClose.
export type PhotoViewerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Either an already-loaded data URL or an authenticated remote source. */
  dataUrl?: string | null;
  source?: { uri: string; headers: Record<string, string> } | null;
  /** Shown under the photo — whose face this is. */
  caption?: string | null;
  subtitle?: string | null;
};

export function PhotoViewerModal({
  visible,
  onClose,
  dataUrl,
  source,
  caption,
  subtitle,
}: PhotoViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const imageSource = dataUrl ? { uri: dataUrl } : source ?? null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow taps on the card itself so only the backdrop dismisses. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.imageWrap}>
            {imageSource && (
              <Image
                source={imageSource}
                style={styles.image}
                resizeMode="cover"
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                accessibilityIgnoresInvertColors
              />
            )}
            {loading && (
              <View style={styles.loader}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {failed && (
              <View style={styles.loader}>
                <Text style={styles.subtitle}>Photo unavailable</Text>
              </View>
            )}
          </View>

          {(caption || subtitle) && (
            <View style={styles.captionWrap}>
              {!!caption && <Text style={styles.caption}>{caption}</Text>}
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityLabel="Close photo"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#111",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  imageWrap: {
    width: "100%",
    // Photos are stored as 256px squares, so a square frame shows the whole
    // crop with no letterboxing.
    aspectRatio: 1,
    backgroundColor: "#111",
  },
  image: { width: "100%", height: "100%" },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  captionWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#111",
  },
  caption: { color: "#fff", fontSize: 16, fontWeight: "700" },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 26,
  },
});
