import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type MessagePayload,
} from "firebase/messaging";
import { getFirebaseApp, vapidKey } from "./config";

const SW_PATH = "/firebase-messaging-sw.js";

// Ensures our service worker is registered exactly once and returns the
// registration. FCM will reuse it (it auto-detects /firebase-messaging-sw.js)
// but registering ourselves lets us control the scope + verify support early.
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, {
    scope: "/",
    updateViaCache: "none",
  });
}

export type FcmReadyState =
  | { ready: false; reason: "unsupported" | "not-configured" | "denied" }
  | { ready: true; token: string };

// Asks the browser for permission (if not already granted), registers the SW,
// and returns the FCM device token. Idempotent — safe to call on every login.
export async function requestFcmToken(): Promise<FcmReadyState> {
  if (typeof window === "undefined") return { ready: false, reason: "unsupported" };
  if (!(await isSupported())) return { ready: false, reason: "unsupported" };

  const app = getFirebaseApp();
  if (!app || !vapidKey) return { ready: false, reason: "not-configured" };

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return { ready: false, reason: "denied" };
  } else if (Notification.permission !== "granted") {
    return { ready: false, reason: "denied" };
  }

  const swRegistration = await getServiceWorkerRegistration();
  if (!swRegistration) return { ready: false, reason: "unsupported" };

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });
  if (!token) return { ready: false, reason: "denied" };
  return { ready: true, token };
}

// Subscribe to foreground messages. The browser does NOT show a notification
// for these automatically — the consumer (a React component) decides how to
// render them (e.g. as an in-app toast).
export function subscribeForeground(
  handler: (payload: MessagePayload) => void
): () => void {
  const app = getFirebaseApp();
  if (!app) return () => {};
  const messaging = getMessaging(app);
  return onMessage(messaging, handler);
}
