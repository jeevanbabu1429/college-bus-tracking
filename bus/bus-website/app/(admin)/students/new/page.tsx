"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentForm } from "../../../../components/StudentForm";
import { collegeStudentsApi } from "../../../../lib/api/collegeStudents";
import {
  collegeBusesApi,
  type Bus,
} from "../../../../lib/api/collegeBuses";
import { useColleges } from "../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../components/NoCollege";

export default function NewStudentPage() {
  const router = useRouter();
  const { selected } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBuses = useCallback(async () => {
    if (!selected) return;
    try {
      setBuses(await collegeBusesApi.list(selected._id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setBuses(null);
    loadBuses();
  }, [loadBuses]);

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Add student</h1>
          <p className="page-subtitle">Enrol a new student in {selected.name}.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {buses === null ? (
        <div className="center" style={{ padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : (
        <StudentForm
          buses={buses}
          submitLabel="Create student"
          onSubmit={async (input) => {
            await collegeStudentsApi.create(selected._id, input);
            router.push("/students");
          }}
          onCancel={() => router.back()}
        />
      )}
    </>
  );
}
