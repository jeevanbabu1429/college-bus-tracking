"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { CollegeForm } from "../../../../../components/CollegeForm";
import { collegesApi } from "../../../../../lib/api/colleges";
import { useColleges } from "../../../../../lib/college/CollegeContext";

export default function EditCollegePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { colleges, refresh } = useColleges();
  const college = colleges?.find((c) => c._id === id) ?? null;

  if (!colleges) {
    return (
      <div className="center" style={{ padding: 40 }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!college) {
    return (
      <div className="empty-state">
        <h3>College not found</h3>
        <p>It may have been removed or doesn't belong to your account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Edit college</h1>
          <p className="page-subtitle">{college.name} · {college.code}</p>
        </div>
      </div>

      <CollegeForm
        initial={college}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await collegesApi.update(id, input);
          await refresh();
          router.push("/colleges");
        }}
        onCancel={() => router.back()}
      />
    </>
  );
}
