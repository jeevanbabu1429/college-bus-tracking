import { apiFetch, authedImageSource } from "./client";
import { collectDiagnostics } from "../lib/diagnostics";

export const COMPLAINT_CATEGORIES = [
  { key: "bug", label: "Something is broken" },
  { key: "login", label: "Trouble signing in" },
  { key: "tracking", label: "Live tracking or the map" },
  { key: "notifications", label: "Notifications" },
  { key: "data", label: "Wrong details shown" },
  { key: "other", label: "Something else" },
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]["key"];
export type ComplaintStatus = "open" | "in_progress" | "resolved";

export type ComplaintReply = { body: string; at: string };

export type Complaint = {
  _id: string;
  category: ComplaintCategory;
  message: string;
  status: ComplaintStatus;
  hasScreenshot: boolean;
  replies: ComplaintReply[];
  createdAt: string;
  updatedAt: string;
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: "Open",
  in_progress: "Being looked at",
  resolved: "Resolved",
};

export function categoryLabel(key: string): string {
  return COMPLAINT_CATEGORIES.find((c) => c.key === key)?.label ?? "Something else";
}

export const complaintsApi = {
  // Diagnostics are gathered here rather than at the call site so every path
  // that raises a complaint sends them, and no screen has to remember to.
  create: (input: {
    category: ComplaintCategory;
    message: string;
    screenshot?: string | null;
  }) =>
    apiFetch<Complaint>("/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        category: input.category,
        message: input.message,
        screenshot: input.screenshot ?? undefined,
        diagnostics: collectDiagnostics(),
      }),
    }),

  mine: () => apiFetch<Complaint[]>("/api/complaints/mine"),
};

// Screenshots are served as real image responses, not inlined into JSON, so
// they need the bearer header the same way driver photos do.
export function complaintScreenshotSource(complaintId: string) {
  return authedImageSource(`/api/complaints/${complaintId}/screenshot`);
}
