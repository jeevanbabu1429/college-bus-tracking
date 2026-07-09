"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../lib/auth/AuthContext";
import type { Gender } from "../../../lib/api/auth";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

type FormState = {
  name: string;
  gender: Gender;
  dob: string;
  mobile: string;
  email: string;
};

const EMPTY: FormState = {
  name: "",
  gender: "male",
  dob: "",
  mobile: "",
  email: "",
};

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfilePage() {
  const { session, updateAdmin } = useAuth();
  const admin = session?.admin;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The clean copy we compare against to compute "dirty" and to restore on
  // Discard. Re-snapshotted whenever the underlying admin reference changes.
  const baselineRef = useRef<FormState>(EMPTY);

  useEffect(() => {
    if (!admin) return;
    const next: FormState = {
      name: admin.name,
      gender: admin.gender,
      dob: isoDate(admin.dob),
      mobile: admin.mobile,
      email: admin.email,
    };
    baselineRef.current = next;
    setForm(next);
  }, [admin]);

  // Auto-dismiss the success banner — sticky banners go unread.
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(id);
  }, [success]);

  const dirty = useMemo(() => {
    const b = baselineRef.current;
    return (
      b.name !== form.name ||
      b.gender !== form.gender ||
      b.dob !== form.dob ||
      b.mobile !== form.mobile ||
      b.email !== form.email
    );
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || busy) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await updateAdmin(form);
      setSuccess("Profile updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onDiscard() {
    setForm(baselineRef.current);
    setError(null);
    setSuccess(null);
  }

  if (!admin) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">
            Manage your personal information and how we reach you.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSave}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        <aside
          style={{
            display: "grid",
            gap: 16,
            flex: "1 1 280px",
            minWidth: 260,
            maxWidth: 360,
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div
              aria-hidden
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                margin: "4px auto 14px",
                background: "var(--accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -1,
                boxShadow: "0 6px 18px rgba(255,138,91,.35)",
              }}
            >
              {initials(form.name || admin.name)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3 }}>
              {form.name || admin.name}
            </div>
            <div
              className="muted small"
              style={{ marginTop: 4, wordBreak: "break-all" }}
            >
              {form.email || admin.email}
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span className="pill pill-plain">Admin · {admin.adminId}</span>
              <span className="pill pill-success">Active</span>
            </div>
          </div>

          <div className="card">
            <div
              className="section-title"
              style={{ marginBottom: 4, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              Account
            </div>
            <MetaRow label="Member since" value={formatLongDate(admin.createdAt)} />
            <MetaRow label="Last updated" value={formatLongDate(admin.updatedAt)} />
            <MetaRow label="Admin ID" value={admin.adminId} mono />
          </div>
        </aside>

        <div
          style={{
            display: "grid",
            gap: 16,
            flex: "10 1 380px",
            minWidth: 280,
          }}
        >
          <section className="card">
            <SectionHeader
              title="Personal details"
              hint="Your basic information."
            />

            <div className="form-grid">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="profile-name">
                  Full name
                </label>
                <input
                  id="profile-name"
                  className="field-control"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="profile-dob">
                  Date of birth
                </label>
                <input
                  id="profile-dob"
                  className="field-control"
                  type="date"
                  value={form.dob}
                  onChange={(e) => update("dob", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
              <label className="field-label">Gender</label>
              <div className="chip-row">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => update("gender", g.value)}
                    className={`chip ${form.gender === g.value ? "chip-active" : ""}`}
                    aria-pressed={form.gender === g.value}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <SectionHeader
              title="Contact"
              hint="Used for login OTPs and important notifications."
            />

            <div className="form-grid">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="profile-mobile">
                  Mobile
                </label>
                <input
                  id="profile-mobile"
                  className="field-control"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
                <div className="muted small" style={{ marginTop: 6 }}>
                  Your OTP is sent here at every login.
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="profile-email">
                  Email
                </label>
                <input
                  id="profile-email"
                  className="field-control"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  autoComplete="email"
                  required
                />
                <div className="muted small" style={{ marginTop: 6 }}>
                  Stored in lowercase.
                </div>
              </div>
            </div>
          </section>

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

          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 1,
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "14px 16px",
              marginTop: 4,
              background: "var(--bg-page)",
              borderTop: "1px solid var(--border)",
              borderRadius: "0 0 16px 16px",
              flexWrap: "wrap",
            }}
          >
            <div className="muted small" style={{ marginRight: "auto" }}>
              {busy
                ? "Saving…"
                : dirty
                ? "You have unsaved changes"
                : "All changes saved"}
            </div>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onDiscard}
              disabled={!dirty || busy}
            >
              Discard
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!dirty || busy}
            >
              {busy ? <span className="spinner spinner-light" /> : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ fontSize: 15 }}>
        {title}
      </div>
      {hint && (
        <div className="muted small" style={{ marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span className="muted small">{label}</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: 13,
          textAlign: "right",
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
