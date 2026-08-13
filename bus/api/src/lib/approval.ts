import type { Response } from "express";
import type { Types } from "mongoose";
import { AdminModel } from "../models/Admin.js";
import { CollegeModel } from "../models/College.js";

// A newly registered admin can sign in and reach their dashboard, but cannot
// do anything until the super admin verifies them. This is the server half of
// that gate — the clients also hide the controls, but hiding buttons is not a
// gate, so every admin-scoped route checks here too.
//
// Deliberately shaped like lib/suspension.ts: same "returns a message or null"
// contract, same 403-with-a-flag response, so the clients can pattern-match it
// the same way they already do for suspension.

export const PENDING_APPROVAL_MESSAGE =
  "Your account is being verified. This usually completes within 24 hours.";

// Returns null when the admin may act, or the user-facing message when they
// are still awaiting verification.
//
// `approved === false` rather than `!approved` is load-bearing: admins created
// before this field existed have no value stored, and those are legacy
// accounts that must keep working. Only an explicit false blocks.
export async function checkAdminApproval(
  adminId: string | Types.ObjectId | null | undefined
): Promise<string | null> {
  if (!adminId) return null;
  const admin = await AdminModel.findById(adminId).select("approved").lean();
  if (!admin) return null;
  return admin.approved === false ? PENDING_APPROVAL_MESSAGE : null;
}

// `pendingApproval: true` is the flag the web and mobile clients key off, the
// same way `suspended: true` works.
export function sendPendingApproval(res: Response, message: string): void {
  res.status(403).json({ error: message, pendingApproval: true });
}

// ── Per-college verification ────────────────────────────────────────────────
//
// An approved admin may run more than one college, and each college beyond
// their first is verified separately. That keeps a second campus from going
// live on the strength of a check that was only ever done on the first, while
// leaving the colleges already in service untouched.

export const PENDING_COLLEGE_MESSAGE =
  "This college is being verified. This usually completes within 24 hours.";

// Returns null when the college may be operated, or the user-facing message
// while it waits. Same `=== false` rule as above: colleges predating the field
// have no stored value and stay usable.
export async function checkCollegeApproval(
  collegeId: string | Types.ObjectId | null | undefined
): Promise<string | null> {
  if (!collegeId) return null;
  const college = await CollegeModel.findById(collegeId)
    .select("approved")
    .lean();
  if (!college) return null;
  return college.approved === false ? PENDING_COLLEGE_MESSAGE : null;
}

// Deliberately NOT `pendingApproval` — that flag means "the whole account is
// locked" and the clients react by replacing the entire console. A pending
// college must only lock that one college, so it gets its own flag.
export function sendPendingCollege(res: Response, message: string): void {
  res.status(403).json({ error: message, collegePending: true });
}
