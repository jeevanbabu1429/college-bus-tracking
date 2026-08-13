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
import {
  IconArrowLeft,
  IconBadge,
  IconMap,
  IconRoute,
  IconUsers,
} from "../../../../components/icons";
import { RouteMap } from "./RouteMap";

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

  const activeStops = bus.stops.filter((s) => !s.suspended).length;
  const suspendedStops = bus.stops.length - activeStops;
  const seatsLeft = Math.max(0, bus.capacity - students.length);
  const fillPct = bus.capacity
    ? Math.min(100, Math.round((students.length / bus.capacity) * 100))
    : 0;

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
          <Link href={`/buses/${bus._id}/route`} className="btn btn-primary">
            <IconRoute size={14} /> Edit route
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* The four things you open this page to check, before any scrolling. */}
      <div className="busfacts">
        <div className="busfact">
          <span className="busfact-icon">
            <IconMap size={17} />
          </span>
          <span className="busfact-body">
            <span className="busfact-label">Route</span>
            <span className="busfact-value" title={bus.route || undefined}>
              {bus.route || "Not set"}
            </span>
          </span>
        </div>

        <div className="busfact">
          <span className="busfact-icon">
            <IconRoute size={17} />
          </span>
          <span className="busfact-body">
            <span className="busfact-label">Stops</span>
            <span className="busfact-value">
              {activeStops}
              {suspendedStops > 0 && (
                <span className="muted small"> · {suspendedStops} off</span>
              )}
            </span>
          </span>
        </div>

        <div className="busfact">
          <span className="busfact-icon">
            <IconBadge size={17} />
          </span>
          <span className="busfact-body">
            <span className="busfact-label">Driver</span>
            <span className="busfact-value">
              {bus.driver?.name ?? "Unassigned"}
            </span>
          </span>
        </div>

        <div className="busfact">
          <span className="busfact-icon">
            <IconUsers size={17} />
          </span>
          <span className="occupancy">
            <span className="occupancy-head">
              <strong>
                {students.length} / {bus.capacity}
              </strong>
              <span>
                {seatsLeft === 0 ? "Full" : `${seatsLeft} seats free`}
              </span>
            </span>
            <span className="occupancy-bar">
              <span
                className="occupancy-fill"
                data-full={seatsLeft === 0}
                style={{ width: `${fillPct}%` }}
              />
            </span>
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-titlerow">
          <div className="card-title">
            Route map
            {bus.stops.length > 0 && (
              <span
                className="muted small"
                style={{ marginLeft: 8, fontWeight: 400 }}
              >
                {bus.stops[0].name} → {bus.stops[bus.stops.length - 1].name}
              </span>
            )}
          </div>
          <Link href={`/buses/${bus._id}/route`} className="link-action">
            Edit
          </Link>
        </div>

        {bus.notice && (
          <div className="alert alert-warning" style={{ marginTop: 14 }}>
            {bus.notice}
          </div>
        )}

        {bus.stops.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <p className="muted">
              No stops on this route yet.{" "}
              <Link href={`/buses/${bus._id}/route`} className="auth-link">
                Add the first stop
              </Link>
              .
            </p>
          </div>
        ) : (
          <RouteMap stops={bus.stops} />
        )}
      </div>

      <div className="card">
        <div className="card-titlerow" style={{ marginBottom: 16 }}>
          <div className="card-title">Driver</div>
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
          <div className="busdriver">
            <span className="busdriver-avatar">
              {bus.driver.name.charAt(0).toUpperCase()}
            </span>
            <span className="busdriver-body">
              <span className="busdriver-name">{bus.driver.name}</span>
              <span className="busdriver-meta">
                {bus.driver.mobile} · Licence {bus.driver.licenceNumber}
              </span>
            </span>
          </div>
        ) : (
          <p className="muted">
            No driver assigned — pick one below, or move an existing driver over
            on{" "}
            <Link href="/switch-drivers" className="auth-link">
              Switch drivers
            </Link>
            .
          </p>
        )}

        <div className="divider" style={{ margin: "18px 0 14px" }} />

        <div
          className="field-label"
          style={{ marginBottom: 10, color: "var(--text-soft)" }}
        >
          {bus.driver ? "Replace with" : "Select a driver"}
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
                  title={d.mobile}
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
          <Link href="/switch-students" className="link-action">
            Move students
          </Link>
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
