"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth/AuthContext";
import { notificationsApi } from "../lib/api/notifications";
import { requestFcmToken, subscribeForeground } from "../lib/firebase/messaging";
import { isFirebaseConfigured } from "../lib/firebase/config";

type Toast = { id: number; title: string; body: string };

// Mounted once near the root. Registers a device token after the admin logs
// in, unregisters on logout, and shows foreground push payloads as toasts.
export function FcmManager() {
  const { token: authToken } = useAuth();
  const registeredTokenRef = useRef<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Register a token whenever an auth session appears, unregister when it
  // disappears. We track the token we registered so we can hand it back to
  // /unregister-token on logout.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;

    async function sync() {
      if (!authToken) {
        const dead = registeredTokenRef.current;
        if (dead) {
          registeredTokenRef.current = null;
          try {
            await notificationsApi.unregisterToken(dead);
          } catch {
            // best effort — user is logging out anyway
          }
        }
        return;
      }

      const state = await requestFcmToken();
      if (cancelled) return;
      if (!state.ready) {
        if (state.reason === "denied") {
          console.info("[fcm] notification permission denied");
        }
        return;
      }
      if (registeredTokenRef.current === state.token) return;
      registeredTokenRef.current = state.token;
      try {
        await notificationsApi.registerToken(state.token);
      } catch (err) {
        console.error("[fcm] registerToken failed:", err);
        registeredTokenRef.current = null;
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Foreground messages — Firebase delivers a payload but does NOT show a
  // browser notification (that's by design; the tab is already open). We
  // render an in-app toast instead.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsubscribe = subscribeForeground((payload) => {
      const title = payload.notification?.title ?? "Notification";
      const body = payload.notification?.body ?? "";
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, body }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 9999,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            background: "#1a1d29",
            color: "#fff",
            padding: "14px 16px",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,.2)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <strong style={{ fontSize: 14 }}>{t.title}</strong>
          {t.body && <span style={{ fontSize: 13, opacity: 0.85 }}>{t.body}</span>}
        </div>
      ))}
    </div>
  );
}
