"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth/AuthContext";
import type { Gender } from "../../../lib/api/auth";

const GENDERS: Gender[] = ["male", "female", "other"];

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function ProfilePage() {
  const { session, updateAdmin } = useAuth();
  const admin = session?.admin;

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    setName(admin.name);
    setGender(admin.gender);
    setDob(isoDate(admin.dob));
    setMobile(admin.mobile);
    setEmail(admin.email);
  }, [admin]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await updateAdmin({ name, gender, dob, mobile, email });
      setSuccess("Profile updated successfully.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">
            Manage your personal information and contact details.
          </p>
        </div>
        <span className="pill pill-plain">Admin · {admin?.adminId}</span>
      </div>

      <form className="card" onSubmit={onSave} style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Full name</label>
            <input
              className="field-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Date of birth</label>
            <input
              className="field-control"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Mobile</label>
            <input
              className="field-control"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Email</label>
            <input
              className="field-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 22, marginBottom: 0 }}>
          <label className="field-label">Gender</label>
          <div className="chip-row">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`chip ${gender === g ? "chip-active" : ""}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 18 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginTop: 18 }}>
            {success}
          </div>
        )}

        <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}
