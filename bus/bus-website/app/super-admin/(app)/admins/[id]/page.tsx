"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  superAdminApi,
  type AdminDetail,
  type AdminPatchInput,
} from "../../../../../lib/api/superAdmin";
import type { Gender } from "../../../../../lib/api/auth";
import { SuspensionToggle } from "../SuspensionToggle";

const GENDERS: Gender[] = ["male", "female", "other"];

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function SuperAdminAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<AdminDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<AdminPatchInput>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    superAdminApi
      .getAdmin(id)
      .then((d) => {
        setData(d);
        setForm({
          name: d.admin.name,
          gender: d.admin.gender,
          dob: isoDate(d.admin.dob),
          mobile: d.admin.mobile,
          email: d.admin.email,
        });
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await superAdminApi.updateAdmin(id, form);
      setData((prev) => (prev ? { ...prev, admin: updated } : prev));
      setSuccess("Admin updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) {
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
          <h1 className="page-title">
            {data.admin.name}
            {data.admin.suspended && (
              <span
                className="pill pill-danger"
                style={{ marginLeft: 10, verticalAlign: "middle" }}
              >
                Suspended
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {data.admin.email} · {data.admin.adminId}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/super-admin/admins" className="btn btn-secondary">
            ← Back
          </Link>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="section-title">Access</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Toggle off to block this admin and all of their drivers and
              students from logging in.
            </div>
          </div>
          <SuspensionToggle
            adminId={data.admin._id}
            suspended={data.admin.suspended ?? false}
            onChange={(next) =>
              setData((prev) =>
                prev
                  ? { ...prev, admin: { ...prev.admin, suspended: next } }
                  : prev
              )
            }
          />
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <MiniStat label="Colleges" value={data.counts.colleges} />
        <MiniStat label="Buses" value={data.counts.buses} />
        <MiniStat label="Drivers" value={data.counts.drivers} />
        <MiniStat label="Students" value={data.counts.students} />
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Profile
        </div>
        <form onSubmit={onSave}>
          <div className="form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Full name</label>
              <input
                className="field-control"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Date of birth</label>
              <input
                className="field-control"
                type="date"
                value={form.dob ?? ""}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Mobile</label>
              <input
                className="field-control"
                value={form.mobile ?? ""}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Email</label>
              <input
                className="field-control"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
            <label className="field-label">Gender</label>
            <div className="chip-row">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip ${form.gender === g ? "chip-active" : ""}`}
                  onClick={() => setForm({ ...form, gender: g })}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success" style={{ marginTop: 14 }}>
              {success}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
            >
              {busy ? <span className="spinner spinner-light" /> : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Colleges
        </div>
        {data.colleges.length === 0 ? (
          <p className="muted small">This admin has no colleges yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.colleges.map((c) => (
              <li
                key={c._id}
                style={{
                  padding: "12px 0",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="muted small">
                    {c.code} · {c.counts.buses} buses · {c.counts.drivers} drivers
                    · {c.counts.students} students
                  </div>
                </div>
                <Link
                  href={`/super-admin/colleges/${c._id}`}
                  className="btn btn-quiet"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="card"
        style={{
          maxWidth: 720,
          borderColor: "#f5c2c2",
          background: "#fdf6f6",
        }}
      >
        <div
          className="section-title"
          style={{ color: "#c62828", marginBottom: 8 }}
        >
          Danger zone
        </div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Deleting this admin will permanently remove{" "}
          <strong>{data.counts.colleges}</strong> college
          {data.counts.colleges === 1 ? "" : "s"},{" "}
          <strong>{data.counts.buses}</strong> bus
          {data.counts.buses === 1 ? "" : "es"},{" "}
          <strong>{data.counts.drivers}</strong> driver
          {data.counts.drivers === 1 ? "" : "s"}, and{" "}
          <strong>{data.counts.students}</strong> student
          {data.counts.students === 1 ? "" : "s"}. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmOpen(true)}
        >
          Delete admin &amp; all data
        </button>
      </div>

      {confirmOpen && (
        <DeleteConfirmModal
          title="Delete admin?"
          promptLabel={`Type the admin's email (${data.admin.email}) to confirm:`}
          expected={data.admin.email}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async (typed) => {
            await superAdminApi.deleteAdmin(id, typed);
            router.replace("/super-admin/admins");
          }}
        />
      )}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-head">
        <span className="stat-tile-label">{label}</span>
      </div>
      <div className="stat-tile-value">{value}</div>
    </div>
  );
}

export function DeleteConfirmModal({
  title,
  promptLabel,
  expected,
  onCancel,
  onConfirm,
}: {
  title: string;
  promptLabel: string;
  expected: string;
  onCancel: () => void;
  onConfirm: (typed: string) => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches =
    typed.trim().toLowerCase() === expected.trim().toLowerCase();

  async function go() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(typed.trim());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-title" style={{ color: "#c62828" }}>
          {title}
        </div>
        <p className="modal-body">{promptLabel}</p>
        <input
          className="field-control"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={expected}
        />
        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-quiet"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!matches || busy}
            onClick={go}
          >
            {busy ? <span className="spinner spinner-light" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
