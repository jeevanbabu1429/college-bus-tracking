import { apiFetch } from "./client";

export const notificationsApi = {
  registerToken(token: string) {
    return apiFetch<{ ok: true; fcmReady: boolean }>(
      "/api/notifications/register-token",
      { method: "POST", body: JSON.stringify({ token }) }
    );
  },
  unregisterToken(token: string) {
    return apiFetch<{ ok: true }>("/api/notifications/unregister-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  sendTest(input?: { title?: string; body?: string }) {
    return apiFetch<{ ok: true; delivered: number }>(
      "/api/notifications/test",
      { method: "POST", body: JSON.stringify(input ?? {}) }
    );
  },
};
