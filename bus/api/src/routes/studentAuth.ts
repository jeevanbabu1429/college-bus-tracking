import { Router, type RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { StudentModel } from "../models/Student.js";
import { BusModel } from "../models/Bus.js";
import { DriverModel } from "../models/Driver.js";
import {
  checkCollegeAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";
import { generateOtp } from "../lib/otp.js";

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL = "7d";

function signToken(payload: { role: "student"; sub: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL } as SignOptions);
}

router.post("/request-otp", async (req, res) => {
  const { mobile } = req.body ?? {};
  if (!mobile) {
    res.status(400).json({ error: "mobile is required" });
    return;
  }

  const student = await StudentModel.findOne({ mobile });
  if (!student) {
    res.status(404).json({ error: "No student registered with this mobile" });
    return;
  }

  const otp = generateOtp();
  student.otp = otp;
  student.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await student.save();

  console.log(`[STUDENT OTP] ${student.name} ${mobile} -> ${otp}`);

  res.json({ ok: true });
});

router.post("/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body ?? {};
  if (!mobile || !otp) {
    res.status(400).json({ error: "mobile and otp are required" });
    return;
  }

  const student = await StudentModel.findOne({ mobile });
  if (!student || !student.otp || !student.otpExpiresAt) {
    res.status(400).json({ error: "Request an OTP first" });
    return;
  }

  if (student.otpExpiresAt.getTime() < Date.now()) {
    student.otp = null;
    student.otpExpiresAt = null;
    await student.save();
    res.status(400).json({ error: "OTP expired" });
    return;
  }

  if (student.otp !== String(otp)) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  student.otp = null;
  student.otpExpiresAt = null;
  await student.save();

  const suspensionMsg = await checkCollegeAdminSuspension(
    student.college,
    "student"
  );
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }

  await student.populate("bus");

  const token = signToken({ role: "student", sub: student.id });

  res.json({ token, student });
});

const requireStudent: RequestHandler = async (req, res, next) => {
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
  if (payload.role !== "student" || !payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not a student token" });
    return;
  }
  const student = await StudentModel.findById(payload.sub).select("college").lean();
  const suspensionMsg = await checkCollegeAdminSuspension(
    student?.college,
    "student"
  );
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  (req as unknown as { studentId?: string }).studentId = payload.sub;
  next();
};

router.get("/me", requireStudent, async (req, res) => {
  const studentId = (req as unknown as { studentId: string }).studentId;
  const student = await StudentModel.findById(studentId).populate("bus");
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(student);
});

// Same data the admin's /buses/live returns, but scoped to the calling
// student's own college so they can see fleet activity without needing a
// collegeId. Mobile field of view, hence we strip licence and mobile.
router.get("/live-buses", requireStudent, async (req, res) => {
  const studentId = (req as unknown as { studentId: string }).studentId;
  const student = await StudentModel.findById(studentId).select("college");
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const activeDrivers = await DriverModel.find({
    college: student.college,
    tripActive: true,
  })
    .select("name mobile currentLocation tripActive")
    .lean();
  if (activeDrivers.length === 0) {
    res.json([]);
    return;
  }

  const activeIds = activeDrivers.map((d) => d._id);
  const buses = await BusModel.find({
    college: student.college,
    driver: { $in: activeIds },
  })
    .select("busNumber plateNumber route stops notice driver")
    .lean();

  const driverById = new Map(activeDrivers.map((d) => [String(d._id), d]));
  const items = buses
    .map((bus) => {
      const driver = bus.driver ? driverById.get(String(bus.driver)) : null;
      if (!driver) return null;
      return {
        bus: {
          _id: bus._id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          route: bus.route,
          stops: bus.stops,
          notice: bus.notice,
        },
        driver: {
          name: driver.name,
          mobile: driver.mobile,
          tripActive: driver.tripActive,
          currentLocation: driver.currentLocation ?? null,
        },
      };
    })
    .filter((x) => x !== null);

  res.json(items);
});

router.get("/bus-location", requireStudent, async (req, res) => {
  const studentId = (req as unknown as { studentId: string }).studentId;
  const student = await StudentModel.findById(studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  if (!student.bus) {
    res.json({
      bus: null,
      driver: null,
      tripActive: false,
      currentLocation: null,
      currentIssue: null,
    });
    return;
  }
  const bus = await BusModel.findById(student.bus);
  if (!bus) {
    res.json({
      bus: null,
      driver: null,
      tripActive: false,
      currentLocation: null,
      currentIssue: null,
    });
    return;
  }
  const driver = bus.driver ? await DriverModel.findById(bus.driver) : null;
  res.json({
    bus: {
      _id: bus._id,
      busNumber: bus.busNumber,
      plateNumber: bus.plateNumber,
      route: bus.route,
      stops: bus.stops,
      notice: bus.notice,
    },
    // Public-facing driver info (no otp, no licence/aadhar). Mobile is
    // included so the student can dial from the app.
    driver: driver
      ? { name: driver.name, mobile: driver.mobile }
      : null,
    tripActive: driver?.tripActive ?? false,
    currentLocation: driver?.currentLocation ?? null,
    currentIssue: driver?.currentIssue ?? null,
  });
});

export default router;
