"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DriverForm } from "../../../../../components/DriverForm";
import {
  collegeDriversApi,
  type Driver,
} from "../../../../../lib/api/collegeDrivers";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import { NoCollege } from "../../../../../components/NoCollege";
import { IconArrowLeft } from "../../../../../components/icons";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EditDriverPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const [driver, setDriver] = useState<Driver | null>(null);
  // Tracked separately from `driver` so a driver that doesn't exist shows a
  // "not found" panel instead of a spinner that never resolves.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const all = await collegeDriversApi.list(selected._id);
      setDriver(all.find((d) => d._id === driverId) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
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
          <p className="page-subtitle">
            Changes take effect on the driver&rsquo;s app the next time they
            sign in.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/drivers" className="btn btn-secondary">
            <IconArrowLeft size={14} /> All drivers
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {driver && (
        <div className="subject">
          <span className="subject-avatar" aria-hidden>
            {driver.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.image} alt="" />
            ) : (
              initialsOf(driver.name)
            )}
          </span>
          <span className="subject-body">
            <span className="subject-name">{driver.name}</span>
            <span className="subject-meta">
              <span>Licence {driver.licenceNumber}</span>
              <span className="subject-meta-dot" aria-hidden>
                ·
              </span>
              <span>{driver.mobile}</span>
            </span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="skeleton-form" aria-hidden>
          <span className="skeleton-line" data-tall />
          <span className="skeleton-line" data-tall />
          <span className="skeleton-line" />
        </div>
      ) : driver ? (
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
        !error && (
          <div className="empty-state">
            <h3>Driver not found</h3>
            <p>
              This driver is no longer in {selected.name} — they may have been
              removed.{" "}
              <Link href="/drivers" className="auth-link">
                Back to all drivers
              </Link>
              .
            </p>
          </div>
        )
      )}
    </>
  );
}
