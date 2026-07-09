"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  superAdminApi,
  type AdminWithCounts,
} from "../../../../lib/api/superAdmin";
import { SuspensionToggle } from "./SuspensionToggle";

export default function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    superAdminApi
      .listAdmins()
      .then(setAdmins)
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    if (!admins) return null;
    const q = query.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.mobile.toLowerCase().includes(q) ||
        a.adminId.toLowerCase().includes(q)
    );
  }, [admins, query]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Admins</h1>
          <p className="page-subtitle">
            Every customer admin using the product.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ marginBottom: 14 }}>
        <input
          className="field-control"
          placeholder="Search by name, email, mobile, or admin ID"
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
            {admins?.length === 0
              ? "No admins yet."
              : "No admins match your search."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Colleges</th>
                <th>Buses</th>
                <th>Students</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a._id}
                  style={a.suspended ? { opacity: 0.55 } : undefined}
                >
                  <td>
                    <strong>{a.name}</strong>
                    <div className="muted small">
                      {a.adminId}
                      {a.suspended && (
                        <span
                          className="pill pill-danger"
                          style={{ marginLeft: 6 }}
                        >
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ wordBreak: "break-all" }}>{a.email}</td>
                  <td>{a.mobile}</td>
                  <td>{a.counts.colleges}</td>
                  <td>{a.counts.buses}</td>
                  <td>{a.counts.students}</td>
                  <td>
                    <SuspensionToggle
                      adminId={a._id}
                      suspended={a.suspended ?? false}
                      onChange={(next) =>
                        setAdmins((prev) =>
                          prev
                            ? prev.map((x) =>
                                x._id === a._id ? { ...x, suspended: next } : x
                              )
                            : prev
                        )
                      }
                    />
                  </td>
                  <td>
                    <Link
                      href={`/super-admin/admins/${a._id}`}
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
