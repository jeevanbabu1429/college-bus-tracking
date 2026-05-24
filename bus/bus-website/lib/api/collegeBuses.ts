import { apiFetch } from "./client";
import type { Driver } from "./collegeDrivers";

export type Bus = {
  _id: string;
  college: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  driver: Driver | null;
  route: string;
  stops: string[];
  createdAt: string;
  updatedAt: string;
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

export const collegeBusesApi = {
  list: (collegeId: string) =>
    apiFetch<Bus[]>(`/api/colleges/${collegeId}/buses`),
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
  setRoute: (
    collegeId: string,
    busId: string,
    payload: { route: string; stops: string[] }
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
