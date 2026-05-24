import { apiFetch } from "./client";

export type College = {
  _id: string;
  name: string;
  address: string;
  code: string;
  busCount: number;
  driverCount: number;
  actualBusCount: number;
  actualDriverCount: number;
  actualStudentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CollegeInput = {
  name: string;
  address: string;
  code: string;
  busCount: number;
  driverCount: number;
};

export const collegesApi = {
  list: () => apiFetch<College[]>("/api/colleges"),
  create: (input: CollegeInput) =>
    apiFetch<College>("/api/colleges", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (collegeId: string, input: CollegeInput) =>
    apiFetch<College>(`/api/colleges/${collegeId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  claimOrphans: () =>
    apiFetch<{ claimed: number }>("/api/colleges/claim-orphans", {
      method: "POST",
    }),
};
