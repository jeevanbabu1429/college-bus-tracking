import { apiFetch } from "./client";

export type DeleteAccountResult = {
  ok: true;
  role: "admin" | "driver" | "student";
  removed: {
    colleges: number;
    buses: number;
    drivers: number;
    students: number;
  };
};

// Deleting your own account. Two steps: a code goes to the account's own
// mobile number, then the reason and that code delete it for good.
export const accountApi = {
  requestDeleteOtp: () =>
    apiFetch<{ ok: true; mobile: string }>("/api/account/delete/request-otp", {
      method: "POST",
    }),

  delete: (reason: string, otp: string) =>
    apiFetch<DeleteAccountResult>("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ reason, otp }),
    }),
};
