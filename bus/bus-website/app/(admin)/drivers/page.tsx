"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeDriversApi,
  type Driver,
} from "../../../lib/api/collegeDrivers";
import { NoCollege } from "../../../components/NoCollege";
import { IconPlus, IconUpload } from "../../../components/icons";

export default function DriversPage() {
  const { selected } = useColleges();
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      setDrivers(await collegeDriversApi.list(selected._id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setDrivers(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  const filtered = (drivers ?? []).filter((d) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.mobile.toLowerCase().includes(q) ||
      d.licenceNumber.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Drivers</h1>
          <p className="page-subtitle">
            Licensed drivers registered for {selected.name}.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/drivers/bulk" className="btn btn-secondary">
            <IconUpload size={14} /> Bulk upload
          </Link>
          <Link href="/drivers/new" className="btn btn-primary">
            <IconPlus size={14} /> Add driver
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          className="field-control toolbar-search"
          placeholder="Search by name, mobile or licence…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="toolbar-meta">
          {filtered.length} of {(drivers ?? []).length}
        </span>
      </div>

      <div className="table-card">
        {drivers === null ? (
          <div className="center" style={{ padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ border: "none" }}>
            <h3>
              {drivers.length === 0 ? "No drivers yet" : "No drivers match"}
            </h3>
            <p>
              {drivers.length === 0
                ? "Onboard your first driver to begin."
                : "Try a different search term."}
            </p>
            {drivers.length === 0 && (
              <Link href="/drivers/new" className="btn btn-primary">
                <IconPlus size={14} /> Add driver
              </Link>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Licence</th>
                <th>Aadhar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d._id}>
                  <td>
                    <span className="table-name">{d.name}</span>
                    <div
                      className="small muted"
                      style={{ marginTop: 2, textTransform: "capitalize" }}
                    >
                      {d.gender}
                    </div>
                  </td>
                  <td>{d.mobile}</td>
                  <td>{d.licenceNumber}</td>
                  <td>{d.aadharNumber}</td>
                  <td className="table-actions">
                    <Link
                      href={`/drivers/${d._id}/edit`}
                      className="link-action"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
