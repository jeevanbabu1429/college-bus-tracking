"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSuperAuth } from "../../../lib/super-auth/SuperAuthContext";
import { EXPIRED_MESSAGE_KEY } from "../../../lib/api/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { ready, token, login } = useSuperAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ready && token) router.replace("/super-admin/dashboard");
  }, [ready, token, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const e = sessionStorage.getItem(EXPIRED_MESSAGE_KEY);
      if (e) {
        setExpiredMessage(e);
        sessionStorage.removeItem(EXPIRED_MESSAGE_KEY);
      }
    } catch {
      // sessionStorage disabled
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/super-admin/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "linear-gradient(180deg, #1a1d29 0%, #23212e 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 22,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,.45)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#d13a3a",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            margin: "0 auto 16px",
            boxShadow: "0 6px 16px rgba(209,58,58,.4)",
          }}
        >
          S
        </div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            margin: 0,
            textAlign: "center",
            color: "#1a1d29",
          }}
        >
          Super Admin
        </h1>
        <p
          style={{
            margin: "6px 0 24px",
            textAlign: "center",
            color: "#6a6e7a",
            fontSize: 13,
          }}
        >
          Product-owner console. Sign in with email &amp; password.
        </p>

        {expiredMessage && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fff4e5",
              border: "1px solid #f0c98a",
              color: "#92400e",
              fontWeight: 600,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 2 }}>
              Session expired
            </div>
            {expiredMessage}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="super-email">
              Email
            </label>
            <input
              id="super-email"
              className="field-control"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="superadmin@gmail.com"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="super-password">
              Password
            </label>
            <input
              id="super-password"
              className="field-control"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            style={{
              width: "100%",
              marginTop: 16,
              background: "#d13a3a",
              color: "#fff",
              fontWeight: 700,
            }}
            disabled={busy}
          >
            {busy ? <span className="spinner spinner-light" /> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
