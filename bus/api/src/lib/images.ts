// Shared validation for the base64 profile photos stored directly on driver
// documents (same approach as the banner — no blob storage, no static file
// server). Used by the admin CRUD routes and by the driver's own
// self-service photo endpoint so both enforce identical limits.

// Roughly 300 KB of decoded image. Both clients downscale to a 256px square
// before sending, which lands well under this — the cap is a backstop against
// a client that doesn't.
export const MAX_IMAGE_CHARS = 400_000;

const IMAGE_DATA_URL_RE =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

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
  if (value === null || value === "") return { ok: true, kind: "set", value: null };
  if (typeof value !== "string") {
    return { ok: false, error: "image must be a data URL string" };
  }
  if (value.length > MAX_IMAGE_CHARS) {
    return { ok: false, error: "image is too large — please use a smaller photo" };
  }
  if (!IMAGE_DATA_URL_RE.test(value)) {
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
