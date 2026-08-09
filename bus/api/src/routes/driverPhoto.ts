import { Router, type RequestHandler } from "express";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { decodeDataUrl } from "../lib/images.js";

// Driver photos are served as real image responses rather than inlined into
// JSON. The student dashboard polls /api/student-auth/bus-location every 5
// seconds; a ~15 KB base64 string riding along on every poll would be pure
// waste. Here the bytes are fetched once and then revalidated cheaply via
// ETag, so repeat views cost a 304 with an empty body.
const router = Router();

// Any signed-in role may view a driver's photo: the driver themselves, the
// students on their bus, and the admin console. The photo is not sensitive in
// the way the licence/Aadhar numbers are — but it still isn't public, so an
// anonymous caller gets nothing.
const requireAnyAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    jwt.verify(header.slice("Bearer ".length), secret);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  next();
};

router.get("/:driverId/photo", requireAnyAuth, async (req, res) => {
  const { driverId } = req.params;
  if (!isValidObjectId(driverId)) {
    res.status(400).json({ error: "Invalid driver id" });
    return;
  }

  const driver = await DriverModel.findById(driverId).select("image").lean();
  if (!driver?.image) {
    // Clients render initials on a failed load, so a plain 404 is the signal
    // for "this driver has no photo" — no placeholder image needed.
    res.status(404).json({ error: "No photo for this driver" });
    return;
  }

  const decoded = decodeDataUrl(driver.image);
  if (!decoded) {
    res.status(404).json({ error: "No photo for this driver" });
    return;
  }

  // Content-addressed ETag: it changes exactly when the photo changes, and
  // never when unrelated driver fields do. That matters here because
  // `updatedAt` is bumped every few seconds by live location writes and would
  // be useless as a cache key.
  const etag = `"${createHash("sha1").update(decoded.buffer).digest("hex")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
  res.setHeader("Content-Type", decoded.contentType);

  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.send(decoded.buffer);
});

export default router;
