import { notificationsApi } from "../api/notifications";
import { getFcmToken } from "./fcm";

/**
 * Hands this device's push token back before the session ends.
 *
 * Must be called while the auth token is still set: `apiFetch` reads the
 * bearer synchronously when it is called, so releasing after the session has
 * been cleared sends an unauthenticated request that just 401s.
 *
 * Best effort. If it fails the account keeps the token until someone signs in
 * on this phone again, at which point the server takes it off the old owner —
 * that server-side handover is what actually guarantees one device is only
 * ever registered to one person.
 *
 * Lives in its own module rather than in useFcmRegistration so AuthContext can
 * import it without the two forming a cycle.
 */
export async function releaseDeviceToken(): Promise<void> {
  try {
    const token = await getFcmToken();
    if (token) await notificationsApi.unregisterToken(token);
  } catch {
    // Signing out must never fail because a notification server did.
  }
}
