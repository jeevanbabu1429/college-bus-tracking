import { apiFetch } from "./client";
import type { Student } from "./collegeStudents";
import type { BusStop } from "./collegeBuses";
import type { CurrentIssue } from "./driverTrip";

export type BusLocation = {
  bus: {
    _id: string;
    busNumber: string;
    plateNumber: string;
    route: string;
    stops: BusStop[];
    notice: string;
  } | null;
  // `_id` is what the photo URL is built from — the photo itself is served
  // separately so it stays out of this endpoint's 5s polling loop.
  driver: { _id: string; name: string; mobile: string } | null;
  tripActive: boolean;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  currentIssue: CurrentIssue;
};

export type LiveBusItem = {
  bus: {
    _id: string;
    busNumber: string;
    plateNumber: string;
    route: string;
    stops: BusStop[];
    notice: string;
  };
  driver: {
    _id: string;
    name: string;
    mobile: string;
    tripActive: boolean;
    currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  };
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
  liveBuses: () =>
    apiFetch<LiveBusItem[]>("/api/student-auth/live-buses"),
};
