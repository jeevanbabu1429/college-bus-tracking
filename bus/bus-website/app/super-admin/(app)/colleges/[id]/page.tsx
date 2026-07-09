"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  superAdminApi,
  type CollegeListItem,
  type CollegePatchInput,
} from "../../../../../lib/api/superAdmin";
import { DeleteConfirmModal } from "../../admins/[id]/page";

export default function SuperAdminCollegeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [college, setCollege] = useState<CollegeListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<CollegePatchInput>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    // No dedicated single-college endpoint; find it in the list.
    superAdminApi
      .listColleges()
      .then((list) => {
        const found = list.find((c) => c._id === id) ?? null;
        if (!found) {
          setError("College not found");
          return;
        }
        setCollege(found);
        setForm({
          name: found.name,
          address: found.address,
          code: found.code,
          busCount: found.busCount,
          driverCount: found.driverCount,
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
      const updated = await superAdminApi.updateCollege(id, form);
      setCollege((prev) => (prev ? { ...prev, ...updated } : prev));
      setSuccess("College updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !college) return <div className="alert alert-error">{error}</div>;
  if (!college) {
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
          <h1 className="page-title">{college.name}</h1>
          <p className="page-subtitle">
            {college.code} · {college.address}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/super-admin/colleges" className="btn btn-secondary">
            ← Back
          </Link>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <MiniStat label="Buses" value={college.counts.buses} />
        <MiniStat label="Drivers" value={college.counts.drivers} />
        <MiniStat label="Students" value={college.counts.students} />
      </div>

      {college.admin && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>
            Owning admin
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{college.admin.name}</div>
              <div className="muted small">
                {college.admin.email} · {college.admin.mobile}
              </div>
            </div>
            <Link
              href={`/super-admin/admins/${college.admin._id}`}
              className="btn btn-quiet"
            >
              Open admin
            </Link>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Details
        </div>
        <form onSubmit={onSave}>
          <div className="form-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Name</label>
              <input
                className="field-control"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Code</label>
              <input
                className="field-control"
                value={form.code ?? ""}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Planned buses</label>
              <input
                className="field-control"
                type="number"
                min={0}
                value={form.busCount ?? 0}
                onChange={(e) =>
                  setForm({ ...form, busCount: Number(e.target.value) })
                }
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Planned drivers</label>
              <input
                className="field-control"
                type="number"
                min={0}
                value={form.driverCount ?? 0}
                onChange={(e) =>
                  setForm({ ...form, driverCount: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
            <label className="field-label">Address</label>
            <input
              className="field-control"
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
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
          Deleting this college will permanently remove{" "}
          <strong>{college.counts.buses}</strong> bus
          {college.counts.buses === 1 ? "" : "es"},{" "}
          <strong>{college.counts.drivers}</strong> driver
          {college.counts.drivers === 1 ? "" : "s"}, and{" "}
          <strong>{college.counts.students}</strong> student
          {college.counts.students === 1 ? "" : "s"}. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmOpen(true)}
        >
          Delete college &amp; all data
        </button>
      </div>

      {confirmOpen && (
        <DeleteConfirmModal
          title="Delete college?"
          promptLabel={`Type the college code (${college.code}) to confirm:`}
          expected={college.code}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async (typed) => {
            await superAdminApi.deleteCollege(id, typed);
            router.replace("/super-admin/colleges");
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
