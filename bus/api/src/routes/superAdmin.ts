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
import { BannerModel } from "../models/Banner.js";
import {
  COMPLAINT_STATUSES,
  ComplaintModel,
  MAX_COMPLAINT_REPLY,
  type ComplaintStatus,
} from "../models/Complaint.js";
import {
  LoginRolesModel,
  readLoginRoles,
} from "../models/LoginRoles.js";
import { requireSuperAdmin } from "../middleware/superAuth.js";
import {
  deleteAdminCascade,
  deleteCollegeCascade,
} from "../lib/cascades.js";
import { sendPushSafe } from "../services/notifications.js";
import {
  deleteImage,
  imageUrlFor,
  isImageDataUrl,
  storeImage,
} from "../lib/images.js";
import {
  consoleComplaint,
  consoleComplaintDetail,
} from "../lib/complaints.js";
import {
  duplicateField,
  duplicateMessage,
  isDuplicateKeyError,
} from "../lib/httpErrors.js";

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
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: duplicateMessage(duplicateField(err)) });
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

// Verification toggle for a new signup. Until this flips true the admin can
// sign in and see their dashboard but cannot act — see lib/approval.ts.
router.patch("/admins/:id/approved", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { approved } = req.body ?? {};
  if (typeof approved !== "boolean") {
    res.status(400).json({ error: "approved (boolean) is required" });
    return;
  }
  const before = await AdminModel.findById(id).select("approved").lean();
  if (!before) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  const admin = await AdminModel.findByIdAndUpdate(
    id,
    { approved, approvedAt: approved ? new Date() : null },
    { new: true }
  ).select("-otp -otpExpiresAt");
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }
  // Only announce a real transition into approved — re-saving an already
  // approved admin should not re-notify them.
  if (approved && before.approved === false) {
    sendPushSafe(
      { role: "admin", id: admin._id },
      {
        title: "Account verified",
        body: "Your account has been verified. You can start setting up your colleges and buses.",
        data: { kind: "admin-approved", url: "/dashboard" },
      }
    );
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
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: duplicateMessage(duplicateField(err)) });
      return;
    }
    throw err;
  }
});

