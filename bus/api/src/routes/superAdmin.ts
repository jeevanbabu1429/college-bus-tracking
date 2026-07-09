import { Router, type RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { SuperAdminModel } from "../models/SuperAdmin.js";
import { AdminModel } from "../models/Admin.js";
import { CollegeModel } from "../models/College.js";
import { BusModel } from "../models/Bus.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { requireSuperAdmin } from "../middleware/superAuth.js";
import {
  deleteAdminCascade,
  deleteCollegeCascade,
} from "../lib/cascades.js";

const router = Router();

const TOKEN_TTL = "7d";
const BCRYPT_ROUNDS = 10;

function signToken(payload: { role: "super"; sub: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL } as SignOptions);
}

function publicSuperAdmin(s: InstanceType<typeof SuperAdminModel>) {
  return {
    _id: s.id,
    email: s.email,
    createdAt: s.get("createdAt"),
    updatedAt: s.get("updatedAt"),
  };
}

// ─── login rate limit ──────────────────────────────────────────────────────
// Small in-memory sliding window: 5 attempts / 15 min per IP. No new deps.
// Cleared on process restart — fine for a single-instance dev/staging setup.
type Attempt = { at: number };
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, Attempt[]>();

const rateLimitLogin: RequestHandler = (req, res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const prior = (loginAttempts.get(key) ?? []).filter((a) => a.at > cutoff);
  if (prior.length >= RATE_LIMIT_MAX) {
    res.status(429).json({
      error: `Too many login attempts. Try again in ${Math.ceil(
        (prior[0].at + RATE_LIMIT_WINDOW_MS - now) / 60000
      )} minute(s).`,
    });
    return;
  }
  prior.push({ at: now });
  loginAttempts.set(key, prior);
  next();
};

// ─── auth ──────────────────────────────────────────────────────────────────

router.post("/login", rateLimitLogin, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const superAdmin = await SuperAdminModel.findOne({
    email: email.toLowerCase().trim(),
  });
  // Timing-equivalent branch on failed lookup and wrong password so we don't
  // leak "does this email exist?" via response time.
  if (!superAdmin) {
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvi");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, superAdmin.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ role: "super", sub: superAdmin.id });
  res.json({ token, superAdmin: publicSuperAdmin(superAdmin) });
});

router.get("/me", requireSuperAdmin, async (req, res) => {
  const superAdmin = await SuperAdminModel.findById(req.superAdminId);
  if (!superAdmin) {
    res.status(404).json({ error: "Super admin not found" });
    return;
  }
  res.json(publicSuperAdmin(superAdmin));
});

router.post("/change-password", requireSuperAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const superAdmin = await SuperAdminModel.findById(req.superAdminId);
  if (!superAdmin) {
    res.status(404).json({ error: "Super admin not found" });
    return;
  }
  const ok = await bcrypt.compare(currentPassword, superAdmin.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  superAdmin.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await superAdmin.save();
  res.json({ ok: true });
});

// ─── admins ────────────────────────────────────────────────────────────────

router.get("/admins", requireSuperAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filter = q
    ? {
        $or: [
          { name: new RegExp(escapeRegex(q), "i") },
          { email: new RegExp(escapeRegex(q), "i") },
          { mobile: new RegExp(escapeRegex(q), "i") },
          { adminId: new RegExp(escapeRegex(q), "i") },
        ],
      }
    : {};
  const admins = await AdminModel.find(filter)
    .sort({ createdAt: -1 })
    .select("-otp -otpExpiresAt")
    .lean();

  if (admins.length === 0) {
    res.json([]);
    return;
  }

  const adminIds = admins.map((a) => a._id);
  const colleges = await CollegeModel.find({ admin: { $in: adminIds } })
    .select("_id admin")
    .lean();
  const collegeIdsByAdmin = new Map<string, string[]>();
  for (const c of colleges) {
    const key = String(c.admin);
    const arr = collegeIdsByAdmin.get(key) ?? [];
    arr.push(String(c._id));
    collegeIdsByAdmin.set(key, arr);
  }
  const allCollegeIds = colleges.map((c) => c._id);

  const [busCounts, driverCounts, studentCounts] = await Promise.all([
    countBy(BusModel, allCollegeIds),
    countBy(DriverModel, allCollegeIds),
    countBy(StudentModel, allCollegeIds),
  ]);

  const enriched = admins.map((a) => {
    const cIds = collegeIdsByAdmin.get(String(a._id)) ?? [];
    let buses = 0;
    let drivers = 0;
    let students = 0;
    for (const cid of cIds) {
      buses += busCounts.get(cid) ?? 0;
      drivers += driverCounts.get(cid) ?? 0;
      students += studentCounts.get(cid) ?? 0;
    }
    return {
      ...a,
      counts: { colleges: cIds.length, buses, drivers, students },
    };
  });
  res.json(enriched);
});

