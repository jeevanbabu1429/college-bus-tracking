"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth/AuthContext";
import type { Gender } from "../../lib/api/auth";
import { IconCheck } from "../../components/icons";

const PRICE = 90;

const INCLUDED = [
  "Unlimited colleges, buses and drivers",
  "Live driver location for students",
  "Routes, stops and seat assignments",
  "Email and chat support",
];

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <span className="spinner" />
        </div>
      }
    >
      <PaymentInner />
    </Suspense>
  );
}

function PaymentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { register } = useAuth();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  const name = params.get("name") ?? "";
  const gender = (params.get("gender") ?? "") as Gender;
  const dob = params.get("dob") ?? "";
  const mobile = params.get("mobile") ?? "";
  const email = params.get("email") ?? "";

  async function onPay() {
    if (paid || busy) return;
    setError(null);
    setBusy(true);
    setPaid(true);
    try {
      const admin = await register({ name, gender, dob, mobile, email });
      setAdminId(admin.adminId);
    } catch (e) {
      setPaid(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (adminId) {
    return (
      <div className="auth-page">
        <main className="auth-form-wrap">
          <div className="auth-card text-center">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "var(--success-soft)",
                color: "var(--success)",
                margin: "0 auto 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheck size={28} />
            </div>
            <h1 className="auth-heading">Payment successful</h1>
            <p className="auth-subheading" style={{ marginTop: 8 }}>
              Welcome aboard, {name.split(" ")[0] || "admin"}. Your admin ID is{" "}
              <strong style={{ color: "var(--text)" }}>{adminId}</strong>.
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={() => router.replace("/login")}
            >
              Go to sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <main className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark">B</span>
            <span className="auth-brand-title">Bus Admin</span>
          </div>

          <h1 className="auth-heading">Activate your account</h1>
          <p className="auth-subheading">
            A single one-time payment unlocks the console for life.
          </p>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              marginBottom: 18,
              background: "var(--surface-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                }}
              >
                $
              </span>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--text)",
                  lineHeight: 1,
                }}
              >
                {PRICE}
              </span>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                · billed once
              </span>
            </div>
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              Lifetime access — no subscriptions, no surprises.
            </p>
          </div>

          <ul style={{ listStyle: "none", display: "grid", gap: 10 }}>
            {INCLUDED.map((t) => (
              <li
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--text-soft)",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "var(--success-soft)",
                    color: "var(--success)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconCheck size={12} />
                </span>
                {t}
              </li>
            ))}
          </ul>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 18 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 22 }}
            onClick={onPay}
            disabled={busy || paid}
          >
            {busy ? (
              <span className="spinner spinner-light" />
            ) : paid ? (
              "Paid"
            ) : (
              `Pay $${PRICE} and continue`
            )}
          </button>

          <p
            className="small muted text-center"
            style={{ marginTop: 14 }}
          >
            By paying you agree to the terms of service.
          </p>
        </div>
      </main>
    </div>
  );
}
