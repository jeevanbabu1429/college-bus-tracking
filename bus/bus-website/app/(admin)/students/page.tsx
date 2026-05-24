"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeStudentsApi,
  type Student,
} from "../../../lib/api/collegeStudents";
import { NoCollege } from "../../../components/NoCollege";
import { IconPlus, IconUpload } from "../../../components/icons";

export default function StudentsPage() {
  const { selected } = useColleges();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      setStudents(await collegeStudentsApi.list(selected._id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setStudents(null);
    load();
  }, [load]);

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

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            Pupils enrolled at {selected.name}.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/assign-students" className="btn btn-secondary">
            Assign seats
          </Link>
          <Link href="/students/bulk" className="btn btn-secondary">
            <IconUpload size={14} /> Bulk upload
          </Link>
          <Link href="/students/new" className="btn btn-primary">
            <IconPlus size={14} /> Add student
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
        {students === null ? (
          <div className="center" style={{ padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ border: "none" }}>
            <h3>
              {students.length === 0 ? "No students yet" : "No students match"}
            </h3>
            <p>
              {students.length === 0
                ? "Enrol your first student to begin."
                : "Try a different search term."}
            </p>
            {students.length === 0 && (
              <Link href="/students/new" className="btn btn-primary">
                <IconPlus size={14} /> Add student
              </Link>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll</th>
                <th>Mobile</th>
                <th>Bus</th>
                <th>Stop</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s._id}>
                  <td>
                    <span className="table-name">{s.name}</span>
                    <div
                      className="small muted"
                      style={{ marginTop: 2, textTransform: "capitalize" }}
                    >
                      {s.gender}
                    </div>
                  </td>
                  <td>{s.rollNumber}</td>
                  <td>{s.mobile}</td>
                  <td>
                    {s.bus ? (
                      <span>
                        {s.bus.busNumber}{" "}
                        <span className="muted small">
                          · {s.bus.plateNumber}
                        </span>
                      </span>
                    ) : (
                      <span className="pill pill-warning">Unassigned</span>
                    )}
                  </td>
                  <td>
                    {s.stop ? s.stop : <span className="muted">—</span>}
                  </td>
                  <td className="table-actions">
                    <Link
                      href={`/students/${s._id}/edit`}
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
