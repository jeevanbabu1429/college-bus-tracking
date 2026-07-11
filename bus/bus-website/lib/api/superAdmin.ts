import { apiFetch } from "./client";
import { getCurrentSuperToken } from "../super-auth/superTokenStore";
import type { Admin, Gender } from "./auth";
import type { College } from "./colleges";

export type SuperAdmin = {
  _id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminWithCounts = Admin & {
  counts: {
    colleges: number;
    buses: number;
    drivers: number;
    students: number;
  };
};

export type CollegeWithCounts = College & {
  counts: { buses: number; drivers: number; students: number };
};

export type AdminDetail = {
  admin: Admin;
  colleges: CollegeWithCounts[];
  counts: {
    colleges: number;
    buses: number;
    drivers: number;
    students: number;
  };
};

export type CollegeListItem = College & {
  admin: Admin | null;
  counts: { buses: number; drivers: number; students: number };
};

export type AdminPatchInput = Partial<{
  name: string;
  gender: Gender;
  dob: string;
  mobile: string;
  email: string;
}>;

export type CollegePatchInput = Partial<{
  name: string;
  address: string;
  code: string;
  busCount: number;
  driverCount: number;
}>;

// Every request routes through the same `apiFetch` but injects the super
// admin's own token via the tokenGetter override so we don't pollute the
// admin-side tokenStore.
function fetchSuper<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, init, getCurrentSuperToken);
}

export const superAdminApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; superAdmin: SuperAdmin }>(
      "/api/super/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      () => null
    ),
  me: () => fetchSuper<SuperAdmin>("/api/super/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchSuper<{ ok: true }>("/api/super/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  listAdmins: (q?: string) =>
    fetchSuper<AdminWithCounts[]>(
      `/api/super/admins${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),
  getAdmin: (id: string) => fetchSuper<AdminDetail>(`/api/super/admins/${id}`),
  updateAdmin: (id: string, input: AdminPatchInput) =>
    fetchSuper<Admin>(`/api/super/admins/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  setAdminSuspended: (id: string, suspended: boolean) =>
    fetchSuper<Admin>(`/api/super/admins/${id}/suspended`, {
      method: "PATCH",
      body: JSON.stringify({ suspended }),
    }),
  deleteAdmin: (id: string, confirmEmail: string) =>
    fetchSuper<{
      ok: true;
      deleted: {
        colleges: number;
        students: number;
        drivers: number;
        buses: number;
      };
    }>(
      `/api/super/admins/${id}?confirm=${encodeURIComponent(confirmEmail)}`,
      { method: "DELETE" }
    ),

  listColleges: (q?: string) =>
    fetchSuper<CollegeListItem[]>(
      `/api/super/colleges${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),
  updateCollege: (id: string, input: CollegePatchInput) =>
    fetchSuper<College>(`/api/super/colleges/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteCollege: (id: string, confirmCode: string) =>
    fetchSuper<{
      ok: true;
      deleted: { students: number; drivers: number; buses: number };
    }>(
      `/api/super/colleges/${id}?confirm=${encodeURIComponent(confirmCode)}`,
      { method: "DELETE" }
    ),

  getBanner: () => fetchSuper<Banner | null>("/api/super/banner"),
  putBanner: (imageDataUrl: string, active: boolean) =>
    fetchSuper<Banner>("/api/super/banner", {
      method: "PUT",
      body: JSON.stringify({ imageDataUrl, active }),
    }),
  setBannerActive: (active: boolean) =>
    fetchSuper<Banner>("/api/super/banner/active", {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  deleteBanner: () =>
    fetchSuper<{ ok: true }>("/api/super/banner", { method: "DELETE" }),
};

export type Banner = {
  _id: string;
  imageDataUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
