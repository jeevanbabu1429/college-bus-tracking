import { apiFetch } from "./client";

export type Gender = "male" | "female" | "other";

export type AssignedBus = {
  _id: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  route?: string;
  stops?: string[];
};

export type Student = {
  _id: string;
  college: string;
  name: string;
  rollNumber: string;
  gender: Gender;
  dob: string;
  address: string;
  mobile: string;
  bus: AssignedBus | null;
  stop: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentInput = {
  name: string;
  rollNumber: string;
  gender: Gender;
  dob: string;
  address: string;
  mobile: string;
  busId?: string | null;
  stop?: string | null;
};

export const collegeStudentsApi = {
  list: (collegeId: string) =>
    apiFetch<Student[]>(`/api/colleges/${collegeId}/students`),
  create: (collegeId: string, input: StudentInput) =>
    apiFetch<Student>(`/api/colleges/${collegeId}/students`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (collegeId: string, studentId: string, input: StudentInput) =>
    apiFetch<Student>(`/api/colleges/${collegeId}/students/${studentId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  assignBus: (
    collegeId: string,
    studentId: string,
    busId: string | null,
    stop?: string | null
  ) =>
    apiFetch<Student>(
      `/api/colleges/${collegeId}/students/${studentId}/bus`,
      {
        method: "PUT",
        body: JSON.stringify({ busId, stop }),
      }
    ),
};
