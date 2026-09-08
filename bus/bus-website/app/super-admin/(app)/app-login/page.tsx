"use client";

import { useEffect, useState } from "react";
import {
  superAdminApi,
  type LoginRoles,
  type LoginRoleKey,
} from "../../../../lib/api/superAdmin";

const ROLES: {
  key: LoginRoleKey;
  label: string;
  mark: string;
  markColor: string;
  description: string;
}[] = [
  {
    key: "student",
    label: "Student",
    mark: "S",
    markColor: "#5b3df7",
    description:
      "Riders see their bus live on the map, get told when it is near, and see stop suspensions.",
  },
  {
    key: "driver",
    label: "Driver",
    mark: "D",
    markColor: "#e0742a",
    description:
      "Drivers start and end a trip. This is the only role that shares location.",
  },
  {
    key: "admin",
    label: "Admin",
    mark: "A",
    markColor: "#1f4dff",
    description:
      "Fleet management from the phone. Hiding this card does not affect the web console.",
  },
];

export default function AppLoginPage() {
  const [roles, setRoles] = useState<LoginRoles | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<LoginRoleKey | null>(null);

  useEffect(() => {
    superAdminApi
      .getLoginRoles()
      .then(setRoles)
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  // Optimistic — the switch moves on click and rolls back if the server
  // refuses, which it does when this would turn the last role off.
  async function toggle(key: LoginRoleKey) {
    if (!roles || busyKey) return;
    const next = !roles[key];
    const previous = roles;
    setRoles({ ...roles, [key]: next });
    setBusyKey(key);
    setError(null);
    setSuccess(null);
    try {
      const saved = await superAdminApi.putLoginRoles({ [key]: next });
      setRoles(saved);
      setSuccess(
        `${ROLES.find((r) => r.key === key)!.label} sign-in ${
          next ? "shown" : "hidden"
        }. Takes effect the next time the app is opened.`
      );
    } catch (e) {
      setRoles(previous);
      setError((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  const enabledCount = roles
    ? ROLES.filter((r) => roles[r.key]).length
    : 0;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">App sign-in</h1>
          <p className="page-subtitle">
            Which role cards the mobile app offers on its sign-in screen. This
            applies to every college — the app picks a role before anyone has
            signed in, so there is no college to scope it to yet.
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

      {roles === null && !loadError ? (
        <div className="center" style={{ padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : roles === null ? null : (
        <div className="card" style={{ maxWidth: 720, padding: 0 }}>
          {ROLES.map((role, index) => {
            const on = roles[role.key];
            const busy = busyKey === role.key;
            // The last one standing cannot be switched off — the server
            // refuses it, so don't offer it either.
            const isLastOn = on && enabledCount === 1;
            return (
              <div
                key={role.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "18px 20px",
                  borderTop: index === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    color: role.markColor,
                    background: "var(--surface-muted)",
                    border: "1px solid var(--border)",
                    opacity: on ? 1 : 0.45,
                  }}
                >
                  {role.mark}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, opacity: on ? 1 : 0.6 }}>
                    {role.label}
                  </div>
                  <div
                    className="muted small"
                    style={{ marginTop: 2, lineHeight: 1.5 }}
                  >
                    {role.description}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flex: "none",
                  }}
                  title={
                    isLastOn
                      ? "At least one sign-in role must stay enabled"
                      : on
                      ? "Shown in the app"
                      : "Hidden from the app"
                  }
                >
                  <span
                    className="small"
                    style={{
                      fontWeight: 600,
                      color: on ? "#2e7d32" : "var(--text-muted)",
                      minWidth: 48,
                      textAlign: "right",
                    }}
                  >
                    {on ? "Shown" : "Hidden"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${role.label} sign-in`}
                    onClick={() => toggle(role.key)}
                    disabled={busy || isLastOn}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 999,
                      padding: 2,
                      border: "none",
                      background: on ? "#2e7d32" : "#9ca3af",
                      cursor: isLastOn
                        ? "not-allowed"
                        : busy
                        ? "wait"
                        : "pointer",
                      transition: "background 0.15s ease",
                      position: "relative",
                      opacity: busy ? 0.6 : isLastOn ? 0.5 : 1,
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
                        transform: `translateX(${on ? 18 : 0}px)`,
                        transition: "transform 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,.25)",
                      }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ maxWidth: 720, marginTop: 16 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>
          What this does and does not do
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
            Hiding a card removes it from the mobile sign-in screen only. It
            does not suspend accounts, and anyone already signed in stays
            signed in.
          </li>
          <li>
            The web console is unaffected. Admins and staff sign in there
            regardless of what is set here.
          </li>
          <li>
            The app reads this when it opens, so a change reaches users on
            their next launch — no new release needed.
          </li>
          <li>
            If the app cannot reach the API it shows all three cards, so a
            network fault never leaves users with no way in.
          </li>
        </ul>
      </div>
    </>
  );
}
