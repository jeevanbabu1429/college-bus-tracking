"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { superAdminApi, type AdminWithCounts } from "../../../../lib/api/superAdmin";

export default function SuperAdminDashboardPage() {
  const [admins, setAdmins] = useState<AdminWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    superAdminApi
      .listAdmins()
      .then(setAdmins)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }
  if (admins === null) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  const totals = admins.reduce(
    (acc, a) => ({
      colleges: acc.colleges + a.counts.colleges,
      buses: acc.buses + a.counts.buses,
      drivers: acc.drivers + a.counts.drivers,
      students: acc.students + a.counts.students,
    }),
    { colleges: 0, buses: 0, drivers: 0, students: 0 }
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Every customer using the product, at a glance.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatTile label="Admins" value={admins.length} colour="stat-tile-yellow" />
        <StatTile label="Colleges" value={totals.colleges} colour="stat-tile-purple" />
        <StatTile label="Buses" value={totals.buses} colour="stat-tile-blue" />
        <StatTile label="Students" value={totals.students} colour="stat-tile-pink" />
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>
          Recent admins
        </div>
        {admins.length === 0 ? (
          <div className="card">
            <p className="muted small">
              No admins have signed up yet. Once they do, they&rsquo;ll appear
              here.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Colleges</th>
                  <th>Buses</th>
                  <th>Students</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {admins.slice(0, 8).map((a) => (
                  <tr key={a._id}>
                    <td>
                      <strong>{a.name}</strong>
                      <div className="muted small">{a.adminId}</div>
                    </td>
                    <td>{a.email}</td>
                    <td>{a.counts.colleges}</td>
                    <td>{a.counts.buses}</td>
                    <td>{a.counts.students}</td>
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
        {admins.length > 8 && (
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <Link href="/super-admin/admins" className="btn btn-secondary">
              View all {admins.length} admins →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className={`stat-tile ${colour}`}>
      <div className="stat-tile-head">
        <span className="stat-tile-label">{label}</span>
      </div>
      <div>
        <div className="stat-tile-value">{value}</div>
      </div>
    </div>
  );
}
