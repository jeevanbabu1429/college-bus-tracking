"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth/AuthContext";
import { OtpLoginForm } from "../../components/OtpLoginForm";
import {
  EXPIRED_MESSAGE_KEY,
  SUSPENDED_MESSAGE_KEY,
} from "../../lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, requestOtp, verifyOtp } = useAuth();
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  useEffect(() => {
    if (ready && token) router.replace("/dashboard");
  }, [ready, token, router]);

  // On mount, check whether we were kicked here by a suspension 403 or a 401
  // token-expiry. Read once and clear so a future manual visit doesn't keep
  // showing the banner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = sessionStorage.getItem(SUSPENDED_MESSAGE_KEY);
      if (s) {
        setSuspendedMessage(s);
        sessionStorage.removeItem(SUSPENDED_MESSAGE_KEY);
      }
      const e = sessionStorage.getItem(EXPIRED_MESSAGE_KEY);
      if (e) {
        setExpiredMessage(e);
        sessionStorage.removeItem(EXPIRED_MESSAGE_KEY);
      }
    } catch {
      // sessionStorage disabled — nothing to show
    }
  }, []);

  return (
    <div className="auth-page">
      <main className="auth-form-wrap">
        {suspendedMessage && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#fdecec",
              border: "1px solid #f5c2c2",
              color: "#8f1d1d",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              Account suspended
            </div>
            {suspendedMessage}
          </div>
        )}
        {!suspendedMessage && expiredMessage && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#fff4e5",
              border: "1px solid #f0c98a",
              color: "#92400e",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              Session expired
            </div>
            {expiredMessage}
          </div>
        )}
        <OtpLoginForm
          title="Sign in"
          subtitle="We’ll send a one-time code to your registered mobile."
          requestOtp={requestOtp}
          verifyOtp={verifyOtp}
          footer={
            <span className="muted">
              Don’t have an account?{" "}
              <Link href="/register" className="auth-link">
                Create one
              </Link>
            </span>
          }
        />
      </main>
    </div>
  );
}
