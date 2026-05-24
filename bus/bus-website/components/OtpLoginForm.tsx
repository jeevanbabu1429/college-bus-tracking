"use client";

import { useRef, useState, type ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  requestOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  footer?: ReactNode;
};

const OTP_LENGTH = 4;

export function OtpLoginForm({
  title,
  subtitle,
  requestOtp,
  verifyOtp,
  footer,
}: Props) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  async function onRequestOtp() {
    setError(null);
    setInfo(null);
    if (!mobile.trim()) {
      setError("Enter your mobile number");
      return;
    }
    setBusy(true);
    try {
      await requestOtp(mobile.trim());
      setStep("otp");
      setInfo("OTP sent. Check the API server console.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onResendOtp() {
    setError(null);
    setInfo(null);
    setOtp("");
    setBusy(true);
    try {
      await requestOtp(mobile.trim());
      setInfo("OTP resent. Check the API server console.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp() {
    setError(null);
    if (otp.trim().length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(mobile.trim(), otp.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="auth-brand-mark">B</span>
        <span className="auth-brand-title">Bus Admin</span>
      </div>

      <h1 className="auth-heading">{title}</h1>
      {subtitle && <p className="auth-subheading">{subtitle}</p>}

      <div className="field">
        <label className="field-label">Mobile number</label>
        <input
          className="field-control"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          disabled={step !== "mobile"}
          inputMode="tel"
          placeholder="Enter your 10-digit mobile"
        />
      </div>

      {step === "otp" && (
        <div className="field">
          <label className="field-label">Verification code</label>
          <div
            className="otp-row"
            onClick={() => otpInputRef.current?.focus()}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const digit = otp[i] ?? "";
              const isActive = otp.length === i;
              return (
                <div
                  key={i}
                  className={`otp-box ${digit ? "otp-box-filled" : ""} ${
                    isActive ? "otp-box-active" : ""
                  }`}
                >
                  {digit}
                </div>
              );
            })}
            <input
              ref={otpInputRef}
              className="otp-hidden-input"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
              }
              autoFocus
              inputMode="numeric"
              maxLength={OTP_LENGTH}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="link-action"
              onClick={onResendOtp}
              disabled={busy}
            >
              Resend code
            </button>
            <button
              type="button"
              className="link-action"
              onClick={() => {
                setStep("mobile");
                setOtp("");
                setError(null);
                setInfo(null);
              }}
            >
              Change number
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      {info && !error && (
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          {info}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 22 }}
        onClick={step === "mobile" ? onRequestOtp : onVerifyOtp}
        disabled={busy}
      >
        {busy ? (
          <span className="spinner spinner-light" />
        ) : step === "mobile" ? (
          "Send code"
        ) : (
          "Verify & sign in"
        )}
      </button>

      {footer && (
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
          {footer}
        </div>
      )}
    </div>
  );
}
