"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useColleges } from "../../../../lib/college/CollegeContext";
import { collegeBusesApi, type Bus } from "../../../../lib/api/collegeBuses";
import {
  collegeDriversApi,
  type Driver,
} from "../../../../lib/api/collegeDrivers";
import {
  collegeStudentsApi,
  type Student,
} from "../../../../lib/api/collegeStudents";
import { NoCollege } from "../../../../components/NoCollege";
import { IconArrowLeft, IconRoute } from "../../../../components/icons";

export default function BusDetailPage({
  params,
}: {
  params: Promise<{ busId: string }>;
}) {
  const { busId } = use(params);
  const { selected } = useColleges();
  const [bus, setBus] = useState<Bus | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingDriver, setSavingDriver] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [buses, ds, ss] = await Promise.all([
        collegeBusesApi.list(selected._id),
        collegeDriversApi.list(selected._id),
        collegeStudentsApi.list(selected._id),
      ]);
      setBus(buses.find((b) => b._id === busId) ?? null);
      setDrivers(ds);
      setStudents(ss.filter((s) => s.bus?._id === busId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected, busId]);

  useEffect(() => {
    setBus(null);
    load();
  }, [load]);

  async function setDriver(driverId: string | null) {
    if (!selected || !bus) return;
    setError(null);
    setSavingDriver(true);
    try {
      const updated = await collegeBusesApi.assignDriver(
        selected._id,
        bus._id,
        driverId
      );
      setBus(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingDriver(false);
    }
  }

  async function unassignStudent(studentId: string) {
    if (!selected) return;
    setError(null);
    try {
      await collegeStudentsApi.assignBus(selected._id, studentId, null);
      setStudents((prev) => prev.filter((s) => s._id !== studentId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!selected) return <NoCollege />;
  if (bus === null) {
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
          <h1 className="page-title">Bus {bus.busNumber}</h1>
          <p className="page-subtitle">
            {bus.plateNumber} · Capacity {bus.capacity} · {selected.name}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/buses" className="btn btn-secondary">
            <IconArrowLeft size={14} /> All buses
          </Link>
          <Link
            href={`/buses/${bus._id}/route`}
            className="btn btn-primary"
          >
            <IconRoute size={14} /> Edit route
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-title">Route</div>
        {bus.route ? (
          <p style={{ fontSize: 15, color: "var(--text)" }}>{bus.route}</p>
        ) : (
          <p className="muted">No route assigned yet.</p>
        )}
        {bus.stops.length > 0 && (
          <ol
            style={{
              listStyle: "none",
              marginTop: 16,
              display: "grid",
              gap: 8,
            }}
          >
            {bus.stops.map((s, i) => (
              <li
                key={`${s}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "var(--surface-muted)",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                }}
              >
                <span className="muted small" style={{ fontWeight: 600 }}>
                  {i + 1}.
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div className="card-title" style={{ margin: 0 }}>
            Driver
          </div>
          {bus.driver && (
            <button
              type="button"
              className="link-action link-action-danger"
              onClick={() => setDriver(null)}
              disabled={savingDriver}
            >
              Unassign
            </button>
          )}
        </div>
        {bus.driver ? (
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {bus.driver.name}
            </p>
            <p className="muted small" style={{ marginTop: 2 }}>
              {bus.driver.mobile} · Licence {bus.driver.licenceNumber}
            </p>
          </div>
        ) : (
          <p className="muted">No driver assigned.</p>
        )}

        <div className="divider" style={{ margin: "18px 0 14px" }} />

        <div
          className="field-label"
          style={{ marginBottom: 10, color: "var(--text-soft)" }}
        >
          Select a driver
        </div>
        {drivers.length === 0 ? (
          <p className="muted small">No drivers in this college yet.</p>
        ) : (
          <div className="chip-row">
            {drivers.map((d) => {
              const isCurrent = bus.driver?._id === d._id;
              return (
                <button
                  key={d._id}
                  type="button"
                  className={`chip ${isCurrent ? "chip-active" : ""}`}
                  onClick={() => !isCurrent && setDriver(d._id)}
                  disabled={savingDriver}
                >
                  {d.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="table-card">
        <div className="card-header">
          <div className="card-title">
            Students on this bus
            <span
              className="muted small"
              style={{ marginLeft: 8, fontWeight: 400 }}
            >
              {students.length} of {bus.capacity}
            </span>
          </div>
        </div>
        {students.length === 0 ? (
          <p
            className="muted"
            style={{ padding: 24, textAlign: "center", fontSize: 13 }}
          >
            No students assigned. Use{" "}
            <Link href="/assign-students" className="auth-link">
              Assign students
            </Link>{" "}
            to add some.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll</th>
                <th>Stop</th>
                <th>Mobile</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className="table-name">{s.name}</span>
                  </td>
                  <td>{s.rollNumber}</td>
                  <td>
                    {s.stop ? (
                      s.stop
                    ) : (
                      <span className="pill pill-danger">No stop</span>
                    )}
                  </td>
                  <td>{s.mobile}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="link-action link-action-danger"
                      onClick={() => unassignStudent(s._id)}
                    >
                      Remove
                    </button>
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
