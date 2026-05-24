import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = { adminId: string; sub: string };

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    req.auth = jwt.verify(token, secret) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
