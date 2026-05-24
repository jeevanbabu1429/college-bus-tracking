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

export type BulkFailedStudentRow = {
  row: number;
  name?: string;
  rollNumber?: string;
  error: string;
};

export type BulkStudentResult = {
  created: Student[];
  failed: BulkFailedStudentRow[];
};

export type StudentBulkInput = Omit<StudentInput, "busId" | "stop">;

export type BusAssignmentInput = {
  rollNumber?: string;
  mobile?: string;
  busNumber?: string;
  stop?: string;
};

export type BulkBusAssignmentFailedRow = {
  row: number;
  student?: string;
  busNumber?: string;
  error: string;
};

export type BulkBusAssignmentResult = {
  applied: Student[];
  failed: BulkBusAssignmentFailedRow[];
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
  bulkCreate: (collegeId: string, students: StudentBulkInput[]) =>
    apiFetch<BulkStudentResult>(`/api/colleges/${collegeId}/students/bulk`, {
      method: "POST",
      body: JSON.stringify({ students }),
    }),
  bulkAssignBus: (collegeId: string, assignments: BusAssignmentInput[]) =>
    apiFetch<BulkBusAssignmentResult>(
      `/api/colleges/${collegeId}/students/bus-assignments`,
      {
        method: "POST",
        body: JSON.stringify({ assignments }),
      }
    ),
};
