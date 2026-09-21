"use client";

import { useEffect, useState } from "react";
import { superAdminApi } from "../../../../lib/api/superAdmin";

export default function AccountDeletionPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    superAdminApi
      .getAppSettings()
      .then((s) => setEnabled(s.accountDeletionEnabled))
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [success]);

  // Optimistic — the switch moves on click and rolls back if the save fails.
  async function toggle() {
    if (enabled === null || busy) return;
    const next = !enabled;
    const previous = enabled;
    setEnabled(next);
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await superAdminApi.putAppSettings(next);
      setEnabled(saved.accountDeletionEnabled);
      setSuccess(
        next
          ? "Delete account is shown in the app again. It takes effect the next time someone opens the app."
          : "Delete account is hidden in the app. Remember that the App Store requires it, so switch it back on before the next review."
      );
    } catch (e) {
      setEnabled(previous);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Account deletion</h1>
          <p className="page-subtitle">
            Whether the mobile app offers people a way to delete their own
            account, for every role and every college.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-error" style={{ maxWidth: 720 }}>
          {loadError}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ maxWidth: 720 }}>
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ maxWidth: 720 }}>
          {success}
        </div>
      )}

      {enabled === null && !loadError ? (
        <div className="center" style={{ padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : enabled === null ? null : (
        <div className="card" style={{ maxWidth: 720 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Delete account in the app</div>
              <div
                className="muted small"
                style={{ marginTop: 2, lineHeight: 1.5 }}
              >
                Shows a Delete account option in the profile screen for admins,
                drivers and students. They give a reason, confirm with a code
                sent to their mobile number, and the account is removed.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flex: "none",
              }}
            >
              <span
                className="small"
                style={{
                  fontWeight: 600,
                  color: enabled ? "#2e7d32" : "var(--text-muted)",
                  minWidth: 48,
                  textAlign: "right",
                }}
              >
                {enabled ? "Shown" : "Hidden"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Delete account in the app"
                onClick={toggle}
                disabled={busy}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  padding: 2,
                  border: "none",
                  background: enabled ? "#2e7d32" : "#9ca3af",
                  cursor: busy ? "wait" : "pointer",
                  transition: "background 0.15s ease",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transform: `translateX(${enabled ? 18 : 0}px)`,
                    transition: "transform 0.15s ease",
                    boxShadow: "0 1px 2px rgba(0,0,0,.25)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 720, marginTop: 16 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>
          Before you switch this off
        </div>
        <ul
          className="muted small"
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            lineHeight: 1.55,
          }}
        >
          <li>
            The App Store requires an app that lets people create an account to
            let them delete it in the app. Apple rejected Busszo once for this,
            so treat the switch as an emergency stop, not a setting.
          </li>
          <li>
            While it is off, the option disappears from the app and the server
            refuses deletion requests, telling people to contact support.
          </li>
          <li>
            What deletion removes: an admin loses their colleges, buses,
            drivers and students; a driver leaves their bus without one; a
            student loses their seat. The reason they gave is kept.
          </li>
        </ul>
      </div>
    </>
  );
}
