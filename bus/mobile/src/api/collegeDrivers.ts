import { apiFetch } from "./client";

export type Gender = "male" | "female" | "other";

export type Driver = {
  _id: string;
  college: string;
  name: string;
  dob: string;
  gender: Gender;
  licenceNumber: string;
  aadharNumber: string;
  mobile: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type DriverInput = {
  name: string;
  dob: string;
  gender: Gender;
  licenceNumber: string;
  aadharNumber: string;
  mobile: string;
  address: string;
};

export const collegeDriversApi = {
  list: (collegeId: string) =>
    apiFetch<Driver[]>(`/api/colleges/${collegeId}/drivers`),
  create: (collegeId: string, input: DriverInput) =>
    apiFetch<Driver>(`/api/colleges/${collegeId}/drivers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (collegeId: string, driverId: string, input: DriverInput) =>
    apiFetch<Driver>(`/api/colleges/${collegeId}/drivers/${driverId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
