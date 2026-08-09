"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth/AuthContext";
import { SupportContact } from "./SupportContact";
import { IconLogout } from "./icons";

// How often the pending dashboard re-reads the admin to see whether the super
// admin has verified them. Without this the admin would sit here until they
// signed out and back in.
const POLL_INTERVAL_MS = 30_000;

function IconClock({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// Shown in place of the entire admin console while an account is awaiting
// verification. Deliberately offers no way into the app: the only actions are
// signing out and contacting support.
export function PendingApproval() {
  const { session, refreshAdmin, logout } = useAuth();
  const admin = session?.admin;
  const [checking, setChecking] = useState(false);

  // Held in a ref so the polling effect does not restart whenever the auth
  // context produces a new function identity.
  const refreshRef = useRef(refreshAdmin);
  refreshRef.current = refreshAdmin;

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (cancelled) return;
      setChecking(true);
      try {
        await refreshRef.current();
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    const timer = setInterval(check, POLL_INTERVAL_MS);
    // Also check the moment the tab regains focus — someone coming back after
    // the approval email should not wait out the remainder of the interval.
    function onFocus() {
      check();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const firstName = (admin?.name ?? "").split(/\s+/)[0] || "there";

  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-icon" aria-hidden>
          <IconClock />
        </div>

        <h1 className="pending-title">Your account is being verified</h1>

        <p className="pending-text">
          Thanks for signing up, {firstName}. Our team is reviewing the details
          you submitted. <strong>This usually completes within 24 hours.</strong>{" "}
          You&rsquo;ll be able to add your colleges, buses and drivers as soon as
          it&rsquo;s done.
        </p>

        {admin?.adminId && (
          <div className="pending-meta">
            <span className="pending-meta-label">Your admin ID</span>
            <span className="pending-meta-value">{admin.adminId}</span>
          </div>
        )}

        <div className="pending-status" role="status" aria-live="polite">
          <span
            className={`pending-dot${checking ? " pending-dot-active" : ""}`}
            aria-hidden
          />
          <span>
            {checking
              ? "Checking for an update…"
              : "This page updates automatically — no need to refresh."}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary pending-signout"
          onClick={logout}
        >
          <IconLogout size={15} />
          <span>Sign out</span>
        </button>
      </div>

      <SupportContact label="Need help or think this is taking too long? Contact support" />
    </div>
  );
}
