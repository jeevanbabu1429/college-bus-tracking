"use client";

import { useState } from "react";
import { superAdminApi } from "../../../../lib/api/superAdmin";

// Verification control for a college. An admin's first college is cleared by
// their account verification; every one after that lands here, and until it is
// approved the API refuses its buses, drivers and students — see the API's
// lib/approval.ts.
//
// Not optimistic, for the same reason as the admin ApprovalControl: this is
// the moment a campus goes live, so it waits for the server rather than
// showing a state that might be rolled back a moment later.
export function CollegeApprovalControl({
  collegeId,
  approved,
  onChange,
}: {
  collegeId: string;
  /** undefined means a college from before the field existed. */
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
      await superAdminApi.setCollegeApproved(collegeId, next);
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
          title="Move this college back to pending verification"
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
        title={error ?? "Verify this college and let its admin operate it"}
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}
