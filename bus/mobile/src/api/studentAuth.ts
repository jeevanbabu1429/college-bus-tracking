import { apiFetch } from "./client";
import type { Student } from "./collegeStudents";
import type { BusStop } from "./collegeBuses";

export type BusLocation = {
  bus: {
    _id: string;
    busNumber: string;
    plateNumber: string;
    route: string;
    stops: BusStop[];
    notice: string;
  } | null;
  tripActive: boolean;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
};

export const studentAuthApi = {
  requestOtp: (mobile: string) =>
    apiFetch<{ ok: true }>("/api/student-auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyOtp: (mobile: string, otp: string) =>
    apiFetch<{ token: string; student: Student }>(
      "/api/student-auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ mobile, otp }),
      }
    ),
  me: () => apiFetch<Student>("/api/student-auth/me"),
  busLocation: () => apiFetch<BusLocation>("/api/student-auth/bus-location"),
};
