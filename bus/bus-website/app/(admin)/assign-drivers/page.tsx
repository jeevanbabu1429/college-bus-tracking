"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
} from "../../../lib/api/collegeBuses";
import {
  collegeDriversApi,
  type Driver,
} from "../../../lib/api/collegeDrivers";
import { NoCollege } from "../../../components/NoCollege";
import { IconUpload } from "../../../components/icons";

export default function AssignDriversPage() {
  const { selected } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [savingBusId, setSavingBusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [bs, ds] = await Promise.all([
        collegeBusesApi.list(selected._id),
        collegeDriversApi.list(selected._id),
      ]);
      setBuses(bs);
      setDrivers(ds);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setBuses(null);
    load();
  }, [load]);

  async function changeDriver(bus: Bus, driverId: string | null) {
    if (!selected) return;
    setError(null);
    setSavingBusId(bus._id);
    try {
      const updated = await collegeBusesApi.assignDriver(
        selected._id,
        bus._id,
        driverId
      );
      setBuses((prev) =>
        prev ? prev.map((b) => (b._id === bus._id ? updated : b)) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingBusId(null);
    }
  }

  if (!selected) return <NoCollege />;

  const assignedDriverIds = new Set(
    (buses ?? []).map((b) => b.driver?._id).filter(Boolean) as string[]
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Assign drivers</h1>
          <p className="page-subtitle">
            One driver per bus. {assignedDriverIds.size} of {drivers.length}{" "}
            drivers presently assigned.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/assign-drivers/bulk" className="btn btn-secondary">
            <IconUpload size={14} /> Bulk assign
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
          <p
            className="muted"
            style={{ padding: 24, textAlign: "center", fontSize: 13 }}
          >
            No buses to assign drivers to.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Plate</th>
                <th>Driver</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => {
                const isSaving = savingBusId === b._id;
                return (
                  <tr key={b._id}>
                    <td>
                      <span className="table-name">{b.busNumber}</span>
                    </td>
                    <td>{b.plateNumber}</td>
                    <td>
                      <select
                        className="field-control"
                        value={b.driver?._id ?? ""}
                        onChange={(e) =>
                          changeDriver(b, e.target.value || null)
                        }
                        disabled={isSaving}
                        style={{ minWidth: 240 }}
                      >
                        <option value="">— Unassigned —</option>
                        {drivers.map((d) => {
                          const usedElsewhere =
                            assignedDriverIds.has(d._id) &&
                            b.driver?._id !== d._id;
                          return (
                            <option
                              key={d._id}
                              value={d._id}
                              disabled={usedElsewhere}
                            >
                              {d.name}
                              {usedElsewhere ? " (already assigned)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {isSaving ? <span className="spinner" /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
