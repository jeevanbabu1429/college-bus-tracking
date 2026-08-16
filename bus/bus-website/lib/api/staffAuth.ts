import { apiFetch } from "./client";

/** A permission grant: what a role may do in one module. */
export type Grant = { module: string; actions: string[] };

export type StaffProfile = {
  _id: string;
  name: string;
  mobile: string;
  active: boolean;
  college: { _id: string; name: string; code: string; address: string } | null;
  role: {
    _id: string;
    name: string;
    description: string;
    landingPage: string;
    permissions: Grant[];
  } | null;
};

/** Returned instead of a token when one mobile is staff at more than one college. */
export type CollegeChoice = {
  staffId: string;
  collegeId: string;
  collegeName: string;
  collegeCode: string;
};

export type StaffVerifyResult =
  | { token: string; staff: StaffProfile; needsCollege?: false }
  | { needsCollege: true; options: CollegeChoice[] };

export const staffAuthApi = {
  requestOtp: (mobile: string) =>
    apiFetch<{ ok: true }>("/api/staff-auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyOtp: (mobile: string, otp: string, staffId?: string) =>
    apiFetch<StaffVerifyResult>("/api/staff-auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ mobile, otp, staffId }),
    }),
  me: () => apiFetch<StaffProfile>("/api/staff-auth/me"),
};
