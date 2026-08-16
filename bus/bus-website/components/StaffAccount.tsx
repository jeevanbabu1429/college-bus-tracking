"use client";

import type { StaffProfile } from "../lib/api/staffAuth";

/**
 * What a staff member sees under Account.
 *
 * Read-only throughout: their name, number and role were set by the admin who
 * gave them access, and letting them edit any of it here would either be a lie
 * (the change goes nowhere) or a way to widen their own permissions.
 */
export function StaffAccount({ staff }: { staff: StaffProfile }) {
  const grants = staff.role?.permissions ?? [];

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Account</h1>
          <p className="page-subtitle">
            Your access was set up by your college admin.
          </p>
        </div>
      </div>

      <div className="subject">
        <span className="subject-avatar" aria-hidden>
          {staff.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="subject-body">
          <span className="subject-name">{staff.name}</span>
          <span className="subject-meta">
            <span>{staff.mobile}</span>
            {staff.college && (
              <>
                <span className="subject-meta-dot" aria-hidden>
                  ·
                </span>
                <span>{staff.college.name}</span>
              </>
            )}
          </span>
        </span>
        {staff.role && <span className="pill pill-accent">{staff.role.name}</span>}
      </div>

      <div className="card">
        <div className="card-titlerow" style={{ marginBottom: 14 }}>
          <div className="card-title">What you can reach</div>
        </div>
        {grants.length === 0 ? (
          <p className="muted">
            Your role has no modules yet. Ask your admin to open up what you
            need.
          </p>
        ) : (
          <div className="access-modules">
            {grants.map((grant) => (
              <div className="access-module" key={grant.module}>
                <div className="access-module-head">
                  <div className="access-module-title" style={{ textTransform: "capitalize" }}>
                    {grant.module}
                  </div>
                </div>
                <div className="access-actions">
                  {grant.actions.map((action) => (
                    <span className="access-chip" data-on="true" key={action}>
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted small" style={{ marginTop: 14 }}>
          Need something else? Your college admin can change your role.
        </p>
      </div>
    </>
  );
}
