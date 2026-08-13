"use client";

import { useEffect, useRef, useState } from "react";
import { useColleges } from "../lib/college/CollegeContext";
import { SupportContact } from "./SupportContact";
import { IconBuilding } from "./icons";

// Matches PendingApproval's cadence — the admin should not have to reload to
// find out the super admin has cleared their new campus.
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

// Shown in place of the page content when the *selected* college is awaiting
// verification. Unlike PendingApproval this does not take over the whole
// console: the admin's other colleges may be carrying students right now, so
// the sidebar, the switcher and the sign-out all stay reachable, and this
// panel offers a direct jump back to a verified college.
export function PendingCollege() {
  const { selected, colleges, selectCollege, refresh } = useColleges();
  const [checking, setChecking] = useState(false);

  // Held in a ref so the polling effect does not restart whenever the college
  // context produces a new function identity.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

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

  const others = (colleges ?? []).filter(
    (c) => c._id !== selected?._id && c.approved !== false
  );

  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-icon" aria-hidden>
          <IconClock />
        </div>

        <h1 className="pending-title">This college is being verified</h1>

        <p className="pending-text">
          {selected?.name ? <strong>{selected.name}</strong> : "This college"}{" "}
          has been created and our team is reviewing its details.{" "}
          <strong>This usually completes within 24 hours.</strong> You&rsquo;ll
          be able to add its buses, drivers and students as soon as it&rsquo;s
          done.
        </p>

        {selected?.code && (
          <div className="pending-meta">
            <span className="pending-meta-label">College code</span>
            <span className="pending-meta-value">{selected.code}</span>
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

        {others.length > 0 && (
          <div className="pending-switch">
            <span className="pending-switch-label">
              Your other {others.length === 1 ? "college is" : "colleges are"}{" "}
              unaffected — carry on there while you wait:
            </span>
            <div className="pending-switch-list">
              {others.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => selectCollege(c._id)}
                >
                  <IconBuilding />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SupportContact label="Need help or think this is taking too long? Contact support" />
    </div>
  );
}
