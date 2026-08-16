"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import { usePermissions } from "../../../lib/auth/permissions";
import {
  collegeAccessApi,
  type ModuleDef,
  type Role,
  type StaffMember,
} from "../../../lib/api/collegeAccess";
import type { Grant } from "../../../lib/api/staffAuth";
import { NoCollege } from "../../../components/NoCollege";
import { RolePermissions } from "../../../components/RolePermissions";
import { StaffPanel } from "../../../components/StaffPanel";
import { IconPlus, IconShield, IconUsers } from "../../../components/icons";

type Tab = "roles" | "people";

export default function RolesAccessPage() {
  const { selected } = useColleges();
  const perms = usePermissions();

  const [tab, setTab] = useState<Tab>("roles");
  const [modules, setModules] = useState<ModuleDef[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [cat, rs, ss] = await Promise.all([
        collegeAccessApi.catalogue(selected._id),
        collegeAccessApi.listRoles(selected._id),
        collegeAccessApi.listStaff(selected._id),
      ]);
      setModules(cat.modules);
      setRoles(rs);
      setStaff(ss);
      setSelectedRoleId((prev) =>
        prev && rs.some((r) => r._id === prev) ? prev : rs[0]?._id ?? null
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setRoles(null);
    setStaff(null);
    load();
  }, [load]);

  const canEdit = perms.can("access", "update");
  const canCreate = perms.can("access", "create");
  const canDelete = perms.can("access", "delete");

  const activeRole = useMemo(
    () => (roles ?? []).find((r) => r._id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  if (!selected) return <NoCollege />;

  async function createRole() {
    if (!selected) return;
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      const role = await collegeAccessApi.createRole(selected._id, {
        name,
        permissions: [],
      });
      setRoles((prev) => [...(prev ?? []), role]);
      setSelectedRoleId(role._id);
      setNewName("");
      setCreating(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveRole(patch: {
    permissions?: Grant[];
    landingPage?: string;
    name?: string;
    description?: string;
  }) {
    if (!selected || !activeRole) return;
    setError(null);
    const updated = await collegeAccessApi.updateRole(
      selected._id,
      activeRole._id,
      patch
    );
    setRoles((prev) =>
      (prev ?? []).map((r) => (r._id === updated._id ? updated : r))
    );
  }

  async function deleteRole(role: Role) {
    if (!selected) return;
    setError(null);
    try {
      await collegeAccessApi.deleteRole(selected._id, role._id);
      setRoles((prev) => (prev ?? []).filter((r) => r._id !== role._id));
      setSelectedRoleId((prev) => (prev === role._id ? null : prev));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Roles &amp; access</h1>
          <p className="page-subtitle">
            Give people at {selected.name} their own sign-in, and decide what
            each of them can reach.
          </p>
        </div>
        {tab === "roles" && canCreate && !creating && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              <IconPlus size={14} /> Create role
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="access-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "roles"}
          className="access-tab"
          data-active={tab === "roles"}
          onClick={() => setTab("roles")}
        >
          <IconShield size={14} /> Roles &amp; permissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "people"}
          className="access-tab"
          data-active={tab === "people"}
          onClick={() => setTab("people")}
        >
          <IconUsers size={14} /> People
          {staff && <span className="access-tab-count">{staff.length}</span>}
        </button>
      </div>

      {tab === "people" ? (
        <StaffPanel
          collegeId={selected._id}
          roles={roles ?? []}
          staff={staff}
          canEdit={canEdit}
          canCreate={canCreate}
          canDelete={canDelete}
          onChange={setStaff}
          onError={setError}
        />
      ) : roles === null || modules === null ? (
        <div className="center" style={{ padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : (
        <div className="access-board">
          <aside className="access-roles">
            <div className="access-roles-head">Roles</div>

            {creating && (
              <div className="access-new">
                <input
                  className="field-control"
                  placeholder="e.g. Transport Officer"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createRole();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                />
                <div className="access-new-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={createRole}
                    disabled={!newName.trim()}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {roles.length === 0 && !creating ? (
              <p className="access-empty">
                No roles yet. Create one, then add people to it.
              </p>
            ) : (
              roles.map((role) => (
                <button
                  key={role._id}
                  type="button"
                  className="access-role"
                  data-active={role._id === selectedRoleId}
                  onClick={() => setSelectedRoleId(role._id)}
                >
                  <span className="access-role-name">{role.name}</span>
                  {role.description && (
                    <span className="access-role-desc">{role.description}</span>
                  )}
                  <span className="access-role-count">
                    {role.staffCount}{" "}
                    {role.staffCount === 1 ? "person" : "people"}
                  </span>
                </button>
              ))
            )}
          </aside>

          {activeRole ? (
            <RolePermissions
              key={activeRole._id}
              role={activeRole}
              modules={modules}
              canEdit={canEdit}
              canDelete={canDelete}
              onSave={saveRole}
              onDelete={() => deleteRole(activeRole)}
            />
          ) : (
            <div className="card center" style={{ padding: 48 }}>
              <p className="muted">
                Pick a role on the left to set what it can reach.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
