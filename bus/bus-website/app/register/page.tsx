"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Gender } from "../../lib/api/auth";

const GENDERS: Gender[] = ["male", "female", "other"];

function isValidDob(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!gender) return setError("Select a gender");
    if (!isValidDob(dob)) return setError("DOB must be YYYY-MM-DD");
    if (!mobile.trim()) return setError("Mobile is required");
    if (!email.trim()) return setError("Email is required");

    const params = new URLSearchParams({
      name: name.trim(),
      gender,
      dob,
      mobile: mobile.trim(),
      email: email.trim(),
    });
    router.push(`/payment?${params.toString()}`);
  }

  return (
    <div className="auth-page">
      <main className="auth-form-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            <span className="auth-brand-mark">B</span>
            <span className="auth-brand-title">Bus Admin</span>
          </div>

          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-subheading">
            One account governs every college, bus, driver and student you
            manage.
          </p>

          <div className="field">
            <label className="field-label">Full name</label>
            <input
              className="field-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="field">
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

          <div className="field">
            <label className="field-label">Date of birth</label>
            <input
              className="field-control"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Mobile number</label>
            <input
              className="field-control"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="10-digit mobile"
            />
          </div>

          <div className="field">
            <label className="field-label">Email</label>
            <input
              className="field-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 4 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
          >
            Continue to activation
          </button>

          <p
            className="small muted text-center"
            style={{ marginTop: 18 }}
          >
            Already have an account?{" "}
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
