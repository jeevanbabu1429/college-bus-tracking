"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
} from "../../../lib/api/collegeBuses";
import {
  collegeStudentsApi,
  type Student,
} from "../../../lib/api/collegeStudents";
import { NoCollege } from "../../../components/NoCollege";
import { IconUpload } from "../../../components/icons";

export default function AssignStudentsPage() {
  const { selected } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [bs, ss] = await Promise.all([
        collegeBusesApi.list(selected._id),
        collegeStudentsApi.list(selected._id),
      ]);
      setBuses(bs);
      setStudents(ss);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setBuses(null);
    setStudents(null);
    load();
  }, [load]);

  async function updateAssignment(
    s: Student,
    busId: string | null,
    stop: string | null
  ) {
    if (!selected) return;
    setError(null);
    setSavingId(s._id);
    try {
      const updated = await collegeStudentsApi.assignBus(
        selected._id,
        s._id,
        busId,
        stop
      );
      setStudents((prev) =>
        prev ? prev.map((x) => (x._id === s._id ? updated : x)) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  if (!selected) return <NoCollege />;

  const filtered = (students ?? []).filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      s.mobile.toLowerCase().includes(q)
    );
  });

  const busOccupancy = new Map<string, number>();
  for (const s of students ?? []) {
    if (s.bus?._id) {
      busOccupancy.set(s.bus._id, (busOccupancy.get(s.bus._id) ?? 0) + 1);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Assign students</h1>
          <p className="page-subtitle">
            Place each student onto a bus and a valid stop along its route.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/assign-students/bulk" className="btn btn-secondary">
            <IconUpload size={14} /> Bulk assign
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          className="field-control toolbar-search"
          placeholder="Search by name, roll or mobile…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="toolbar-meta">
          {filtered.length} of {(students ?? []).length}
        </span>
      </div>

      <div className="table-card">
        {buses === null || students === null ? (
          <div className="center" style={{ padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <p
            className="muted"
            style={{ padding: 24, textAlign: "center", fontSize: 13 }}
          >
            No students match.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Bus</th>
                <th>Stop</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const currentBus = buses?.find((b) => b._id === s.bus?._id);
                const isSaving = savingId === s._id;
                return (
                  <tr key={s._id}>
                    <td>
                      <span className="table-name">{s.name}</span>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {s.mobile}
                      </div>
                    </td>
                    <td>{s.rollNumber}</td>
                    <td>
                      <select
                        className="field-control"
                        value={s.bus?._id ?? ""}
                        onChange={(e) => {
                          const next = e.target.value || null;
                          updateAssignment(s, next, null);
                        }}
                        disabled={isSaving}
                        style={{ minWidth: 220 }}
                      >
                        <option value="">— None —</option>
                        {(buses ?? []).map((b) => {
                          const occ = busOccupancy.get(b._id) ?? 0;
                          const isCurrent = s.bus?._id === b._id;
                          const full = !isCurrent && occ >= b.capacity;
                          return (
                            <option key={b._id} value={b._id} disabled={full}>
                              {b.busNumber} · {b.plateNumber} ({occ}/{b.capacity}
                              {full ? " full" : ""})
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td>
                      {currentBus && currentBus.stops.length > 0 ? (
                        <select
                          className="field-control"
                          value={s.stop ?? ""}
                          onChange={(e) =>
                            updateAssignment(
                              s,
                              currentBus._id,
                              e.target.value || null
                            )
                          }
                          disabled={isSaving}
                          style={{ minWidth: 200 }}
                        >
                          <option value="">— None —</option>
                          {currentBus.stops.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted small">
                          {currentBus ? "No stops on route" : "—"}
                        </span>
                      )}
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
