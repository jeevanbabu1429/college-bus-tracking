import { NativeModules, Platform, PermissionsAndroid } from "react-native";
import messaging, {
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";

// react-native-firebase is a native module that requires a custom dev build —
// it does NOT work in Expo Go. We detect that here and turn every export into
// a no-op so the rest of the app keeps running while you iterate over the QR.
// Once you switch to `expo run:android` / a dev client, this flips on by itself.
const NOOP_UNSUB = () => {};
export const isFcmAvailable = !!NativeModules.RNFBAppModule;
if (!isFcmAvailable && __DEV__) {
  console.info(
    "[fcm] @react-native-firebase native module not present — skipping. " +
      "This is expected in Expo Go. Use a dev build (expo run:android) to test push."
  );
}

// Android 13+ needs the runtime POST_NOTIFICATIONS permission. iOS and
// older Androids route through messaging().requestPermission() directly.
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isFcmAvailable) return false;
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
  if (!isFcmAvailable) return null;
  try {
    const token = await messaging().getToken();
    return token || null;
  } catch (err) {
    console.warn("[fcm] getToken failed:", err);
    return null;
  }
}

export function onTokenRefresh(handler: (token: string) => void) {
  if (!isFcmAvailable) return NOOP_UNSUB;
  return messaging().onTokenRefresh(handler);
}

export function onForegroundMessage(
  handler: (msg: FirebaseMessagingTypes.RemoteMessage) => void
) {
  if (!isFcmAvailable) return NOOP_UNSUB;
  return messaging().onMessage(handler);
}
