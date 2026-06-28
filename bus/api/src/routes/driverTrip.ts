import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { BusModel } from "../models/Bus.js";

const router = Router();

const requireDriver: RequestHandler = (req, res, next) => {
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
  });
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
  res.json({ ok: true });
});

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
