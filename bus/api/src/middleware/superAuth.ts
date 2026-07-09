import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      superAdminId?: string;
    }
  }
}

// Same shape as the driver/student middlewares — checks the Bearer token,
// verifies the JWT, and rejects unless the payload's role is "super".
export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: { role?: string; sub?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(token, secret) as { role?: string; sub?: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (payload.role !== "super" || !payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not a super admin token" });
    return;
  }
  req.superAdminId = payload.sub;
  next();
};