router.patch("/colleges/:id/approved", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { approved } = req.body ?? {};
  if (typeof approved !== "boolean") {
    res.status(400).json({ error: "approved (boolean) is required" });
    return;
  }
  const before = await CollegeModel.findById(id).select("approved admin").lean();
  if (!before) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  const college = await CollegeModel.findByIdAndUpdate(
    id,
    { approved, approvedAt: approved ? new Date() : null },
    { new: true }
  ).populate("admin", "-otp -otpExpiresAt");
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  // Only announce a real transition into approved — re-saving an already
  // verified college should not re-notify its admin.
  if (approved && before.approved === false && before.admin) {
    sendPushSafe(
      { role: "admin", id: before.admin },
      {
        title: "College verified",
        body: `${college.name} has been verified. You can now set up its buses and drivers.`,
        data: { kind: "college-approved", url: "/dashboard" },
      }
    );
  }
  res.json(college);
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

// ─── banner ────────────────────────────────────────────────────────────────
// Singleton — always upserts / reads a single row. No id needed.

// `imageDataUrl` in the database is a legacy data URL or a storage path; the field
// name stays the same in responses so shipped apps keep reading it.
async function bannerResponse(banner: InstanceType<typeof BannerModel>) {
  return { ...banner.toJSON(), imageDataUrl: await imageUrlFor(banner.imageDataUrl) };
}

// The banner is a full-screen poster, so it gets far more room than a driver
// photo or screenshot — but no longer an unlimited amount. ~7.5 MB of base64
// is ~5.6 MB of image, matching the 5 MB file the console already allows.
const MAX_BANNER_CHARS = 7_500_000;

router.get("/banner", requireSuperAdmin, async (_req, res) => {
  const banner = await BannerModel.findOne();
  if (!banner) {
    res.json(null);
    return;
  }
  res.json(await bannerResponse(banner));
});

// Full replace / create. Body: { imageDataUrl: string, active?: boolean }
router.put("/banner", requireSuperAdmin, async (req, res) => {
  const { imageDataUrl, active } = req.body ?? {};
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:")) {
    res
      .status(400)
      .json({ error: "imageDataUrl (data: URL string) is required" });
    return;
  }
  if (imageDataUrl.length > MAX_BANNER_CHARS) {
    res.status(400).json({ error: "Banner image is too large — please use one under 5 MB" });
    return;
  }
  if (!isImageDataUrl(imageDataUrl)) {
    res.status(400).json({
      error: "imageDataUrl must be a base64 data URL (png, jpeg, webp or gif)",
    });
    return;
  }

  const previous = await BannerModel.findOne().select("imageDataUrl").lean();
  const stored = await storeImage(imageDataUrl, "banner");
  const nextActive = typeof active === "boolean" ? active : true;
  const banner = await BannerModel.findOneAndUpdate(
    {},
    { imageDataUrl: stored, active: nextActive },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (previous?.imageDataUrl && previous.imageDataUrl !== stored) {
    await deleteImage(previous.imageDataUrl);
  }
  res.json(await bannerResponse(banner));
});

// Toggle only. Body: { active: boolean }
router.patch("/banner/active", requireSuperAdmin, async (req, res) => {
  const { active } = req.body ?? {};
  if (typeof active !== "boolean") {
    res.status(400).json({ error: "active (boolean) is required" });
    return;
  }
  const banner = await BannerModel.findOneAndUpdate(
    {},
    { active },
    { new: true }
  );
  if (!banner) {
    res.status(404).json({ error: "No banner uploaded yet" });
    return;
  }
  res.json(await bannerResponse(banner));
});

router.delete("/banner", requireSuperAdmin, async (_req, res) => {
  const existing = await BannerModel.find().select("imageDataUrl").lean();
  await BannerModel.deleteMany({});
  await Promise.all(existing.map((b) => deleteImage(b.imageDataUrl)));
  res.json({ ok: true });
});

// ─── app sign-in roles ─────────────────────────────────────────────────────
// Singleton, like the banner. Controls which role cards the mobile app shows
// on its sign-in screen.
//
// Presentation only, and deliberately so: /api/auth/request-otp is shared by
// the mobile app AND the website console, so refusing a disabled role at the
// endpoint would lock admins out of the web console too. Turning "admin" off
// hides the card in the app; it does not disable the account.

router.get("/login-roles", requireSuperAdmin, async (_req, res) => {
  res.json(await readLoginRoles());
});

// Body: { student?: boolean, driver?: boolean, admin?: boolean }
router.put("/login-roles", requireSuperAdmin, async (req, res) => {
  const body = req.body ?? {};
  const next: Record<string, boolean> = {};
  for (const key of ["student", "driver", "admin"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") {
      res.status(400).json({ error: `${key} must be a boolean` });
      return;
    }
    next[key] = body[key];
  }
  if (Object.keys(next).length === 0) {
    res
      .status(400)
      .json({ error: "at least one of student, driver or admin is required" });
    return;
  }

  // Refuse to switch the last one off. An empty sign-in screen is a locked
  // door for every user of the app, including the admin who would have to
  // undo it — and the only way back would be a database edit.
  const merged = { ...(await readLoginRoles()), ...next };
  if (!merged.student && !merged.driver && !merged.admin) {
    res.status(400).json({
      error:
        "At least one sign-in role must stay enabled — turning all three off would leave the app with no way in.",
    });
    return;
  }

  await LoginRolesModel.findOneAndUpdate({}, next, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  res.json(merged);
});

// ─── app complaints ────────────────────────────────────────────────────────
// The other end of /api/complaints: support tickets raised from inside the
// mobile app by any signed-in role. Unlike the bus issues in driverTrip.ts,
// these are about the app itself and only the super admin ever sees them.
//
// Screenshots are stored inline on the document but never returned in a JSON
// body — see lib/complaints.ts for why, and the /screenshot route below for
// how they are served instead.

const PAGE_SIZE = 25;

function parseStatus(value: unknown): ComplaintStatus | null {
  if (typeof value !== "string") return null;
  return (COMPLAINT_STATUSES as readonly string[]).includes(value)
    ? (value as ComplaintStatus)
    : null;
}

router.get("/complaints", requireSuperAdmin, async (req, res) => {
  const status = parseStatus(req.query.status);
  const page = Math.max(1, Number(req.query.page) || 1);

  // The tab counts come back with every page so the console never has to make
  // a second round trip just to label its own tabs.
  const [rows, total, counts] = await Promise.all([
    ComplaintModel.find(status ? { status } : {})
      .select("-screenshot")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ComplaintModel.countDocuments(status ? { status } : {}),
    ComplaintModel.aggregate<{ _id: ComplaintStatus; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 };
  for (const c of counts) byStatus[c._id] = c.n;

  res.json({
    complaints: rows.map(consoleComplaint),
    page,
    pageSize: PAGE_SIZE,
    total,
    counts: byStatus,
  });
});

router.get("/complaints/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid complaint id" });
    return;
  }
  // Unlike the list, this one carries the screenshot bytes: it is a single
  // record on a page that exists to show it.
  const complaint = await ComplaintModel.findById(id).lean();
  if (!complaint) {
    res.status(404).json({ error: "Complaint not found" });
    return;
  }
  const detail = consoleComplaintDetail(complaint);
  res.json({ ...detail, screenshot: await imageUrlFor(detail.screenshot) });
});

