import { apiFetch, authedImageSource } from "./client";
import type { Driver } from "./collegeDrivers";

/** The driver's own profile. Unlike the login payload this carries the photo. */
export type DriverProfile = Driver & { image: string | null };

// Driver photos are served as real images (with ETag revalidation) rather than
// inlined into JSON, so they stay out of the student dashboard's 5s poll.
export function driverPhotoSource(driverId: string) {
  return authedImageSource(`/api/drivers/${driverId}/photo`);
}

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
  me: () => apiFetch<DriverProfile>("/api/driver-auth/me"),
  updatePhoto: (image: string | null) =>
    apiFetch<{ ok: true; image: string | null }>("/api/driver-auth/me/photo", {
      method: "PUT",
      body: JSON.stringify({ image }),
    }),
};
