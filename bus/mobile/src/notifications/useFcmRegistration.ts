import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { notificationsApi } from "../api/notifications";
import {
  ensureNotificationPermission,
  getFcmToken,
  onForegroundMessage,
  onTokenRefresh,
} from "./fcm";

// Drives the FCM lifecycle from auth state:
//   - signed in  -> ask permission, get token, send to backend
//   - signed out -> unregister the last token we sent
//   - token rotates while signed in -> re-register
//
// Foreground messages get an Alert so they're visible while the app is open
// (Android/iOS only show OS banners when the app is backgrounded).
export function useFcmRegistration() {
  const { token: authToken } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!authToken) {
        const dead = registeredTokenRef.current;
        if (dead) {
          registeredTokenRef.current = null;
          try {
            await notificationsApi.unregisterToken(dead);
          } catch {
            // best effort
          }
        }
        return;
      }

      const allowed = await ensureNotificationPermission();
      if (!allowed || cancelled) return;

      const fcmToken = await getFcmToken();
      if (!fcmToken || cancelled) return;
      if (registeredTokenRef.current === fcmToken) return;

      registeredTokenRef.current = fcmToken;
      try {
        await notificationsApi.registerToken(fcmToken);
      } catch (err) {
        console.warn("[fcm] registerToken failed:", err);
        registeredTokenRef.current = null;
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Handle FCM rotating the device token on us mid-session.
  useEffect(() => {
    if (!authToken) return;
    const unsub = onTokenRefresh(async (next) => {
      registeredTokenRef.current = next;
      try {
        await notificationsApi.registerToken(next);
      } catch (err) {
        console.warn("[fcm] re-register on refresh failed:", err);
      }
    });
    return unsub;
  }, [authToken]);

  // Foreground messages — no OS banner, so surface them ourselves.
  useEffect(() => {
    const unsub = onForegroundMessage((raw) => {
      const msg = raw as { notification?: { title?: string; body?: string } };
      const title = msg.notification?.title ?? "Notification";
      const body = msg.notification?.body ?? "";
      Alert.alert(title, body);
    });
    return unsub;
  }, []);
}
