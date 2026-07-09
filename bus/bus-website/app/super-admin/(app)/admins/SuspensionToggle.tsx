"use client";

import { useState } from "react";
import { superAdminApi } from "../../../../lib/api/superAdmin";

// Small toggle switch. Suspended = red. Optimistic — flips immediately, reverts
// on API error. Parent gets `onChange` after the server confirms so the list
// state stays in sync.
export function SuspensionToggle({
  adminId,
  suspended,
  onChange,
}: {
  adminId: string;
  suspended: boolean;
  onChange: (next: boolean) => void;
}) {
  const [local, setLocal] = useState(suspended);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = !local;

  async function toggle() {
    if (busy) return;
    const nextSuspended = !local;
    setLocal(nextSuspended);
    setBusy(true);
    setError(null);
    try {
      await superAdminApi.setAdminSuspended(adminId, nextSuspended);
      onChange(nextSuspended);
    } catch (e) {
      setLocal(!nextSuspended);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8 }}
      title={error ?? (active ? "Active" : "Suspended")}
    >
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={toggle}
        disabled={busy}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          padding: 2,
          border: "none",
          background: active ? "#2e7d32" : "#c62828",
          cursor: busy ? "wait" : "pointer",
          transition: "background 0.15s ease",
          position: "relative",
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
            transform: `translateX(${active ? 18 : 0}px)`,
            transition: "transform 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,.25)",
          }}
        />
      </button>
      <span
        className="small"
        style={{
          fontWeight: 600,
          color: active ? "#2e7d32" : "#c62828",
        }}
      >
        {active ? "Active" : "Suspended"}
      </span>
    </div>
  );
}
