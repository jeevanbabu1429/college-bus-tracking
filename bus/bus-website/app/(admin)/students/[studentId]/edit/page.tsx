"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentForm } from "../../../../../components/StudentForm";
import {
  collegeStudentsApi,
  type Student,
} from "../../../../../lib/api/collegeStudents";
import { collegeBusesApi, type Bus } from "../../../../../lib/api/collegeBuses";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../../components/NoCollege";
import { IconArrowLeft } from "../../../../../components/icons";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const [student, setStudent] = useState<Student | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  // Tracked separately from `student` so a student that doesn't exist shows a
  // "not found" panel instead of a spinner that never resolves.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const [students, allBuses] = await Promise.all([
        collegeStudentsApi.list(selected._id),
        collegeBusesApi.list(selected._id),
      ]);
      setStudent(students.find((s) => s._id === studentId) ?? null);
      setBuses(allBuses);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selected, studentId]);

  useEffect(() => {
    setStudent(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Edit student</h1>
          <p className="page-subtitle">
            Details, contact and bus for this student in {selected.name}.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/students" className="btn btn-secondary">
            <IconArrowLeft size={14} /> All students
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {student && (
        <div className="subject">
          <span className="subject-avatar" aria-hidden>
            {initialsOf(student.name)}
          </span>
          <span className="subject-body">
            <span className="subject-name">{student.name}</span>
            <span className="subject-meta">
              <span>Roll {student.rollNumber}</span>
              <span className="subject-meta-dot" aria-hidden>
                ·
              </span>
              <span>{student.mobile}</span>
            </span>
          </span>
          {student.bus ? (
            <span className="pill pill-accent">
              Bus {student.bus.busNumber}
              {student.stop ? ` · ${student.stop}` : ""}
            </span>
          ) : (
            <span className="pill pill-plain">No bus</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="skeleton-form" aria-hidden>
          <span className="skeleton-line" data-tall />
          <span className="skeleton-line" data-tall />
          <span className="skeleton-line" />
        </div>
      ) : student ? (
        <StudentForm
          initial={student}
          buses={buses}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await collegeStudentsApi.update(selected._id, student._id, input);
            router.push("/students");
          }}
          onCancel={() => router.back()}
        />
      ) : (
        !error && (
          <div className="empty-state">
            <h3>Student not found</h3>
            <p>
              This student is no longer in {selected.name} — they may have been
              removed.{" "}
              <Link href="/students" className="auth-link">
                Back to all students
              </Link>
              .
            </p>
          </div>
        )
      )}
    </>
  );
}
