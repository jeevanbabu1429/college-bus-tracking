"use client";

import {
  STATUS_LABELS,
  type ComplaintStatus,
} from "../../../../lib/api/complaints";

// Shared by the list and the detail page. Kept out of page.tsx because a route
// file should export a component and the App Router's own conventions, nothing
// else.

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  driver: "Driver",
  student: "Student",
};

export function StatusPill({ status }: { status: ComplaintStatus }) {
  const tone =
    status === "resolved"
      ? "pill-success"
      : status === "in_progress"
        ? "pill-accent"
        : "pill-warning";
  return <span className={`pill ${tone}`}>{STATUS_LABELS[status]}</span>;
}

export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
