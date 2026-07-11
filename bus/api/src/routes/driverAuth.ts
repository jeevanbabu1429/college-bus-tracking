import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { DriverModel } from "../models/Driver.js";
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

export default router;
