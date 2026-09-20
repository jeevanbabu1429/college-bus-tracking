"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  superAdminApi,
  type AppVersions,
} from "../../../../lib/api/superAdmin";

const EMPTY: AppVersions = {
  androidLatest: "",
  androidMinimum: "",
  iosLatest: "",
  iosMinimum: "",
};

const PLATFORMS: {
  name: string;
  mark: string;
  markColor: string;
  latestKey: keyof AppVersions;
  minimumKey: keyof AppVersions;
}[] = [
  {
    name: "Android",
    mark: "A",
    markColor: "#3ddc84",
    latestKey: "androidLatest",
    minimumKey: "androidMinimum",
  },
  {
    name: "iPhone",
    mark: "i",
    markColor: "#0a84ff",
    latestKey: "iosLatest",
    minimumKey: "iosMinimum",
  },
];

export default function VersionsPage() {
  const [versions, setVersions] = useState<AppVersions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    superAdminApi
      .getAppVersions()
      .then(setVersions)
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [success]);

  function set(key: keyof AppVersions, value: string) {
    setVersions((v) => ({ ...(v ?? EMPTY), [key]: value }));
    setSuccess(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!versions || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await superAdminApi.putAppVersions({
        androidLatest: versions.androidLatest.trim(),
        androidMinimum: versions.androidMinimum.trim(),
        iosLatest: versions.iosLatest.trim(),
        iosMinimum: versions.iosMinimum.trim(),
      });
      setVersions(saved);
      setSuccess(
        "Saved. Each phone sees this the next time the app is opened."
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">App versions</h1>
          <p className="page-subtitle">
            Ask people to update the mobile app. The app checks this every time
            it opens, so a change reaches everyone without a new release.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-error" style={{ maxWidth: 720 }}>
          {loadError}
        </div>
      )}

      {versions === null && !loadError ? (
        <div className="center" style={{ padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : versions === null ? null : (
        <form className="card" style={{ maxWidth: 720 }} onSubmit={onSubmit}>
          {PLATFORMS.map((p, index) => (
            <div
              key={p.name}
              style={{
                paddingTop: index === 0 ? 0 : 20,
                marginTop: index === 0 ? 0 : 20,
                borderTop: index === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: p.markColor,
                    background: "var(--surface-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {p.mark}
                </span>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16,
                }}
              >
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" htmlFor={`${p.name}-latest`}>
                    Latest version
                  </label>
                  <input
                    id={`${p.name}-latest`}
                    className="field-control"
                    inputMode="decimal"
                    placeholder="1.0.5"
                    value={versions[p.latestKey]}
                    onChange={(e) => set(p.latestKey, e.target.value)}
                  />
                  <div className="muted small" style={{ marginTop: 6 }}>
                    Below this, people are asked to update and can tap Later.
                  </div>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" htmlFor={`${p.name}-minimum`}>
                    Minimum version
                  </label>
                  <input
                    id={`${p.name}-minimum`}
                    className="field-control"
                    inputMode="decimal"
                    placeholder="1.0.3"
                    value={versions[p.minimumKey]}
                    onChange={(e) => set(p.minimumKey, e.target.value)}
                  />
                  <div className="muted small" style={{ marginTop: 6 }}>
                    Below this, they must update before using the app.
                  </div>
                </div>
              </div>
            </div>
          ))}

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 20 }}>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status" style={{ marginTop: 20 }}>
              {success}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save versions"}
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ maxWidth: 720, marginTop: 16 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>
          How to use this
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
            Type versions the way the store shows them, like 1.0.5. Leave a box
            empty to switch that check off.
          </li>
          <li>
            Put the new version in <strong>Latest version</strong> after a
            release goes live in the store, so people are nudged to update.
          </li>
          <li>
            Raise <strong>Minimum version</strong> only when an old app can no
            longer work properly — it locks those people out of the app until
            they update.
          </li>
          <li>
            Set the minimum no higher than a version that is already in the
            store, or people will be asked for an update they cannot download.
          </li>
          <li>
            Anyone on the same version or newer sees nothing, and a phone that
            cannot reach the server is let through.
          </li>
        </ul>
      </div>
    </>
  );
}
