"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  superAdminApi,
  type CollegeListItem,
} from "../../../../lib/api/superAdmin";

export default function SuperAdminCollegesPage() {
  const [colleges, setColleges] = useState<CollegeListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    superAdminApi
      .listColleges()
      .then(setColleges)
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    if (!colleges) return null;
    const q = query.trim().toLowerCase();
    if (!q) return colleges;
    return colleges.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.admin?.name.toLowerCase().includes(q) ?? false) ||
        (c.admin?.email.toLowerCase().includes(q) ?? false)
    );
  }, [colleges, query]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Colleges</h1>
          <p className="page-subtitle">
            Every college across every customer admin.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ marginBottom: 14 }}>
        <input
          className="field-control"
          placeholder="Search by name, code, address, or admin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 420 }}
        />
      </div>

      {filtered === null ? (
        <div className="center" style={{ padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p className="muted small">
            {colleges?.length === 0
              ? "No colleges yet."
              : "No colleges match your search."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>College</th>
                <th>Admin</th>
                <th>Buses</th>
                <th>Drivers</th>
                <th>Students</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="muted small">
                      {c.code} · {c.address}
                    </div>
                  </td>
                  <td>
                    {c.admin ? (
                      <>
                        <div>{c.admin.name}</div>
                        <div className="muted small">{c.admin.email}</div>
                      </>
                    ) : (
                      <span className="muted small">— unassigned —</span>
                    )}
                  </td>
                  <td>{c.counts.buses}</td>
                  <td>{c.counts.drivers}</td>
                  <td>{c.counts.students}</td>
                  <td>
                    <Link
                      href={`/super-admin/colleges/${c._id}`}
                      className="btn btn-quiet"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
