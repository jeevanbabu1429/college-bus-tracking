import { apiFetch } from "./client";
import type { Driver } from "./collegeDrivers";

export const driverAuthApi = {
  requestOtp: (mobile: string) =>
    apiFetch<{ ok: true }>("/api/driver-auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyOtp: (mobile: string, otp: string) =>
    apiFetch<{ token: string; driver: Driver }>(
      "/api/driver-auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ mobile, otp }),
      }
    ),
};
