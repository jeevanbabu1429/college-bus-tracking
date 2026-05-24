"use client";

import { useRouter } from "next/navigation";
import { DriverForm } from "../../../../components/DriverForm";
import { collegeDriversApi } from "../../../../lib/api/collegeDrivers";
import { useColleges } from "../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../components/NoCollege";

export default function NewDriverPage() {
  const router = useRouter();
  const { selected } = useColleges();

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Add driver</h1>
          <p className="page-subtitle">Onboard a new driver for {selected.name}.</p>
        </div>
      </div>

      <DriverForm
        submitLabel="Create driver"
        onSubmit={async (input) => {
          await collegeDriversApi.create(selected._id, input);
          router.push("/drivers");
        }}
        onCancel={() => router.back()}
      />
    </>
  );
}
