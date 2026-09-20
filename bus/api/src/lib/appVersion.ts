// Deciding whether the app on someone's phone is too old.

/** A version people would type: "1", "1.0", "1.0.16". Up to four parts. */
export const VERSION_PATTERN = /^\d{1,5}(\.\d{1,5}){0,3}$/;

export function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value.trim());
}

/**
 * Compare two versions part by part: -1 when a is older, 0 when they are the
 * same, 1 when a is newer. Missing parts count as zero, so "1.2" === "1.2.0".
 */
export function compareVersions(a: string, b: string): number {
  const left = a.trim().split(".").map(Number);
  const right = b.trim().split(".").map(Number);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * What the app should do when it opens:
 *
 *   "required"  older than the minimum — the update popup has no way past it
 *   "optional"  older than the latest  — the popup can be put off
 *   "none"      up to date, ahead of the store, or nothing configured
 */
export type UpdateAction = "none" | "optional" | "required";

export function updateAction(
  installed: string,
  latest: string,
  minimum: string
): UpdateAction {
  // An unreadable version from the phone is never a reason to lock someone
  // out of the app.
  if (!isVersion(installed)) return "none";
  if (isVersion(minimum) && compareVersions(installed, minimum) < 0) {
    return "required";
  }
  if (isVersion(latest) && compareVersions(installed, latest) < 0) {
    return "optional";
  }
  return "none";
}
