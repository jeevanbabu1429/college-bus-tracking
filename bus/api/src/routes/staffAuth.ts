import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { StaffModel } from "../models/Staff.js";
import { RoleModel } from "../models/Role.js";
import { CollegeModel } from "../models/College.js";
import { generateOtp } from "../lib/otp.js";

const router = Router();
const OTP_TTL_MS = 5 * 60 * 1000;

function sign(staffId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign({ role: "staff", sub: staffId }, secret, options);
}

function normalise(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

router.post("/request-otp", async (req, res) => {
  const mobile = normalise(req.body?.mobile);
  if (!mobile) {
    res.status(400).json({ error: "mobile is required" });
    return;
  }

  // The same person can be staff at two campuses, so every active row for this
  // number gets the code — which of them they are signing into is settled at
  // verify time.
  const accounts = await StaffModel.find({ mobile, active: { $ne: false } });
  if (accounts.length === 0) {
    res.status(404).json({ error: "No staff account for this mobile" });
    return;
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await Promise.all(
    accounts.map((a) => {
      a.otp = otp;
      a.otpExpiresAt = expiresAt;
      return a.save();
    })
  );

  console.log(`[STAFF OTP] ${accounts[0].name} ${mobile} -> ${otp}`);
  res.json({ ok: true });
});

router.post("/verify-otp", async (req, res) => {
  const mobile = normalise(req.body?.mobile);
  const { otp, staffId } = req.body ?? {};
  if (!mobile || typeof otp !== "string") {
    res.status(400).json({ error: "mobile and otp are required" });
    return;
  }

  const accounts = await StaffModel.find({ mobile, active: { $ne: false } });
  const valid = accounts.filter(
    (a) =>
      a.otp &&
      a.otp === otp &&
      a.otpExpiresAt &&
      a.otpExpiresAt.getTime() > Date.now()
  );
  if (valid.length === 0) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  // More than one campus and no choice made yet: hand back the options rather
  // than picking one, since landing in the wrong college would be silent.
  let chosen = valid[0];
  if (valid.length > 1) {
    if (!staffId || !isValidObjectId(staffId)) {
      const colleges = await CollegeModel.find({
        _id: { $in: valid.map((a) => a.college) },
      })
        .select("name code")
        .lean();
      const byId = new Map(colleges.map((c) => [String(c._id), c]));
      res.json({
        needsCollege: true,
        options: valid.map((a) => ({
          staffId: String(a._id),
          collegeId: String(a.college),
          collegeName: byId.get(String(a.college))?.name ?? "College",
          collegeCode: byId.get(String(a.college))?.code ?? "",
        })),
      });
      return;
    }
    const picked = valid.find((a) => String(a._id) === String(staffId));
    if (!picked) {
      res.status(400).json({ error: "That college is not one of yours" });
      return;
    }
    chosen = picked;
  }

  // Burn the code on every row it was written to, not just the one signed
  // into, so a second campus cannot be entered with the same code later.
  await Promise.all(
    accounts.map((a) => {
      a.otp = null;
      a.otpExpiresAt = null;
      return a.save();
    })
  );
  chosen.lastLoginAt = new Date();
  await chosen.save();

  res.json({ token: sign(String(chosen._id)), staff: await publicStaff(chosen._id) });
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  let payload: { sub?: string; role?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(header.slice("Bearer ".length), secret) as typeof payload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (payload.role !== "staff" || !payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not a staff token" });
    return;
  }
  const profile = await publicStaff(payload.sub);
  if (!profile) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(profile);
});

/**
 * What the console needs to draw itself: who this is, which college they are
 * in, and the permissions their role currently grants.
 *
 * Permissions are read live rather than carried in the token so an admin
 * narrowing a role takes effect on the next request, not the next sign-in.
 */
async function publicStaff(staffId: unknown) {
  const staff = await StaffModel.findById(staffId)
    .select("name mobile active college role lastLoginAt")
    .lean();
  if (!staff) return null;
  const [role, college] = await Promise.all([
    RoleModel.findById(staff.role).select("name description landingPage permissions").lean(),
    CollegeModel.findById(staff.college).select("name code address").lean(),
  ]);
  return {
    _id: String(staff._id),
    name: staff.name,
    mobile: staff.mobile,
    active: staff.active !== false,
    college: college
      ? {
          _id: String(college._id),
          name: college.name,
          code: college.code,
          address: college.address,
        }
      : null,
    role: role
      ? {
          _id: String(role._id),
          name: role.name,
          description: role.description,
          landingPage: role.landingPage,
          permissions: (role.permissions ?? []).map((p) => ({
            module: p.module,
            actions: [...(p.actions ?? [])],
          })),
        }
      : null,
  };
}

export default router;
