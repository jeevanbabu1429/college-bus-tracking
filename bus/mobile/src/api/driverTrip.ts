import { apiFetch } from "./client";
import type { BusStop } from "./collegeBuses";

export type TripBus = {
  _id: string;
  busNumber: string;
  plateNumber: string;
  route: string;
  stops: BusStop[];
  notice: string;
};

export type TripLocation = {
  lat: number;
  lng: number;
  updatedAt: string;
} | null;

export type TripStatus = {
  bus: TripBus;
  tripActive: boolean;
  currentLocation: TripLocation;
};

export const driverTripApi = {
  status: () => apiFetch<TripStatus>("/api/driver/trip/status"),
  start: () =>
    apiFetch<{ ok: true }>("/api/driver/trip/start", { method: "POST" }),
  stop: () =>
    apiFetch<{ ok: true }>("/api/driver/trip/stop", { method: "POST" }),
  sendLocation: (lat: number, lng: number) =>
    apiFetch<{ ok: true }>("/api/driver/trip/location", {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),
};
