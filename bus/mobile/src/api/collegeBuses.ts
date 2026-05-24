import { apiFetch } from "./client";
import type { Driver } from "./collegeDrivers";

export type BusStop = {
  name: string;
  lat: number | null;
  lng: number | null;
  suspended: boolean;
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

export type BusInput = {
  busNumber: string;
  plateNumber: string;
  capacity: number;
};

export const collegeBusesApi = {
  list: (collegeId: string) =>
    apiFetch<Bus[]>(`/api/colleges/${collegeId}/buses`),
  create: (collegeId: string, input: BusInput) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  assignDriver: (collegeId: string, busId: string, driverId: string | null) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses/${busId}/driver`, {
      method: "PUT",
      body: JSON.stringify({ driverId }),
    }),
  setRoute: (
    collegeId: string,
    busId: string,
    payload: { route: string; stops: BusStop[]; notice?: string }
  ) =>
    apiFetch<Bus>(`/api/colleges/${collegeId}/buses/${busId}/route`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};
