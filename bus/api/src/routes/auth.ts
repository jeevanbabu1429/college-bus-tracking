import { Router, type RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { AdminModel, formatAdminId } from "../models/Admin.js";
import { nextSequence } from "../models/Counter.js";

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL = "7d";

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function signToken(payload: { adminId: string; sub: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL } as SignOptions);
}

function publicAdmin(admin: InstanceType<typeof AdminModel>) {
  return {
    _id: admin.id,
    adminId: admin.adminId,
    name: admin.name,
    gender: admin.gender,
    dob: admin.dob,
    mobile: admin.mobile,
    email: admin.email,
    createdAt: admin.get("createdAt"),
    updatedAt: admin.get("updatedAt"),
  };
}

router.post("/register", async (req, res) => {
  const { name, gender, dob, mobile, email } = req.body ?? {};
  if (!name || !gender || !dob || !mobile || !email) {
    res
      .status(400)
      .json({ error: "name, gender, dob, mobile, email are required" });
    return;
  }

  const existing = await AdminModel.findOne({
    $or: [{ mobile }, { email: String(email).toLowerCase() }],
  });
  if (existing) {
    const field = existing.mobile === mobile ? "mobile" : "email";
    res.status(409).json({ error: `${field} already registered` });
    return;
  }

  const seq = await nextSequence("adminId");
  const adminId = formatAdminId(seq);

  const admin = await AdminModel.create({
    adminId,
    name,
    gender,
    dob,
    mobile,
    email,
  });

  res.status(201).json({ admin: publicAdmin(admin) });
});

router.post("/request-otp", async (req, res) => {
  const { mobile } = req.body ?? {};
  if (!mobile) {
    res.status(400).json({ error: "mobile is required" });
    return;
  }

  const admin = await AdminModel.findOne({ mobile });
  if (!admin) {
    res.status(404).json({ error: "No admin registered with this mobile" });
    return;
  }

  const otp = generateOtp();
  admin.otp = otp;
  admin.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await admin.save();

  console.log(`[OTP] ${admin.adminId} ${mobile} -> ${otp}`);

  res.json({ ok: true });
});

router.post("/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body ?? {};
  if (!mobile || !otp) {
    res.status(400).json({ error: "mobile and otp are required" });
    return;
  }

  const admin = await AdminModel.findOne({ mobile });
  if (!admin || !admin.otp || !admin.otpExpiresAt) {
    res.status(400).json({ error: "Request an OTP first" });
    return;
  }

  if (admin.otpExpiresAt.getTime() < Date.now()) {
    admin.otp = null;
    admin.otpExpiresAt = null;
    await admin.save();
    res.status(400).json({ error: "OTP expired" });
    return;
  }

  if (admin.otp !== String(otp)) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  admin.otp = null;
  admin.otpExpiresAt = null;
  await admin.save();

  const token = signToken({ adminId: admin.adminId, sub: admin.id });

  res.json({ token, admin: publicAdmin(admin) });
});

const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: { sub?: string; adminId?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(token, secret) as { sub?: string; adminId?: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!payload.sub || !payload.adminId || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not an admin token" });
    return;
  }
  (req as unknown as { adminSubId: string }).adminSubId = payload.sub;
  next();
};

router.put("/me", requireAdmin, async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const { name, gender, dob, mobile, email } = req.body ?? {};
  if (!name || !gender || !dob || !mobile || !email) {
    res
      .status(400)
      .json({ error: "name, gender, dob, mobile, email are required" });
    return;
  }
  if (!["male", "female", "other"].includes(gender)) {
    res.status(400).json({ error: "gender must be male, female or other" });
    return;
  }
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) {
    res.status(400).json({ error: "dob is invalid" });
    return;
  }

  const admin = await AdminModel.findById(adminSubId);
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const newEmail = String(email).toLowerCase();

  if (mobile !== admin.mobile) {
    const dup = await AdminModel.findOne({
      mobile,
      _id: { $ne: admin._id },
    });
    if (dup) {
      res.status(409).json({ error: "mobile already registered" });
      return;
    }
  }
  if (newEmail !== admin.email) {
    const dup = await AdminModel.findOne({
      email: newEmail,
      _id: { $ne: admin._id },
    });
    if (dup) {
      res.status(409).json({ error: "email already registered" });
      return;
    }
  }

  admin.name = name;
  admin.gender = gender;
  admin.dob = dobDate;
  admin.mobile = mobile;
  admin.email = newEmail;
  await admin.save();

  res.json({ admin: publicAdmin(admin) });
});

export default router;
