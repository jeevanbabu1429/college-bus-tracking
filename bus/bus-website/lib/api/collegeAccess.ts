import { apiFetch } from "./client";
import type { Grant } from "./staffAuth";

export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  actions: string[];
};

export type Role = {
  _id: string;
  college: string;
  name: string;
  description: string;
  color: string;
  permissions: Grant[];
  landingPage: string;
  staffCount: number;
  createdAt: string;
};

export type StaffMember = {
  _id: string;
  name: string;
  mobile: string;
  active: boolean;
  role: { _id: string; name: string; color: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export type RoleInput = {
  name: string;
  description?: string;
  color?: string;
  permissions?: Grant[];
  landingPage?: string;
};

export const collegeAccessApi = {
  // The catalogue is served rather than hard-coded here so the matrix an admin
  // ticks always matches what the API actually enforces.
  catalogue: (collegeId: string) =>
    apiFetch<{ modules: ModuleDef[] }>(
      `/api/colleges/${collegeId}/roles/catalogue`
    ),
  listRoles: (collegeId: string) =>
    apiFetch<Role[]>(`/api/colleges/${collegeId}/roles`),
  createRole: (collegeId: string, input: RoleInput) =>
    apiFetch<Role>(`/api/colleges/${collegeId}/roles`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRole: (collegeId: string, roleId: string, input: Partial<RoleInput>) =>
    apiFetch<Role>(`/api/colleges/${collegeId}/roles/${roleId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteRole: (collegeId: string, roleId: string) =>
    apiFetch<{ ok: true }>(`/api/colleges/${collegeId}/roles/${roleId}`, {
      method: "DELETE",
    }),

  listStaff: (collegeId: string) =>
    apiFetch<StaffMember[]>(`/api/colleges/${collegeId}/staff`),
  addStaff: (
    collegeId: string,
    input: { name: string; mobile: string; roleId: string }
  ) =>
    apiFetch<StaffMember>(`/api/colleges/${collegeId}/staff`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStaff: (
    collegeId: string,
    staffId: string,
    input: { name?: string; roleId?: string; active?: boolean }
  ) =>
    apiFetch<StaffMember>(`/api/colleges/${collegeId}/staff/${staffId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  removeStaff: (collegeId: string, staffId: string) =>
    apiFetch<{ ok: true }>(`/api/colleges/${collegeId}/staff/${staffId}`, {
      method: "DELETE",
    }),
};
