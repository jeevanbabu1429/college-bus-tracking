"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth/AuthContext";
import type { CollegeChoice } from "../../lib/api/staffAuth";
import { OtpLoginForm } from "../../components/OtpLoginForm";
import { SupportContact } from "../../components/SupportContact";
import {
  EXPIRED_MESSAGE_KEY,
  SUSPENDED_MESSAGE_KEY,
} from "../../lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, session, requestOtp, verifyOtp, chooseCollege } = useAuth();
  // Set when one mobile turns out to be staff at more than one college:
  // the code is right, but we still need to know which console to open.
  const [choices, setChoices] = useState<CollegeChoice[] | null>(null);
  const [pending, setPending] = useState<{ mobile: string; otp: string } | null>(
    null
  );
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    // Staff go where their role says. Dropping someone on a dashboard their
    // role cannot read would greet them with a permission notice every time
    // they sign in.
    const landing =
      session?.role === "staff"
        ? session.staff.role?.landingPage || "/dashboard"
        : "/dashboard";
    router.replace(landing);
  }, [ready, token, session, router]);

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
        {choices ? (
          <div className="auth-card">
            <h1 className="auth-heading">Which college?</h1>
            <p className="auth-subheading">
              You have access to more than one. Pick the one to open.
            </p>
            {chooseError && (
              <div className="alert alert-error" style={{ marginTop: 14 }}>
                {chooseError}
              </div>
            )}
            <div className="pending-switch-list" style={{ marginTop: 16 }}>
              {choices.map((choice) => (
                <button
                  key={choice.staffId}
                  type="button"
                  className="btn btn-secondary"
                  disabled={choosing !== null}
                  onClick={async () => {
                    if (!pending) return;
                    setChoosing(choice.staffId);
                    setChooseError(null);
                    try {
                      await chooseCollege(
                        pending.mobile,
                        pending.otp,
                        choice.staffId
                      );
                    } catch (e) {
                      setChooseError((e as Error).message);
                      setChoosing(null);
                    }
                  }}
                >
                  {choosing === choice.staffId ? (
                    <span className="spinner" />
                  ) : (
                    <span>
                      {choice.collegeName}
                      {choice.collegeCode ? ` · ${choice.collegeCode}` : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <OtpLoginForm
          title="Sign in"
          subtitle="We’ll send a one-time code to your registered mobile."
          requestOtp={requestOtp}
          verifyOtp={async (mobile, otp) => {
            const options = await verifyOtp(mobile, otp);
            if (options) {
              setPending({ mobile, otp });
              setChoices(options);
            }
          }}
          footer={
            <span className="muted">
              Don’t have an account?{" "}
              <Link href="/register" className="auth-link">
                Create one
              </Link>
            </span>
          }
        />
        )}
        <SupportContact />
        <p className="small muted" style={{ textAlign: "center", marginTop: 14 }}>
          <Link href="/" className="auth-link">
            &larr; Back to the BusBee site
          </Link>
        </p>
      </main>
    </div>
  );
}
