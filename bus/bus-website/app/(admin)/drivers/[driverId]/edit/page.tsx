"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DriverForm } from "../../../../../components/DriverForm";
import {
  collegeDriversApi,
  type Driver,
} from "../../../../../lib/api/collegeDrivers";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../../components/NoCollege";

export default function EditDriverPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const all = await collegeDriversApi.list(selected._id);
      setDriver(all.find((d) => d._id === driverId) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected, driverId]);

  useEffect(() => {
    setDriver(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Edit driver</h1>
          <p className="page-subtitle">{driver?.name ?? "Loading…"}</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {driver ? (
        <DriverForm
          initial={driver}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await collegeDriversApi.update(selected._id, driver._id, input);
            router.push("/drivers");
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
