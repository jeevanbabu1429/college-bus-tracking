import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { BusModel } from "../models/Bus.js";
import { StudentModel } from "../models/Student.js";
import { sendPushSafe } from "../services/notifications.js";
import {
  checkCollegeAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";

const router = Router();

const requireDriver: RequestHandler = async (req, res, next) => {
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
  if (payload.role !== "driver" || !payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not a driver token" });
    return;
  }
  const driver = await DriverModel.findById(payload.sub).select("college").lean();
  const suspensionMsg = await checkCollegeAdminSuspension(
    driver?.college,
    "driver"
  );
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  (req as unknown as { driverId?: string }).driverId = payload.sub;
  next();
};

router.use(requireDriver);

router.get("/status", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  const bus = await BusModel.findOne({ driver: driver._id });
  res.json({
    bus: bus
      ? {
          _id: bus._id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          route: bus.route,
          stops: bus.stops,
          notice: bus.notice,
        }
      : null,
    tripActive: driver.tripActive ?? false,
    currentLocation: driver.currentLocation ?? null,
    currentIssue: driver.currentIssue ?? null,
  });
});

const ISSUE_TYPES = new Set([
  "breakdown",
  "flat_tyre",
  "refuelling",
  "traffic",
  "mechanical",
  "weather",
  "other",
]);

router.post("/issue", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { type, message } = req.body ?? {};
  if (typeof type !== "string" || !ISSUE_TYPES.has(type)) {
    res.status(400).json({
      error: "type must be one of breakdown, flat_tyre, refuelling, traffic, mechanical, weather, other",
    });
    return;
  }
  const trimmedMessage =
    typeof message === "string" ? message.trim().slice(0, 240) : "";
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    {
      $set: {
        currentIssue: {
          type,
          message: trimmedMessage,
          reportedAt: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ ok: true, currentIssue: driver.currentIssue ?? null });
});

router.delete("/issue", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    { $set: { currentIssue: null } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ ok: true });
});

router.post("/start", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    { $set: { tripActive: true } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  notifyTripChange(driver._id.toString(), "start");
  res.json({ ok: true });
});

router.post("/stop", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    { $set: { tripActive: false } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  notifyTripChange(driver._id.toString(), "stop");
  res.json({ ok: true });
});

function notifyTripChange(driverId: string, kind: "start" | "stop") {
  (async () => {
    const bus = await BusModel.findOne({ driver: driverId }).select("_id busNumber");
    if (!bus) return;
    const students = await StudentModel.find({ bus: bus._id }).select("_id").lean();
    const ids = students.map((s) => s._id);
    if (ids.length === 0) return;
    const title = kind === "start" ? "Bus has started" : "Bus has stopped";
    const body =
      kind === "start"
        ? `Bus ${bus.busNumber} is on the route. Track its live location.`
        : `Bus ${bus.busNumber} has finished its trip.`;
    sendPushSafe(
      { role: "students", ids },
      { title, body, data: { kind: `trip-${kind}`, busId: bus._id.toString(), url: "/" } }
    );
  })().catch((err) => console.error("[fcm] notifyTripChange failed:", err));
}

router.post("/location", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng (numbers) are required" });
    return;
  }
  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  if (!driver.tripActive) {
    res.status(400).json({ error: "Trip is not active" });
    return;
  }
  driver.currentLocation = { lat, lng, updatedAt: new Date() };
  await driver.save();
  res.json({ ok: true });
});

export default router;
