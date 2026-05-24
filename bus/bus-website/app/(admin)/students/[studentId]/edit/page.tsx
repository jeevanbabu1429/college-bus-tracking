"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentForm } from "../../../../../components/StudentForm";
import {
  collegeStudentsApi,
  type Student,
} from "../../../../../lib/api/collegeStudents";
import {
  collegeBusesApi,
  type Bus,
} from "../../../../../lib/api/collegeBuses";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../../components/NoCollege";

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const [student, setStudent] = useState<Student | null>(null);
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [students, allBuses] = await Promise.all([
        collegeStudentsApi.list(selected._id),
        collegeBusesApi.list(selected._id),
      ]);
      setStudent(students.find((s) => s._id === studentId) ?? null);
      setBuses(allBuses);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected, studentId]);

  useEffect(() => {
    setStudent(null);
    setBuses(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Edit student</h1>
          <p className="page-subtitle">{student?.name ?? "Loading…"}</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {student && buses ? (
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
        <div className="center" style={{ padding: 40 }}>
          <span className="spinner" />
        </div>
      )}
    </>
  );
}
