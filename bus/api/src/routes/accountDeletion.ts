import { Router } from "express";
import { AdminModel } from "../models/Admin.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { CollegeModel } from "../models/College.js";
import { AccountDeletionModel } from "../models/AccountDeletion.js";
import { requireAppUser } from "../lib/appUser.js";
import type { AppUser } from "../lib/appUser.js";
import { generateOtp } from "../lib/otp.js";
import {
  deleteAdminCascade,
  deleteDriverAccount,
  deleteStudentAccount,
} from "../lib/cascades.js";
import { sendPushSafe } from "../services/notifications.js";
import { isText } from "../lib/httpErrors.js";
import { readAppSettings } from "../models/AppSettings.js";

// Deleting your own account, from inside the app.
//
// Two steps on purpose. Saying why comes first, then a code sent to the
// account's own mobile number — the same proof of ownership as signing in, so
// a borrowed, unlocked phone cannot wipe someone's account and, for an admin,
// their whole college with it.
//
// Required by App Store guideline 5.1.1(v): an app that lets people create an
// account must let them delete it, in the app, without emailing anyone.
const router = Router();

const OTP_TTL_MS = 10 * 60 * 1000;
const MIN_REASON = 3;
const MAX_REASON = 500;

type DeletableRole = "admin" | "driver" | "student";

type DeleteCode = { otp: string | null; expiresAt: Date | null };

// Each model is its own type, so the three are kept apart here rather than
// held in one lookup table that no longer type-checks.
async function setDeleteCode(
  role: DeletableRole,
  id: string,
  code: DeleteCode
): Promise<void> {
  const update = {
    $set: { deleteOtp: code.otp, deleteOtpExpiresAt: code.expiresAt },
  };
  if (role === "admin") await AdminModel.updateOne({ _id: id }, update);
  else if (role === "driver") await DriverModel.updateOne({ _id: id }, update);
  else await StudentModel.updateOne({ _id: id }, update);
}

async function readDeleteCode(
  role: DeletableRole,
  id: string
): Promise<DeleteCode | null> {
  const select = "+deleteOtp +deleteOtpExpiresAt";
  const doc =
    role === "admin"
      ? await AdminModel.findById(id).select(select).lean()
      : role === "driver"
        ? await DriverModel.findById(id).select(select).lean()
        : await StudentModel.findById(id).select(select).lean();
  if (!doc) return null;
  return {
    otp: doc.deleteOtp ?? null,
    expiresAt: doc.deleteOtpExpiresAt ?? null,
  };
}

function deletableRole(user: AppUser): DeletableRole | null {
  return user.role === "admin" || user.role === "driver" || user.role === "student"
    ? user.role
    : null;
}

router.use(requireAppUser);

// The super admin can close this off — an emergency switch rather than a
// normal setting, since the App Store requires the option to exist.
router.use(async (_req, res, next) => {
  const { accountDeletionEnabled } = await readAppSettings();
  if (!accountDeletionEnabled) {
    res.status(403).json({
      error:
        "Deleting your account from the app is switched off at the moment. Please contact support.",
    });
    return;
  }
  next();
});

/** Step 1 — send a code to the account's own mobile number. */
router.post("/request-otp", async (req, res) => {
  const user = req.appUser as AppUser;
  const role = deletableRole(user);
  if (!role) {
    // Staff accounts belong to the college that created them; the college
    // removes them from the console.
    res.status(403).json({
      error:
        "This account is managed by your college. Ask them to remove it for you.",
    });
    return;
  }

  const otp = generateOtp();
  await setDeleteCode(role, user.id, {
    otp,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  console.log(`[DELETE OTP] ${role} ${user.name} ${user.mobile} -> ${otp}`);

  res.json({ ok: true, mobile: user.mobile });
});

/** Step 2 — check the code, then delete. */
router.post("/", async (req, res) => {
  const user = req.appUser as AppUser;
  const role = deletableRole(user);
  if (!role) {
    res.status(403).json({
      error:
        "This account is managed by your college. Ask them to remove it for you.",
    });
    return;
  }

  const body = req.body ?? {};
  const reason = isText(body.reason) ? body.reason.trim() : "";
  if (reason.length < MIN_REASON) {
    res.status(400).json({ error: "Please tell us why you are leaving." });
    return;
  }
  if (reason.length > MAX_REASON) {
    res.status(400).json({ error: `Please keep the reason under ${MAX_REASON} characters.` });
    return;
  }
  if (!isText(body.otp)) {
    res.status(400).json({ error: "Enter the code we sent you." });
    return;
  }

  const code = await readDeleteCode(role, user.id);
  if (!code) {
    res.status(404).json({ error: "This account no longer exists." });
    return;
  }
  const { otp: stored, expiresAt } = code;
  if (!stored || !expiresAt) {
    res.status(400).json({ error: "Tap Send code first." });
    return;
  }
  if (expiresAt.getTime() < Date.now()) {
    await setDeleteCode(role, user.id, { otp: null, expiresAt: null });
    res.status(400).json({ error: "That code has expired. Please send a new one." });
    return;
  }
  if (stored !== body.otp.trim()) {
    res.status(400).json({ error: "That code is not right. Please check and try again." });
    return;
  }

  // Everything worth keeping is read before the account goes.
  const college = user.college
    ? await CollegeModel.findById(user.college).select("name admin").lean()
    : null;

  let removed = { colleges: 0, buses: 0, drivers: 0, students: 0 };
  if (role === "admin") {
    const totals = await deleteAdminCascade(user.id);
    removed = {
      colleges: totals.colleges,
      buses: totals.buses,
      drivers: totals.drivers,
      students: totals.students,
    };
  } else if (role === "driver") {
    await deleteDriverAccount(user.id);
  } else {
    await deleteStudentAccount(user.id);
  }

  await AccountDeletionModel.create({
    role,
    name: user.name,
    mobile: user.mobile,
    college: user.college ?? null,
    collegeName: college?.name ?? "",
    reason,
    removed,
  });

  // The college loses a driver or a student without anyone in the office
  // touching anything, so tell them rather than let it be noticed later.
  if (college?.admin && role !== "admin") {
    sendPushSafe(
      { role: "admin", id: String(college.admin) },
      {
        title: "Account deleted",
        body: `${user.name} (${role}) deleted their Busszo account.`,
        data: { type: "account_deleted", role },
      }
    );
  }

  res.json({ ok: true, role, removed });
});

export default router;
