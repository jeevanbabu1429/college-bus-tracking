"use client";

import { useEffect, useState } from "react";
import { IconHelp, IconMail, IconPhone } from "./icons";
import {
  SUPPORT_EMAIL,
  SUPPORT_MOBILE_DISPLAY,
  SUPPORT_TEL,
} from "./SupportContact";

// The dialog on its own, so any trigger can open it (the sidebar link in
// AdminShell, a plain button, …). Same overlay/Escape behaviour as the
// sign-out confirmation.
export function SupportModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        aria-describedby="support-desc"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <h2 id="support-title" className="modal-title">
          Contact support
        </h2>
        <p id="support-desc" className="modal-text" style={{ marginBottom: 16 }}>
          Stuck on something, or need a change made to your account? Reach us
          either way — we usually reply the same working day.
        </p>

        <a href={`mailto:${SUPPORT_EMAIL}`} className="support-row">
          <span className="support-row-icon">
            <IconMail size={16} />
          </span>
          <span className="support-row-text">
            <span className="support-row-label">Email</span>
            <span className="support-row-value">{SUPPORT_EMAIL}</span>
          </span>
        </a>

        <a href={`tel:${SUPPORT_TEL}`} className="support-row">
          <span className="support-row-icon">
            <IconPhone size={16} />
          </span>
          <span className="support-row-text">
            <span className="support-row-label">Phone</span>
            <span className="support-row-value">{SUPPORT_MOBILE_DISPLAY}</span>
          </span>
        </a>

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Standalone button + dialog, for use in a page's action row.
export function SupportButton({
  className = "btn btn-secondary",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <IconHelp size={14} /> Support
      </button>
      {open && <SupportModal onClose={() => setOpen(false)} />}
    </>
  );
}