router.get("/admins/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const admin = await AdminModel.findById(id).select("-otp -otpExpiresAt").lean();
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  const colleges = await CollegeModel.find({ admin: id }).lean();
  const collegeIds = colleges.map((c) => c._id);
  const [busCounts, driverCounts, studentCounts] = await Promise.all([
    countBy(BusModel, collegeIds),
    countBy(DriverModel, collegeIds),
    countBy(StudentModel, collegeIds),
  ]);
  const collegesEnriched = colleges.map((c) => ({
    ...c,
    counts: {
      buses: busCounts.get(String(c._id)) ?? 0,
      drivers: driverCounts.get(String(c._id)) ?? 0,
      students: studentCounts.get(String(c._id)) ?? 0,
    },
  }));
  const totals = collegesEnriched.reduce(
    (acc, c) => ({
      buses: acc.buses + c.counts.buses,
      drivers: acc.drivers + c.counts.drivers,
      students: acc.students + c.counts.students,
    }),
    { buses: 0, drivers: 0, students: 0 }
  );
  res.json({
    admin,
    colleges: collegesEnriched,
    counts: { colleges: colleges.length, ...totals },
  });
});

router.patch("/admins/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { name, gender, dob, mobile, email } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (typeof name === "string") updates.name = name.trim();
  if (
    typeof gender === "string" &&
    ["male", "female", "other"].includes(gender)
  ) {
    updates.gender = gender;
  }
  if (typeof dob === "string" && dob) {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ error: "dob is not a valid date" });
      return;
    }
    updates.dob = d;
  }
  if (typeof mobile === "string" && mobile.trim()) updates.mobile = mobile.trim();
  if (typeof email === "string" && email.trim())
    updates.email = email.trim().toLowerCase();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No editable fields provided" });
    return;
  }

  try {
    const admin = await AdminModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select("-otp -otpExpiresAt");
    if (!admin) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }
    res.json(admin);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
      const field = dup ? Object.keys(dup)[0] : "field";
      res.status(409).json({ error: `${field} already exists` });
      return;
    }
    throw err;
  }
});

router.patch("/admins/:id/suspended", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { suspended } = req.body ?? {};
  if (typeof suspended !== "boolean") {
    res.status(400).json({ error: "suspended (boolean) is required" });
    return;
  }
  const admin = await AdminModel.findByIdAndUpdate(
    id,
    { suspended },
    { new: true }
  ).select("-otp -otpExpiresAt");
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  res.json(admin);
});

router.delete("/admins/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const admin = await AdminModel.findById(id);
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  const confirm = typeof req.query.confirm === "string" ? req.query.confirm : "";
  if (confirm.toLowerCase().trim() !== admin.email.toLowerCase().trim()) {
    res.status(400).json({
      error: "Confirm the admin's email in the ?confirm= query to delete",
    });
    return;
  }
  const result = await deleteAdminCascade(admin._id);
  res.json({ ok: true, deleted: result });
});

// ─── colleges ──────────────────────────────────────────────────────────────

router.get("/colleges", requireSuperAdmin, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const filter = q
    ? {
        $or: [
          { name: new RegExp(escapeRegex(q), "i") },
          { code: new RegExp(escapeRegex(q), "i") },
          { address: new RegExp(escapeRegex(q), "i") },
        ],
      }
    : {};
  const colleges = await CollegeModel.find(filter)
    .sort({ createdAt: -1 })
    .populate("admin", "-otp -otpExpiresAt")
    .lean();

  if (colleges.length === 0) {
    res.json([]);
    return;
  }

  const collegeIds = colleges.map((c) => c._id);
  const [busCounts, driverCounts, studentCounts] = await Promise.all([
    countBy(BusModel, collegeIds),
    countBy(DriverModel, collegeIds),
    countBy(StudentModel, collegeIds),
  ]);
  const enriched = colleges.map((c) => ({
    ...c,
    counts: {
      buses: busCounts.get(String(c._id)) ?? 0,
      drivers: driverCounts.get(String(c._id)) ?? 0,
      students: studentCounts.get(String(c._id)) ?? 0,
    },
  }));
  res.json(enriched);
});

router.patch("/colleges/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { name, address, code, busCount, driverCount } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof address === "string" && address.trim())
    updates.address = address.trim();
  if (typeof code === "string" && code.trim())
    updates.code = code.trim().toUpperCase();
  if (typeof busCount === "number" && busCount >= 0) updates.busCount = busCount;
  if (typeof driverCount === "number" && driverCount >= 0)
    updates.driverCount = driverCount;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No editable fields provided" });
    return;
  }

  try {
    const college = await CollegeModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }
    res.json(college);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
      const field = dup ? Object.keys(dup).join("+") : "field";
      res.status(409).json({ error: `${field} already exists` });
      return;
    }
    throw err;
  }
});

router.delete("/colleges/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const college = await CollegeModel.findById(id);
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  const confirm = typeof req.query.confirm === "string" ? req.query.confirm : "";
  if (confirm.toUpperCase().trim() !== college.code.toUpperCase().trim()) {
    res.status(400).json({
      error: "Confirm the college's code in the ?confirm= query to delete",
    });
    return;
  }
  const result = await deleteCollegeCascade(college._id);
  res.json({ ok: true, deleted: result });
});

// ─── helpers ───────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Count docs per college id. Returns Map<collegeId as string, count>.
async function countBy(
  Model: typeof BusModel | typeof DriverModel | typeof StudentModel,
  collegeIds: unknown[]
): Promise<Map<string, number>> {
  if (collegeIds.length === 0) return new Map();
  const rows = await Model.aggregate([
    { $match: { college: { $in: collegeIds } } },
    { $group: { _id: "$college", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count as number]));
}

export default router;
