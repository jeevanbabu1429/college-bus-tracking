"use client";

import { useState } from "react";
import { superAdminApi } from "../../../../lib/api/superAdmin";

// Verification control for a new signup. Until this is approved the admin can
// sign in and see their dashboard but every action is refused server-side —
// see the API's lib/approval.ts.
//
// Not optimistic, unlike SuspensionToggle: approving is the moment a customer
// gets access, so it waits for the server rather than showing a state that
// might be rolled back a moment later.
export function ApprovalControl({
  adminId,
  approved,
  onChange,
}: {
  adminId: string;
  /** undefined means a legacy admin from before the field existed. */
  approved: boolean | undefined;
  onChange: (next: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = approved === false;

  async function set(next: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await superAdminApi.setAdminApproved(adminId, next);
      onChange(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!pending) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="pill pill-success">Verified</span>
        <button
          type="button"
          className="btn btn-quiet small"
          onClick={() => set(false)}
          disabled={busy}
          title="Move this admin back to pending verification"
        >
          {busy ? "…" : "Revoke"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="pill pill-warning">Pending</span>
      <button
        type="button"
        className="btn btn-primary small"
        onClick={() => set(true)}
        disabled={busy}
        title={error ?? "Verify this admin and give them access"}
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}
