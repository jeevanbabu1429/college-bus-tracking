"use client";

import { useState } from "react";
import {
  collegeAccessApi,
  type Role,
  type StaffMember,
} from "../lib/api/collegeAccess";
import { IconPlus } from "./icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function lastSeen(value: string | null): string {
  if (!value) return "Never signed in";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Signed in today";
  if (days === 1) return "Signed in yesterday";
  if (days < 30) return `Signed in ${days} days ago`;
  return `Signed in ${Math.floor(days / 30)} months ago`;
}

/**
 * The people who hold a role, and the form for adding one.
 *
 * There is no password to set or invitation to send: a staff member signs in
 * with the mobile number entered here and a one-time code, exactly as drivers
 * and students already do.
 */
export function StaffPanel({
  collegeId,
  roles,
  staff,
  canEdit,
  canCreate,
  canDelete,
  onChange,
  onError,
}: {
  collegeId: string;
  roles: Role[];
  staff: StaffMember[] | null;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onChange: (next: StaffMember[]) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = name.trim() && mobile.replace(/\D/g, "").length >= 10 && roleId;

  async function add() {
    if (!ready || busy) return;
    setBusy(true);
    onError(null);
    try {
      const created = await collegeAccessApi.addStaff(collegeId, {
        name: name.trim(),
        mobile: mobile.trim(),
        roleId,
      });
      onChange([created, ...(staff ?? [])]);
      setName("");
      setMobile("");
      setRoleId("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(member: StaffMember, body: { roleId?: string; active?: boolean }) {
    onError(null);
    try {
      const updated = await collegeAccessApi.updateStaff(collegeId, member._id, body);
      onChange((staff ?? []).map((s) => (s._id === updated._id ? updated : s)));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function remove(member: StaffMember) {
    onError(null);
    try {
      await collegeAccessApi.removeStaff(collegeId, member._id);
      onChange((staff ?? []).filter((s) => s._id !== member._id));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  if (staff === null) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      {canCreate && (
        <div className="card">
          <div className="card-titlerow" style={{ marginBottom: 16 }}>
            <div className="card-title">Add someone</div>
          </div>
          {roles.length === 0 ? (
            <p className="muted">
              Create a role first — everyone you add has to have one.
            </p>
          ) : (
            <>
              <div className="form-grid">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" htmlFor="staff-name">
                    Name
                  </label>
                  <input
                    id="staff-name"
                    className="field-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Raman"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" htmlFor="staff-mobile">
                    Mobile
                  </label>
                  <input
                    id="staff-mobile"
                    className="field-control"
                    value={mobile}
                    inputMode="tel"
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9876543210"
                  />
                  <span className="field-help">
                    They sign in with this number and a one-time code.
                  </span>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="field-label" htmlFor="staff-role">
                    Role
                  </label>
                  <select
                    id="staff-role"
                    className="field-control"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    <option value="">— Pick a role —</option>
                    {roles.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!ready || busy}
                  onClick={add}
                >
                  {busy ? <span className="spinner spinner-light" /> : (
                    <>
                      <IconPlus size={14} /> Add person
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="table-card">
        <div className="card-header">
          <div className="card-title">
            People
            <span className="muted small" style={{ marginLeft: 8, fontWeight: 400 }}>
              {staff.length}
            </span>
          </div>
        </div>
        {staff.length === 0 ? (
          <p className="muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
            Nobody has been given access yet.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member._id} data-off={!member.active || undefined}>
                  <td>
                    <div className="row-with-avatar">
                      <span className="row-avatar">{initials(member.name)}</span>
                      <div className="flex-col">
                        <span className="table-name">{member.name}</span>
                        <span className="muted small">{lastSeen(member.lastLoginAt)}</span>
                      </div>
                    </div>
                  </td>
                  <td>{member.mobile}</td>
                  <td>
                    {canEdit ? (
                      <select
                        className="field-control"
                        value={member.role?._id ?? ""}
                        onChange={(e) => patch(member, { roleId: e.target.value })}
                        style={{ minWidth: 170 }}
                      >
                        {roles.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      member.role?.name ?? "—"
                    )}
                  </td>
                  <td>
                    {member.active ? (
                      <span className="pill pill-success">Active</span>
                    ) : (
                      <span className="pill pill-danger">Switched off</span>
                    )}
                  </td>
                  <td className="table-actions">
                    {canEdit && (
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => patch(member, { active: !member.active })}
                        title={
                          member.active
                            ? "Block them from signing in, keeping the record"
                            : "Let them sign in again"
                        }
                      >
                        {member.active ? "Switch off" : "Switch on"}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="link-action link-action-danger"
                        onClick={() => remove(member)}
                      >
                        Remove
                      </button>
                    )}
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
