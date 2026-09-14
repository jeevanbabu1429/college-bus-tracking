import { randomBytes } from "node:crypto";
import { chooseStorage } from "../fileStorage/store/storage.js";

// Images arrive as base64 data URLs (driver photos, complaint screenshots, the
// banner) and are validated here before anything is stored.
//
// Where they are stored has changed over time, and both kinds of record exist
// side by side in the database, in the same field:
//
//   "data:image/jpeg;base64,/9j/..."   legacy — stored inline in MongoDB
//   "drivers/<college>/<driver>/..."   a file path in storage — S3 or this
//                                      server's disk, per STORAGE_DRIVER
//
// There is deliberately no migration. The helpers at the bottom of this file
// tell the two apart by the "data:" prefix, so a record written years ago and
// one written today both render, and callers never need to know which is which.

// Roughly 300 KB of decoded image. Both clients downscale to a 256px square
// before sending, which lands well under this — the cap is a backstop against
// a client that doesn't.
export const MAX_IMAGE_CHARS = 400_000;

const IMAGE_DATA_URL_RE =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Format only, no size limit — for callers with their own cap (the banner). */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && IMAGE_DATA_URL_RE.test(value);
}

// Three-state on purpose. A profile photo has to distinguish "the caller said
// nothing about the photo" from "the caller explicitly cleared it":
//
//   undefined      -> "unchanged"  — leave whatever is already stored
//   null | ""      -> "set", null  — clear the photo
//   data URL       -> "set", value — replace the photo
//
// Collapsing the first two (the original behaviour) meant any client that
// didn't know about photos silently wiped them on every update — which is
// exactly what the mobile admin edit screen was doing to photos uploaded from
// the website.
export type ImageField =
  | { ok: true; kind: "unchanged" }
  | { ok: true; kind: "set"; value: string | null }
  | { ok: false; error: string };

export function parseImageField(value: unknown): ImageField {
  if (value === undefined) return { ok: true, kind: "unchanged" };
  // Reads now hand clients a URL rather than the data URL — a signed S3 link,
  // or this server's /images address — and a form that posts back the image
  // it was given (the website's DriverForm does) would otherwise be rejected
  // below. It can only be the value the client already received, so it means
  // "leave it alone". It is never stored.
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return { ok: true, kind: "unchanged" };
  }
  if (value === null || value === "") return { ok: true, kind: "set", value: null };
  if (typeof value !== "string") {
    return { ok: false, error: "image must be a data URL string" };
  }
  if (value.length > MAX_IMAGE_CHARS) {
    return { ok: false, error: "image is too large — please use a smaller photo" };
  }
  if (!isImageDataUrl(value)) {
    return {
      ok: false,
      error: "image must be a base64 data URL (png, jpeg, webp or gif)",
    };
  }
  return { ok: true, kind: "set", value };
}

// Split a stored data URL back into a content type + raw bytes so the photo
// can be served as a real cacheable image response instead of being inlined
// into a JSON payload. Returns null if the string isn't a data URL we wrote.
export function decodeDataUrl(
  dataUrl: string
): { contentType: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

// ─── storage ────────────────────────────────────────────────────────────────
// Thin adapter over src/fileStorage (the provider split lifted from kareez).
// The providers report failure in their response rather than throwing; these
// helpers turn that into the shape each caller needs.

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function isInline(value: string): boolean {
  return value.startsWith("data:");
}

/**
 * Store a validated data URL and return the path to keep in the database.
 *
 * `folderPath` groups files by owner, e.g. "drivers/<collegeId>/<driverId>".
 * The name is a timestamp as in kareez, plus a random suffix: a replaced image
 * always gets a new name, and — because local files are served without auth —
 * nobody can walk the folder by guessing timestamps.
 */
export async function storeImage(dataUrl: string, folderPath: string): Promise<string> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) throw new Error("storeImage called with an unparseable data URL");

  const ext = EXTENSIONS[decoded.contentType] ?? "bin";
  const res = await chooseStorage().upload({
    file: decoded.buffer,
    filename: `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`,
    folderPath,
    mimeType: decoded.contentType,
  });
  if (!res.success || !res.path) throw new Error(res.message);
  return res.path;
}

/**
 * The string a client should put in `<img src>` / `Image source={{ uri }}`:
 * legacy data URLs untouched, stored paths as a URL — a signed one on S3, the
 * public /images address on local disk.
 *
 * Deliberately resolved on every read, never saved. kareez persists the URL
 * its upload returns, and on S3 that is a signed URL that stops working five
 * minutes later.
 */
export async function imageUrlFor(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isInline(value)) return value;
  const res = await chooseStorage().get({ filePath: value });
  return res.success && res.url ? res.url : null;
}

/** Raw bytes, for the routes that serve an image themselves with an ETag. */
export async function readImage(
  value: string | null | undefined
): Promise<{ contentType: string; buffer: Buffer } | null> {
  if (!value) return null;
  if (isInline(value)) return decodeDataUrl(value);
  return chooseStorage().read(value);
}

/**
 * Remove a stored image. Best-effort by design: this runs after the database
 * write it belongs to has succeeded, and a stray file costs next to nothing,
 * whereas failing the request would leave the user unable to change or delete
 * the record at all.
 */
export async function deleteImage(value: string | null | undefined): Promise<void> {
  if (!value || isInline(value)) return;
  const res = await chooseStorage().delete(value);
  if (!res.success) console.error(`[storage] could not delete ${value}: ${res.message}`);
}
