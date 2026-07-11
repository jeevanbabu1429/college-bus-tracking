"use client";

import { useEffect, useState } from "react";
import { bannerApi, type PublicBanner } from "../lib/api/banner";

// Full-screen banner overlay shown whenever the app opens if the super admin
// has toggled a poster ON. Dismissable per page load; refetches on next
// mount, so the next app open shows it again.
export function BannerModal() {
  const [banner, setBanner] = useState<PublicBanner | null | undefined>(
    undefined
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bannerApi
      .getPublic()
      .then((b) => {
        if (!cancelled) setBanner(b);
      })
      .catch(() => {
        if (!cancelled) setBanner(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!banner || dismissed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDismissed(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [banner, dismissed]);

  if (!banner || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setDismissed(true)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: 480,
          maxHeight: "90vh",
          background: "#fff",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 20px 80px rgba(0,0,0,.5)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.imageDataUrl}
          alt="Announcement"
          style={{
            display: "block",
            width: "100%",
            maxHeight: "90vh",
            objectFit: "contain",
          }}
        />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
