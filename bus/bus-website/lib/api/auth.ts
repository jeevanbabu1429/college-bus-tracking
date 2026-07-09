import { apiFetch } from "./client";

export type Gender = "male" | "female" | "other";

export type Admin = {
  _id: string;
  adminId: string;
  name: string;
  gender: Gender;
  dob: string;
  mobile: string;
  email: string;
  suspended?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RegisterInput = {
  name: string;
  gender: Gender;
  dob: string;
  mobile: string;
  email: string;
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiFetch<{ admin: Admin }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestOtp: (mobile: string) =>
    apiFetch<{ ok: true }>("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyOtp: (mobile: string, otp: string) =>
    apiFetch<{ token: string; admin: Admin }>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    }),
  updateMe: (input: RegisterInput) =>
    apiFetch<{ admin: Admin }>("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
