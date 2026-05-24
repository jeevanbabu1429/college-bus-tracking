"use client";

import { useRouter } from "next/navigation";
import { CollegeForm } from "../../../../components/CollegeForm";
import { collegesApi } from "../../../../lib/api/colleges";
import { useColleges } from "../../../../lib/college/CollegeContext";

export default function NewCollegePage() {
  const router = useRouter();
  const { refresh, selectCollege } = useColleges();

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Add college</h1>
          <p className="page-subtitle">Register a new college under your account.</p>
        </div>
      </div>

      <CollegeForm
        submitLabel="Create college"
        onSubmit={async (input) => {
          const created = await collegesApi.create(input);
          await refresh();
          selectCollege(created._id);
          router.push("/colleges");
        }}
        onCancel={() => router.back()}
      />
    </>
  );
}
