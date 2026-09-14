import type { ErrorRequestHandler, RequestHandler } from "express";

// Every error a person can see must read as plain English. The web console and
// the mobile app show `error` from the JSON body as-is, so nothing from
// Mongoose, MongoDB or body-parser may pass through unchanged.

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  dob: "date of birth",
  gender: "gender",
  mobile: "mobile number",
  email: "email address",
  address: "address",
  rollNumber: "roll number",
  licenceNumber: "licence number",
  aadharNumber: "Aadhaar number",
  busNumber: "bus number",
  plateNumber: "plate number",
  capacity: "capacity",
  code: "college code",
  route: "route",
  stops: "stops",
};

/** A code field name as the words a person would use for it. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? "value";
}

/** Message for a unique-index clash on `field`. */
export function duplicateMessage(field: string | undefined): string {
  if (!field || !FIELD_LABELS[field]) {
    return "This record already exists.";
  }
  return `This ${fieldLabel(field)} is already in use.`;
}

/** The first field named in a MongoDB duplicate-key error, if any. */
export function duplicateField(err: unknown): string | undefined {
  const pattern = (err as { keyPattern?: Record<string, number> })?.keyPattern;
  if (!pattern) return undefined;
  // Compound indexes lead with `college`; name the field that actually clashed.
  const keys = Object.keys(pattern);
  return keys.find((k) => FIELD_LABELS[k]) ?? keys[0];
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

type MongooseValidationError = {
  name: "ValidationError";
  errors: Record<string, { path?: string; kind?: string; name?: string }>;
};

const GENERIC_400 = "Some details are not in the right format. Please check and try again.";
const GENERIC_500 = "Something went wrong on our side. Please try again in a moment.";

/**
 * Status and plain-English message for any error. `expose` is false for 5xx,
 * where the real error is logged but never sent.
 */
export function describeError(err: unknown): {
  status: number;
  message: string;
  expose: boolean;
} {
  const e = err as {
    name?: string;
    type?: string;
    status?: number;
    message?: string;
  } | null;

  // body-parser
  if (e?.type === "entity.parse.failed") {
    return { status: 400, message: "The request could not be read. Please try again.", expose: true };
  }
  if (e?.type === "entity.too.large") {
    return {
      status: 413,
      message: "This upload is too large. Please choose a smaller file.",
      expose: true,
    };
  }

  if (isDuplicateKeyError(err)) {
    return { status: 409, message: duplicateMessage(duplicateField(err)), expose: true };
  }

  if (e?.name === "ValidationError") {
    const first = Object.values((err as MongooseValidationError).errors ?? {})[0];
    const label = first?.path ? FIELD_LABELS[first.path] : undefined;
    if (label) {
      const message =
        first?.kind === "required"
          ? `Please enter the ${label}.`
          : `Please enter a valid ${label}.`;
      return { status: 400, message, expose: true };
    }
    return { status: 400, message: GENERIC_400, expose: true };
  }

  // A query value of the wrong shape, e.g. an object where a string belongs.
  if (e?.name === "CastError" || e?.name === "StrictModeError") {
    return { status: 400, message: GENERIC_400, expose: true };
  }

  const status = typeof e?.status === "number" ? e.status : 500;
  if (status >= 500) {
    return { status, message: GENERIC_500, expose: false };
  }
  return {
    status,
    message: typeof e?.message === "string" && e.message ? e.message : GENERIC_400,
    expose: true,
  };
}

/** For bulk imports: one row failed, say why without failing the batch. */
export function rowErrorMessage(err: unknown): string {
  const { message, expose } = describeError(err);
  if (!expose) console.error(err);
  return expose ? message : "This row could not be saved. Please try again.";
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found. Please check the address and try again." });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const { status, message, expose } = describeError(err);
  if (!expose) console.error(err);
  // A handler that already started replying cannot be given a second body.
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(status).json({ error: message });
};

/**
 * A 10-digit Indian mobile number from what was typed or imported:
 * "+91 98765 43210", "098765-43210" and "9876543210" all become "9876543210".
 * Null when it is not text or has fewer than 10 digits.
 */
export function normaliseMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12 ? digits.slice(-10) : null;
}

export const MOBILE_MESSAGE = "Enter a valid 10-digit mobile number.";

/** True for a value that is a string with something in it. */
export function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** A Date from a date-of-birth field, or null when it is not a real date. */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isLatitude(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isLongitude(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
}
