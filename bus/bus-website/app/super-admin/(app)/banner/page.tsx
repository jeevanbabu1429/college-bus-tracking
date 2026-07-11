"use client";

import { useEffect, useRef, useState } from "react";
import {
  superAdminApi,
  type Banner,
} from "../../../../lib/api/superAdmin";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB source (base64 inflates ~1.33x → ~7 MB payload)

export default function SuperAdminBannerPage() {
  const [banner, setBanner] = useState<Banner | null | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    superAdminApi
      .getBanner()
      .then((b) => setBanner(b))
      .catch((e) => {
        setBanner(null);
        setError((e as Error).message);
      });
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please pick an image file (PNG, JPG, GIF, WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is too large. Please pick something under 5 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPendingDataUrl(reader.result);
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsDataURL(file);
  }

  async function onSaveNew() {
    if (!pendingDataUrl) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const active = banner?.active ?? true;
      const b = await superAdminApi.putBanner(pendingDataUrl, active);
      setBanner(b);
      setPendingDataUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Banner uploaded. All users will see it on next app open.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(nextActive: boolean) {
    if (!banner) return;
    setBusy(true);
    setError(null);
    try {
      const b = await superAdminApi.setBannerActive(nextActive);
      setBanner(b);
      setSuccess(nextActive ? "Banner is now visible to users." : "Banner is hidden from users.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!banner) return;
    if (!window.confirm("Delete the current banner? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await superAdminApi.deleteBanner();
      setBanner(null);
      setSuccess("Banner removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (banner === undefined) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  const showImage = pendingDataUrl ?? banner?.imageDataUrl ?? null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Post banner</h1>
          <p className="page-subtitle">
            Upload a poster image that every user sees when they open the app.
            Toggle it off to hide it without deleting.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ maxWidth: 720 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ maxWidth: 720 }}>{success}</div>}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-start",
          maxWidth: 1000,
        }}
      >
        {/* Left: preview + status */}
        <div style={{ flex: "1 1 340px", minWidth: 300 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ background: "#1a1d29", position: "relative" }}>
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={showImage}
                  alt="Banner poster preview"
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              ) : (
                <div
                  style={{
                    height: 260,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#a0a4b1",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  No banner uploaded yet
                </div>
              )}
              {banner && !pendingDataUrl && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    background: banner.active ? "#e6f4ea" : "#f3f4f6",
                    color: banner.active ? "#1b5e20" : "#4b5563",
                  }}
                >
                  {banner.active ? "LIVE" : "HIDDEN"}
                </div>
              )}
            </div>
          </div>

          {banner && !pendingDataUrl && (
            <div className="muted small" style={{ marginTop: 8 }}>
              Last updated {new Date(banner.updatedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ flex: "1 1 340px", minWidth: 300, display: "grid", gap: 16 }}>
          <div className="card">
            <div className="section-title" style={{ marginBottom: 8 }}>
              Upload
            </div>
            <p className="muted small" style={{ marginBottom: 12 }}>
              PNG, JPG, GIF, or WebP. Max 5 MB. Best displayed at aspect ratio
              4:5 or 3:4 for phone screens.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChosen}
              style={{ marginBottom: 12 }}
            />
            {pendingDataUrl && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onSaveNew}
                  disabled={busy}
                >
                  {busy ? <span className="spinner spinner-light" /> : banner ? "Replace banner" : "Publish banner"}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setPendingDataUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={busy}
                >
                  Discard
                </button>
              </div>
            )}
          </div>

          {banner && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 8 }}>
                Visibility
              </div>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Toggle off to hide the banner from users without deleting it.
                Toggle back on to bring it back.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {banner.active ? "Currently shown" : "Currently hidden"}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    Users see the change on next app open.
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={banner.active}
                  onClick={() => onToggle(!banner.active)}
                  disabled={busy}
                  style={{
                    width: 52,
                    height: 28,
                    borderRadius: 999,
                    padding: 3,
                    border: "none",
                    background: banner.active ? "#2e7d32" : "#9ca3af",
                    cursor: busy ? "wait" : "pointer",
                    position: "relative",
                    transition: "background 0.15s ease",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "block",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#fff",
                      transform: `translateX(${banner.active ? 24 : 0}px)`,
                      transition: "transform 0.15s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,.25)",
                    }}
                  />
                </button>
              </div>
            </div>
          )}

          {banner && (
            <div
              className="card"
              style={{
                borderColor: "#f5c2c2",
                background: "#fdf6f6",
              }}
            >
              <div className="section-title" style={{ marginBottom: 8, color: "#c62828" }}>
                Delete banner
              </div>
              <p className="muted small" style={{ marginBottom: 12 }}>
                Removes the banner completely. Users see nothing on next open.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={onDelete}
                disabled={busy}
              >
                Delete banner
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
