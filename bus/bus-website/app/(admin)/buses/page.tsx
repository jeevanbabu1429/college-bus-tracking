"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import { collegeBusesApi, type Bus } from "../../../lib/api/collegeBuses";
import { NoCollege } from "../../../components/NoCollege";
import { IconPlus, IconUpload } from "../../../components/icons";

export default function BusesPage() {
  const { selected } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      setBuses(await collegeBusesApi.list(selected._id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setBuses(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Buses</h1>
          <p className="page-subtitle">
            Vehicles registered for {selected.name}.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/assign-drivers" className="btn btn-secondary">
            Assign drivers
          </Link>
          <Link href="/buses/bulk" className="btn btn-secondary">
            <IconUpload size={14} /> Bulk upload
          </Link>
          <Link href="/buses/new" className="btn btn-primary">
            <IconPlus size={14} /> Add bus
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-card">
        {buses === null ? (
          <div className="center" style={{ padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : buses.length === 0 ? (
          <div className="empty-state" style={{ border: "none" }}>
            <h3>No buses yet</h3>
            <p>Add the first vehicle to start building out your fleet.</p>
            <Link href="/buses/new" className="btn btn-primary">
              <IconPlus size={14} /> Add bus
            </Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Plate</th>
                <th style={{ textAlign: "right" }}>Capacity</th>
                <th>Driver</th>
                <th>Route</th>
                <th style={{ textAlign: "right" }}>Stops</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => (
                <tr key={b._id}>
                  <td>
                    <span className="table-name">{b.busNumber}</span>
                  </td>
                  <td>{b.plateNumber}</td>
                  <td style={{ textAlign: "right" }}>{b.capacity}</td>
                  <td>
                    {b.driver ? (
                      b.driver.name
                    ) : (
                      <span className="pill pill-warning">Unassigned</span>
                    )}
                  </td>
                  <td>
                    {b.route ? (
                      <span title={b.route}>
                        {b.route.length > 32
                          ? b.route.slice(0, 32) + "…"
                          : b.route}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>{b.stops.length}</td>
                  <td className="table-actions">
                    <Link href={`/buses/${b._id}`} className="link-action">
                      Open
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
