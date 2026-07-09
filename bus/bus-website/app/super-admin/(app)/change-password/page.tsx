"use client";

import { useEffect, useState } from "react";
import { useSuperAuth } from "../../../../lib/super-auth/SuperAuthContext";

export default function SuperAdminChangePasswordPage() {
  const { changePassword } = useSuperAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setSuccess(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess("Password updated. Use it next time you sign in.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Change password</h1>
          <p className="page-subtitle">
            Rotate the super admin password. Requires the current password.
          </p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 480 }} onSubmit={onSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="cp-current">
            Current password
          </label>
          <input
            id="cp-current"
            className="field-control"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cp-new">
            New password
          </label>
          <input
            id="cp-new"
            className="field-control"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
          <div className="muted small" style={{ marginTop: 6 }}>
            At least 8 characters.
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cp-confirm">
            Confirm new password
          </label>
          <input
            id="cp-confirm"
            className="field-control"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : "Update password"}
          </button>
        </div>
      </form>
    </>
  );
}
