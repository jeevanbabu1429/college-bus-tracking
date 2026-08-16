import type { Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { CollegeModel } from "../models/College.js";
import { RoleModel } from "../models/Role.js";
import { StaffModel } from "../models/Staff.js";
import { checkAdminSuspension, sendSuspended } from "./suspension.js";
import { checkAdminApproval, sendPendingApproval } from "./approval.js";
import { allPermissions } from "./permissions.js";

/**
 * Who is driving the admin console.
 *
 * Two kinds of caller reach the same routes. The owning admin holds every
 * permission on every college they own and needs no role. A staff member holds
 * exactly what their role grants, on exactly one college.
 */
export type Caller =
  | { kind: "admin"; adminId: string }
  | {
      kind: "staff";
      staffId: string;
      collegeId: string;
      roleId: string;
      roleName: string;
      /** module -> granted actions */
      permissions: Record<string, string[]>;
    };

type WithCaller = { caller?: Caller; adminSubId?: string };

export function getCaller(req: Request): Caller {
  const caller = (req as unknown as WithCaller).caller;
  if (!caller) throw new Error("getCaller called before requireConsoleUser");
  return caller;
}

/** True when this caller may perform `action` on `module`. */
export function callerCan(
  caller: Caller,
  module: string,
  action: string
): boolean {
  // The admin owns the college outright. Enumerating their permissions would
  // mean remembering to widen them every time a module is added.
  if (caller.kind === "admin") return true;
  return (caller.permissions[module] ?? []).includes(action);
}

/** The caller's effective permissions, for the client to shape its own UI. */
export function callerPermissions(
  caller: Caller
): { module: string; actions: string[] }[] {
  if (caller.kind === "admin") return allPermissions();
  return Object.entries(caller.permissions).map(([module, actions]) => ({
    module,
    actions,
  }));
}

export function sendForbidden(res: Response, message: string): void {
  res.status(403).json({ error: message, forbidden: true });
}

/**
 * Accepts an admin token or a staff token and resolves it to a Caller.
 *
 * Replaces the old requireAdmin. Admin callers still get `req.adminSubId` set,
 * so every handler written before roles existed keeps working untouched.
 */
export const requireConsoleUser: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  let payload: { sub?: string; adminId?: string; role?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(header.slice("Bearer ".length), secret) as typeof payload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Invalid token subject" });
    return;
  }

  if (payload.role === "staff") {
    await resolveStaff(req, res, next, payload.sub);
    return;
  }

  if (!payload.adminId) {
    res.status(401).json({ error: "Not an admin token" });
    return;
  }

  const suspensionMsg = await checkAdminSuspension(payload.sub, "admin");
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  const pendingMsg = await checkAdminApproval(payload.sub);
  if (pendingMsg) {
    sendPendingApproval(res, pendingMsg);
    return;
  }

  const target = req as unknown as WithCaller;
  target.adminSubId = payload.sub;
  target.caller = { kind: "admin", adminId: payload.sub };
  next();
};

async function resolveStaff(
  req: Request,
  res: Response,
  next: () => void,
  staffId: string
): Promise<void> {
  const staff = await StaffModel.findById(staffId)
    .select("college role active")
    .lean();
  if (!staff) {
    res.status(401).json({ error: "Account no longer exists" });
    return;
  }
  // Read as `=== false` so a row written before the flag existed stays usable.
  if (staff.active === false) {
    sendForbidden(res, "Your access has been switched off by your college.");
    return;
  }

  // Staff inherit the fate of the admin who owns their college: a suspended
  // customer must not keep operating through the people they invited.
  const college = await CollegeModel.findById(staff.college)
    .select("admin")
    .lean();
  if (!college) {
    res.status(401).json({ error: "College no longer exists" });
    return;
  }
  const suspensionMsg = await checkAdminSuspension(String(college.admin), "admin");
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  const pendingMsg = await checkAdminApproval(String(college.admin));
  if (pendingMsg) {
    sendPendingApproval(res, pendingMsg);
    return;
  }

  const role = await RoleModel.findById(staff.role).select("name permissions").lean();
  if (!role) {
    sendForbidden(res, "Your role has been removed. Ask your admin to set it again.");
    return;
  }

  // Read fresh on every request rather than baked into the token: an admin who
  // narrows a role expects it to take effect now, not whenever that person
  // next signs in.
  const permissions: Record<string, string[]> = {};
  for (const entry of role.permissions ?? []) {
    permissions[entry.module] = [...(entry.actions ?? [])];
  }

  (req as unknown as WithCaller).caller = {
    kind: "staff",
    staffId: String(staff._id),
    collegeId: String(staff.college),
    roleId: String(staff.role),
    roleName: role.name,
    permissions,
  };
  next();
}

/** Routes only the owning admin may use — creating colleges, for instance. */
export const adminOnly: RequestHandler = (req, res, next) => {
  if (getCaller(req).kind !== "admin") {
    sendForbidden(res, "Only the college owner can do this.");
    return;
  }
  next();
};
