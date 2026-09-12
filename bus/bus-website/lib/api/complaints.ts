import { apiFetch } from "./client";
import { getCurrentSuperToken } from "../super-auth/superTokenStore";

export const COMPLAINT_STATUSES = ["open", "in_progress", "resolved"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Something is broken",
  login: "Trouble signing in",
  tracking: "Live tracking or the map",
  notifications: "Notifications",
  data: "Wrong details shown",
  other: "Something else",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? "Something else";
}

export type ComplaintReply = { body: string; at: string };

export type Complaint = {
  _id: string;
  category: string;
  message: string;
  status: ComplaintStatus;
  hasScreenshot: boolean;
  replies: ComplaintReply[];
  createdAt: string;
  updatedAt: string;
  reporter: { role: string; id: string; name: string; mobile: string };
  college: string | null;
  diagnostics: {
    appVersion: string;
    buildNumber: string;
    platform: string;
    osVersion: string;
    deviceModel: string;
  };
};

/**
 * The detail view carries the screenshot inline; the list never does. A list of
 * 25 complaints each holding a 400 KB data URL would be a 10 MB response, so
 * the API strips the bytes there and leaves `hasScreenshot` behind.
 */
export type ComplaintDetail = Complaint & { screenshot: string | null };

export type ComplaintPage = {
  complaints: Complaint[];
  page: number;
  pageSize: number;
  total: number;
  counts: Record<ComplaintStatus, number>;
};

function fetchSuper<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, init, getCurrentSuperToken);
}

export const complaintsApi = {
  list: (opts: { status?: ComplaintStatus; page?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.page && opts.page > 1) params.set("page", String(opts.page));
    const qs = params.toString();
    return fetchSuper<ComplaintPage>(
      `/api/super/complaints${qs ? `?${qs}` : ""}`
    );
  },

  get: (id: string) => fetchSuper<ComplaintDetail>(`/api/super/complaints/${id}`),

  setStatus: (id: string, status: ComplaintStatus) =>
    fetchSuper<Complaint>(`/api/super/complaints/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  reply: (id: string, body: string) =>
    fetchSuper<Complaint>(`/api/super/complaints/${id}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  remove: (id: string) =>
    fetchSuper<{ ok: true }>(`/api/super/complaints/${id}`, {
      method: "DELETE",
    }),
};
