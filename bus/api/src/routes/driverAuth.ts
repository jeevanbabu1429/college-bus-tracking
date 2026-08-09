import { Router, type RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { parseImageField } from "../lib/images.js";
import {
  checkCollegeAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";
import { generateOtp } from "../lib/otp.js";

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL = "7d";

function signToken(payload: { role: "driver"; sub: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL } as SignOptions);
}

// Note: `image` is deliberately absent. The login response is persisted to
// expo-secure-store on the device, and SecureStore's Android backend is
// documented as unreliable above ~2 KB per value — a 15 KB base64 photo in
// the session blob would risk failing the whole write. The driver's own photo
// is fetched at runtime from GET /me instead, and never persisted.
function publicDriver(driver: InstanceType<typeof DriverModel>) {
  return {
    _id: driver.id,
    college: driver.college,
    name: driver.name,
    dob: driver.dob,
    gender: driver.gender,
    licenceNumber: driver.licenceNumber,
    aadharNumber: driver.aadharNumber,
    mobile: driver.mobile,
    address: driver.address,
    createdAt: driver.get("createdAt"),
    updatedAt: driver.get("updatedAt"),
  };
}

router.post("/request-otp", async (req, res) => {
  const { mobile } = req.body ?? {};
  if (!mobile) {
    res.status(400).json({ error: "mobile is required" });
    return;
  }

  const driver = await DriverModel.findOne({ mobile });
  if (!driver) {
    res.status(404).json({ error: "No driver registered with this mobile" });
    return;
  }

  const otp = generateOtp();
  driver.otp = otp;
  driver.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await driver.save();

  console.log(`[DRIVER OTP] ${driver.name} ${mobile} -> ${otp}`);

  res.json({ ok: true });
});

router.post("/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body ?? {};
  if (!mobile || !otp) {
    res.status(400).json({ error: "mobile and otp are required" });
    return;
  }

  const driver = await DriverModel.findOne({ mobile });
  if (!driver || !driver.otp || !driver.otpExpiresAt) {
    res.status(400).json({ error: "Request an OTP first" });
    return;
  }

  if (driver.otpExpiresAt.getTime() < Date.now()) {
    driver.otp = null;
    driver.otpExpiresAt = null;
    await driver.save();
    res.status(400).json({ error: "OTP expired" });
    return;
  }

  if (driver.otp !== String(otp)) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  driver.otp = null;
  driver.otpExpiresAt = null;
  await driver.save();

  const suspensionMsg = await checkCollegeAdminSuspension(
    driver.college,
    "driver"
  );
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }

  const token = signToken({ role: "driver", sub: driver.id });

  res.json({ token, driver: publicDriver(driver) });
});

// Same shape as the middleware in driverTrip.ts — verifies the driver token
// and refuses if the owning admin has been suspended.
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

// The driver's own profile. Unlike the login payload this DOES include the
// photo, because the caller holds it in memory rather than persisting it.
router.get("/me", requireDriver, async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ ...publicDriver(driver), image: driver.image ?? null });
});

// Driver-managed profile photo — the self-service equivalent of what the
// admin can already do from the website's driver form. Body: { image } where
// a data URL sets the photo and null clears it. Same validation and size cap
// as the admin path, since both write the same field.
router.put("/me/photo", requireDriver, async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { image } = (req.body ?? {}) as { image?: unknown };

  const photo = parseImageField(image);
  if (!photo.ok) {
    res.status(400).json({ error: photo.error });
    return;
  }
  // "Unchanged" is meaningless on an endpoint whose only job is the photo —
  // treat a missing field as a client bug rather than a silent no-op.
  if (photo.kind !== "set") {
    res.status(400).json({
      error: "image is required — send a data URL to set one, or null to remove it",
    });
    return;
  }

  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    { $set: { image: photo.value } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  res.json({ ok: true, image: driver.image ?? null });
});

export default router;
