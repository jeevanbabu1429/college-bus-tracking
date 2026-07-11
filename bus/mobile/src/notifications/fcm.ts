import { NativeModules, Platform, PermissionsAndroid } from "react-native";

// react-native-firebase is a native module that requires a custom dev build —
// it does NOT work in Expo Go. If the native RNFBAppModule isn't present, we
// must NOT even `import` the messaging library at the top of this file — its
// initialization touches the missing native module and crashes the whole JS
// runtime at bundle-load time (before any guard could run). So we require it
// lazily below, only when we know the module is there.
const NOOP_UNSUB = () => {};
export const isFcmAvailable = !!NativeModules.RNFBAppModule;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messaging = any;
let messaging: Messaging | null = null;

if (isFcmAvailable) {
  // Deferred require avoids evaluating the module in Expo Go / any env where
  // the native side wasn't linked.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  messaging = require("@react-native-firebase/messaging").default;
} else if (__DEV__) {
  console.info(
    "[fcm] @react-native-firebase native module not present — skipping. " +
      "This is expected in Expo Go. Use a dev build (expo run:android) to test push."
  );
}

// Android 13+ needs the runtime POST_NOTIFICATIONS permission. iOS and
// older Androids route through messaging().requestPermission() directly.
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isFcmAvailable || !messaging) return false;
  if (Platform.OS === "android" && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      // RN's typed enum doesn't always carry POST_NOTIFICATIONS depending on
      // version, so we go via the string constant.
      "android.permission.POST_NOTIFICATIONS" as never
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function getFcmToken(): Promise<string | null> {
  if (!isFcmAvailable || !messaging) return null;
  try {
    const token = await messaging().getToken();
    return token || null;
  } catch (err) {
    console.warn("[fcm] getToken failed:", err);
    return null;
  }
}

export function onTokenRefresh(handler: (token: string) => void) {
  if (!isFcmAvailable || !messaging) return NOOP_UNSUB;
  return messaging().onTokenRefresh(handler);
}

export function onForegroundMessage(
  handler: (msg: unknown) => void
) {
  if (!isFcmAvailable || !messaging) return NOOP_UNSUB;
  return messaging().onMessage(handler);
}
