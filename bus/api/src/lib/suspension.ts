import type { Response } from "express";
import type { Types } from "mongoose";
import { AdminModel } from "../models/Admin.js";
import { CollegeModel } from "../models/College.js";

// One central place for the suspension copy so tweaking it only touches this
// file. Admin sees the direct contact; driver/student sees a generic message
// so they don't need to know product-owner internals.
const ADMIN_MESSAGE =
  "Your account is suspended. Please contact Jeevan — 9360555572.";
const DOWNSTREAM_MESSAGE =
  "Your account is suspended. Please contact your admin.";

export type SuspendedRole = "admin" | "driver" | "student";

// Returns null if the admin isn't suspended; otherwise the role-appropriate
// user-facing message. Any missing/dangling ref is treated as "not suspended"
// so we never block on a data-integrity fluke.
export async function checkAdminSuspension(
  adminId: string | Types.ObjectId | null | undefined,
  role: SuspendedRole
): Promise<string | null> {
  if (!adminId) return null;
  const admin = await AdminModel.findById(adminId).select("suspended").lean();
  if (!admin || !admin.suspended) return null;
  return role === "admin" ? ADMIN_MESSAGE : DOWNSTREAM_MESSAGE;
}

// Same as above but the caller has a college id, not the admin id — we resolve
// the owning admin first. Used by driver/student flows.
export async function checkCollegeAdminSuspension(
  collegeId: string | Types.ObjectId | null | undefined,
  role: SuspendedRole
): Promise<string | null> {
  if (!collegeId) return null;
  const college = await CollegeModel.findById(collegeId).select("admin").lean();
  if (!college?.admin) return null;
  return checkAdminSuspension(college.admin, role);
}

// Helper to send the 403 in the shape the frontend can pattern-match on.
export function sendSuspended(res: Response, message: string): void {
  res.status(403).json({ error: message, suspended: true });
}
