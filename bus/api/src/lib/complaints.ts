import {
  COMPLAINT_CATEGORIES,
  MAX_COMPLAINT_MESSAGE,
  type Complaint,
  type ComplaintCategory,
} from "../models/Complaint.js";

/**
 * Shared shaping for complaint payloads.
 *
 * The one rule both serialisers below enforce: `screenshot` never travels in a
 * JSON body. It is a base64 data URL of up to 400 KB, and a list of twenty
 * would be an 8 MB response. Callers get a `hasScreenshot` flag and fetch the
 * bytes from the dedicated image route, which ETags them (same reasoning as
 * routes/driverPhoto.ts).
 */

type Lean = Complaint & { createdAt?: Date; updatedAt?: Date };

/** What the reporter sees about their own complaint, in the app. */
export function publicComplaint(c: Lean) {
  return {
    _id: String(c._id),
    category: c.category,
    message: c.message,
    status: c.status,
    hasScreenshot: Boolean(c.hasScreenshot),
    replies: (c.replies ?? []).map((r) => ({
      body: r.body,
      at: r.at,
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** What the super admin console sees — adds who sent it and from what. */
export function consoleComplaint(c: Lean) {
  return {
    ...publicComplaint(c),
    reporter: {
      role: c.reporter?.role ?? "student",
      id: c.reporter?.id ? String(c.reporter.id) : "",
      name: c.reporter?.name ?? "",
      mobile: c.reporter?.mobile ?? "",
    },
    college: c.college ? String(c.college) : null,
    diagnostics: {
      appVersion: c.diagnostics?.appVersion ?? "",
      buildNumber: c.diagnostics?.buildNumber ?? "",
      platform: c.diagnostics?.platform ?? "",
      osVersion: c.diagnostics?.osVersion ?? "",
      deviceModel: c.diagnostics?.deviceModel ?? "",
    },
  };
}

/** Detail view for the console — the one place the bytes are worth sending. */
export function consoleComplaintDetail(c: Lean) {
  return { ...consoleComplaint(c), screenshot: c.screenshot ?? null };
}

export function parseCategory(value: unknown): ComplaintCategory | null {
  if (typeof value !== "string") return null;
  return (COMPLAINT_CATEGORIES as readonly string[]).includes(value)
    ? (value as ComplaintCategory)
    : null;
}

export function parseMessage(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "message is required" };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Please describe the problem." };
  }
  if (trimmed.length > MAX_COMPLAINT_MESSAGE) {
    return {
      ok: false,
      error: `Please keep it under ${MAX_COMPLAINT_MESSAGE} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

// Client-supplied and purely informational, so this never rejects — it clamps.
// A complaint is worth more than a strict schema: losing the report because the
// device reported an odd model string would be the wrong trade.
export function parseDiagnostics(value: unknown) {
  const raw = (value ?? {}) as Record<string, unknown>;
  const field = (key: string) =>
    typeof raw[key] === "string" ? (raw[key] as string).slice(0, 120) : "";
  return {
    appVersion: field("appVersion"),
    buildNumber: field("buildNumber"),
    platform: field("platform"),
    osVersion: field("osVersion"),
    deviceModel: field("deviceModel"),
  };
}
