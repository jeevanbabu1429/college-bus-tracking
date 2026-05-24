"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth/AuthContext";
import { OtpLoginForm } from "../../components/OtpLoginForm";

export default function LoginPage() {
  const router = useRouter();
  const { ready, token, requestOtp, verifyOtp } = useAuth();

  useEffect(() => {
    if (ready && token) router.replace("/dashboard");
  }, [ready, token, router]);

  return (
    <div className="auth-page">
      <main className="auth-form-wrap">
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
