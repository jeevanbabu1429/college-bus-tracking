import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { bannerApi, type PublicBanner } from "../api/banner";

// Full-screen banner modal shown on app open when the super admin has an
// active banner uploaded. Dismissable — reappears on next app open (fresh
// mount + fresh fetch).
export function BannerModal() {
  const [banner, setBanner] = useState<PublicBanner | null | undefined>(
    undefined
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bannerApi
      .getPublic()
      .then((b) => {
        if (!cancelled) setBanner(b);
      })
      .catch(() => {
        if (!cancelled) setBanner(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = !!banner && !dismissed;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={open}
      onRequestClose={() => setDismissed(true)}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => setDismissed(true)}
      >
        {banner && (
          <Pressable style={styles.card} onPress={() => {}}>
            <Image
              source={{ uri: banner.imageDataUrl }}
              style={styles.image}
              resizeMode="contain"
            />
            <Pressable
              onPress={() => setDismissed(true)}
              style={styles.closeBtn}
              hitSlop={12}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 480,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  image: {
    width: "100%",
    height: 480,
    backgroundColor: "#111",
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
