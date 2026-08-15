import { apiFetch } from "./client";
import type { Driver } from "./collegeDrivers";

export type BusStop = {
  name: string;
  lat: number | null;
  lng: number | null;
  suspended: boolean;
  temporaryReplacement?: string | null;
};

export type Bus = {
  _id: string;
  college: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  driver: Driver | null;
  route: string;
  stops: BusStop[];
  notice: string;
  createdAt: string;
  updatedAt: string;
};

export type IssueType =
  | "breakdown"
  | "flat_tyre"
  | "refuelling"
  | "traffic"
  | "mechanical"
  | "weather"
  | "other";

/** A bus whose driver has reported a problem they have not yet resolved. */
export type BusIssueItem = {
  bus: { _id: string; busNumber: string; plateNumber: string; route: string };
  driver: {
    _id: string;
    name: string;
    mobile: string;
    licenceNumber: string;
    /** False when the driver has come off the road — the issue outlives the trip. */
    tripActive: boolean;
    currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  };
  issue: { type: IssueType; message: string; reportedAt: string };
  /** Riders on that bus — how many people the problem actually strands. */
  studentCount: number;
};

export type BusInput = {
  busNumber: string;
  plateNumber: string;
  capacity: number;
};

export type BulkFailedRow = {
  row: number;
  busNumber?: string;
  plateNumber?: string;
  error: string;
};

export type BulkResult = {
  created: Bus[];
  failed: BulkFailedRow[];
};

export type DriverAssignmentInput = {
  busNumber: string;
  licenceNumber?: string;
  mobile?: string;
};

export type BulkAssignmentFailedRow = {
  row: number;
  busNumber?: string;
  driver?: string;
  error: string;
};

export type BulkAssignmentResult = {
  applied: Bus[];
  failed: BulkAssignmentFailedRow[];
};

export type LiveBusItem = {
  bus: {
    _id: string;
    busNumber: string;
    plateNumber: string;
    capacity: number;
    route: string;
    stops: BusStop[];
    notice: string;
  };
  driver: {
    _id: string;
    name: string;
    mobile: string;
    licenceNumber: string;
    tripActive: boolean;
    currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  };
};

export const collegeBusesApi = {
  issues: (collegeId: string) =>
    apiFetch<BusIssueItem[]>(`/api/colleges/${collegeId}/buses/issues`),
  list: (collegeId: string) =>
    apiFetch<Bus[]>(`/api/colleges/${collegeId}/buses`),
  live: (collegeId: string) =>
    apiFetch<LiveBusItem[]>(`/api/colleges/${collegeId}/buses/live`),
  create: (collegeId: string, input: BusInput) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  bulkCreate: (collegeId: string, buses: BusInput[]) =>
    apiFetch<BulkResult>(`/api/colleges/${collegeId}/buses/bulk`, {
      method: "POST",
      body: JSON.stringify({ buses }),
    }),
  assignDriver: (collegeId: string, busId: string, driverId: string | null) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses/${busId}/driver`, {
      method: "PUT",
      body: JSON.stringify({ driverId }),
    }),
  // One-shot move that the plain assignDriver cannot express: releases both
  // sides before assigning, so a driver already on another bus can be moved
  // without first unassigning them. Returns only the buses that changed.
  reassignDriver: (
    collegeId: string,
    driverId: string,
    toBusId: string | null
  ) =>
    apiFetch<{ buses: Bus[] }>(
      `/api/colleges/${collegeId}/buses/reassign-driver`,
      {
        method: "POST",
        body: JSON.stringify({ driverId, toBusId }),
      }
    ),
  setRoute: (
    collegeId: string,
    busId: string,
    payload: { route: string; stops: BusStop[]; notice?: string }
  ) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses/${busId}/route`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  bulkAssignDrivers: (
    collegeId: string,
    assignments: DriverAssignmentInput[]
  ) =>
    apiFetch<BulkAssignmentResult>(
      `/api/colleges/${collegeId}/buses/driver-assignments`,
      {
        method: "POST",
        body: JSON.stringify({ assignments }),
      }
    ),
};
