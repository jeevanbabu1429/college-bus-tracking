import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { AdminModel } from "../models/Admin.js";
import { StaffModel } from "../models/Staff.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";

export type AppUserRole = "admin" | "staff" | "driver" | "student";

export type AppUser = {
  role: AppUserRole;
  id: string;
  name: string;
  mobile: string;
  /** Null for admins, who can own several colleges. */
  college: string | null;
};

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

/**
 * Accepts a token from any signed-in app account and resolves it to a person.
 *
 * Four token shapes already exist, all signed with the same secret:
 *
 *   { role: "student", sub }   { role: "driver", sub }   { role: "staff", sub }
 *   { adminId, sub }           — the admin's, which carries no `role` at all
 *
 * requireConsoleUser (lib/consoleAuth.ts) covers the console pair, and each
 * auth route has its own single-role guard. Nothing until now accepted all
 * four, which is what a support channel open to every login needs.
 *
 * Deliberately does NOT apply the suspension gate (lib/suspension.ts) or the
 * pending-approval gate (lib/approval.ts) that the console guards use. Someone
 * locked out is precisely the person with something to report, and refusing
 * their complaint would leave them with no way to reach anyone at all.
 */
export const requireAppUser: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  let payload: { role?: string; adminId?: string; sub?: string };
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

  // The super admin console is a different product surface with its own
  // inbox — a super admin has no complaint to file with themselves.
  if (payload.role === "super") {
    res.status(403).json({ error: "Not an app account" });
    return;
  }

  const appUser = await resolve(payload);
  if (!appUser) {
    res.status(401).json({ error: "Account no longer exists" });
    return;
  }

  req.appUser = appUser;
  next();
};

async function resolve(payload: {
  role?: string;
  adminId?: string;
  sub?: string;
}): Promise<AppUser | null> {
  const id = payload.sub as string;

  if (payload.role === "student") {
    const doc = await StudentModel.findById(id).select("name mobile college").lean();
    return doc
      ? {
          role: "student",
          id,
          name: doc.name,
          mobile: doc.mobile,
          college: doc.college ? String(doc.college) : null,
        }
      : null;
  }

  if (payload.role === "driver") {
    const doc = await DriverModel.findById(id).select("name mobile college").lean();
    return doc
      ? {
          role: "driver",
          id,
          name: doc.name,
          mobile: doc.mobile,
          college: doc.college ? String(doc.college) : null,
        }
      : null;
  }

  if (payload.role === "staff") {
    const doc = await StaffModel.findById(id).select("name mobile college").lean();
    return doc
      ? {
          role: "staff",
          id,
          name: doc.name,
          mobile: doc.mobile,
          college: doc.college ? String(doc.college) : null,
        }
      : null;
  }

  // No `role` on the payload and an adminId present is what an admin token
  // looks like — same test requireConsoleUser makes.
  if (payload.adminId) {
    const doc = await AdminModel.findById(id).select("name mobile").lean();
    return doc
      ? { role: "admin", id, name: doc.name, mobile: doc.mobile, college: null }
      : null;
  }

  return null;
}