router.patch("/complaints/:id/status", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid complaint id" });
    return;
  }
  const status = parseStatus(req.body?.status);
  if (!status) {
    res.status(400).json({
      error: `status must be one of: ${COMPLAINT_STATUSES.join(", ")}`,
    });
    return;
  }

  const before = await ComplaintModel.findById(id).select("status reporter").lean();
  if (!before) {
    res.status(404).json({ error: "Complaint not found" });
    return;
  }

  const complaint = await ComplaintModel.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  )
    .select("-screenshot")
    .lean();

  // Only on the transition into resolved, so re-saving the same status does
  // not push the reporter a second time.
  if (status === "resolved" && before.status !== "resolved") {
    notifyReporter(before.reporter, {
      title: "Your report has been resolved",
      body: "Tap to see what support said about the problem you reported.",
      complaintId: id,
    });
  }

  res.json(consoleComplaint(complaint!));
});

router.post("/complaints/:id/replies", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid complaint id" });
    return;
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) {
    res.status(400).json({ error: "A reply cannot be empty." });
    return;
  }
  if (body.length > MAX_COMPLAINT_REPLY) {
    res
      .status(400)
      .json({ error: `Please keep the reply under ${MAX_COMPLAINT_REPLY} characters.` });
    return;
  }

  const complaint = await ComplaintModel.findByIdAndUpdate(
    id,
    { $push: { replies: { body, at: new Date() } } },
    { new: true }
  )
    .select("-screenshot")
    .lean();
  if (!complaint) {
    res.status(404).json({ error: "Complaint not found" });
    return;
  }

  notifyReporter(complaint.reporter, {
    title: "Support replied to your report",
    // The reply itself, trimmed to something a notification can hold. The
    // full text is in the app.
    body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
    complaintId: id,
  });

  res.json(consoleComplaint(complaint));
});

router.delete("/complaints/:id", requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid complaint id" });
    return;
  }
  const result = await ComplaintModel.findByIdAndDelete(id);
  if (!result) {
    res.status(404).json({ error: "Complaint not found" });
    return;
  }
  await deleteImage(result.screenshot);
  res.json({ ok: true });
});

// Fire-and-forget, like every other push in the app: a notification failure
// must never fail the super admin's write.
function notifyReporter(
  reporter: { role?: string; id?: unknown } | null | undefined,
  opts: { title: string; body: string; complaintId: string }
): void {
  if (!reporter?.id) return;
  const role = reporter.role;
  if (role !== "admin" && role !== "driver" && role !== "student" && role !== "staff") {
    return;
  }
  sendPushSafe(
    { role, id: String(reporter.id) },
    {
      title: opts.title,
      body: opts.body,
      data: { kind: "complaint-reply", complaintId: opts.complaintId, url: "/" },
    }
  );
}

export default router;
