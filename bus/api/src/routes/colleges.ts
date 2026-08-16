import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { CollegeModel } from "../models/College.js";
import {
  adminOnly,
  callerCan,
  getCaller,
  requireConsoleUser,
  sendForbidden,
} from "../lib/consoleAuth.js";
import { permissionFor } from "../lib/permissions.js";
import { BusModel } from "../models/Bus.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import {
  checkAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";
import {
  checkAdminApproval,
  checkCollegeApproval,
  sendPendingApproval,
  sendPendingCollege,
} from "../lib/approval.js";

const router = Router();

router.use(requireConsoleUser);

router.get("/", async (req, res) => {
  const caller = getCaller(req);
  // An admin sees the colleges they own; a staff member sees the single
  // college they were added to, and never learns the others exist.
  const filter =
    caller.kind === "admin"
      ? { admin: caller.adminId }
      : { _id: caller.collegeId };
  const colleges = await CollegeModel.find(filter)
    .sort({ createdAt: -1 })
    .lean();
  const enriched = await Promise.all(
    colleges.map(async (c) => {
      const [actualBusCount, actualDriverCount, actualStudentCount] =
        await Promise.all([
          BusModel.countDocuments({ college: c._id }),
          DriverModel.countDocuments({ college: c._id }),
          StudentModel.countDocuments({ college: c._id }),
        ]);
      return { ...c, actualBusCount, actualDriverCount, actualStudentCount };
    })
  );
  res.json(enriched);
});

router.post("/claim-orphans", adminOnly, async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const result = await CollegeModel.updateMany(
    { $or: [{ admin: { $exists: false } }, { admin: null }] },
    { $set: { admin: adminSubId } }
  );
  res.json({ claimed: result.modifiedCount });
});

router.put("/:collegeId", adminOnly, async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const { collegeId } = req.params;
  const { name, address, code, busCount, driverCount } = req.body ?? {};

  if (!name || !address || !code) {
    res.status(400).json({ error: "name, address, code are required" });
    return;
  }
  if (typeof busCount !== "number" || busCount < 0) {
    res.status(400).json({ error: "busCount must be a non-negative number" });
    return;
  }
  if (typeof driverCount !== "number" || driverCount < 0) {
    res
      .status(400)
      .json({ error: "driverCount must be a non-negative number" });
    return;
  }

  const college = await CollegeModel.findById(collegeId);
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  if (String(college.admin) !== adminSubId) {
    res.status(403).json({ error: "You do not own this college" });
    return;
  }

  const upperCode = String(code).toUpperCase();
  if (upperCode !== college.code) {
    const existing = await CollegeModel.findOne({
      admin: adminSubId,
      code: upperCode,
      _id: { $ne: college._id },
    });
    if (existing) {
      res.status(409).json({ error: "code already exists" });
      return;
    }
  }

  college.name = name;
  college.address = address;
  college.code = upperCode;
  college.busCount = busCount;
  college.driverCount = driverCount;
  await college.save();

  res.json(college);
});

router.post("/", adminOnly, async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const { name, address, code, busCount, driverCount } = req.body ?? {};

  if (!name || !address || !code) {
    res.status(400).json({ error: "name, address, code are required" });
    return;
  }
  if (typeof busCount !== "number" || busCount < 0) {
    res.status(400).json({ error: "busCount must be a non-negative number" });
    return;
  }
  if (typeof driverCount !== "number" || driverCount < 0) {
    res
      .status(400)
      .json({ error: "driverCount must be a non-negative number" });
    return;
  }

  const upperCode = String(code).toUpperCase();
  const existing = await CollegeModel.findOne({
    admin: adminSubId,
    code: upperCode,
  });
  if (existing) {
    res.status(409).json({ error: "code already exists" });
    return;
  }

  // The admin's first college rides on the account verification that let them
  // in — they have already been checked. Every college after that is a new
  // claim about a new campus, so it waits for the super admin.
  const isFirst = (await CollegeModel.countDocuments({ admin: adminSubId })) === 0;

  const college = await CollegeModel.create({
    admin: adminSubId,
    name,
    address,
    code: upperCode,
    busCount,
    driverCount,
    approved: isFirst,
    approvedAt: isFirst ? new Date() : null,
  });
  res.status(201).json(college);
});

// Registered last on purpose. Express matches the routes above first, so
// /claim-orphans and PUT /:collegeId are handled before this ever runs — an
// admin can still see and correct a college that is awaiting verification.
// What this does catch is everything deeper: /:collegeId/buses, /drivers and
// /students are separate routers mounted on the same prefix, and this router
// falls through to them, so one middleware here gates the whole operational
// surface of a pending college.
const requireApprovedCollege: RequestHandler = async (req, res, next) => {
  const { collegeId } = req.params as { collegeId?: string };
  if (!collegeId || !isValidObjectId(collegeId)) {
    next();
    return;
  }
  const pendingMsg = await checkCollegeApproval(collegeId);
  if (pendingMsg) {
    sendPendingCollege(res, pendingMsg);
    return;
  }
  next();
};

/**
 * Two checks the sub-routers never had: is this college yours, and does your
 * role allow what you are about to do.
 *
 * Runs in the same fall-through position as requireApprovedCollege, so it
 * covers /buses, /drivers, /students and /notifications from one place. Before
 * this, requireAdmin proved you were *an* admin and nothing proved the
 * :collegeId in the URL was yours — any admin's token reached any college's
 * data by id.
 */
const requireCollegeAccess: RequestHandler = async (req, res, next) => {
  const { collegeId } = req.params as { collegeId?: string };
  if (!collegeId || !isValidObjectId(collegeId)) {
    next();
    return;
  }
  const caller = getCaller(req);

  if (caller.kind === "staff") {
    if (caller.collegeId !== collegeId) {
      // "Not found" rather than "forbidden": a staff member has no business
      // learning which other college ids exist.
      res.status(404).json({ error: "College not found" });
      return;
    }
  } else {
    const college = await CollegeModel.findById(collegeId).select("admin").lean();
    if (!college) {
      res.status(404).json({ error: "College not found" });
      return;
    }
    if (String(college.admin) !== caller.adminId) {
      res.status(404).json({ error: "College not found" });
      return;
    }
  }

  // `req.url` inside a router mounted on "/:collegeId" is the remainder of the
  // path, which is exactly what the permission map expects.
  const needed = permissionFor(req.url.split("?")[0], req.method);
  if (!needed) {
    // An unmapped path is refused rather than waved through, so a new
    // sub-router cannot quietly bypass every role.
    sendForbidden(res, "This action is not available.");
    return;
  }
  if (!callerCan(caller, needed.module, needed.action)) {
    sendForbidden(
      res,
      `Your role does not allow you to ${needed.action} ${needed.module}.`
    );
    return;
  }

  next();
};

router.use("/:collegeId", requireApprovedCollege);
router.use("/:collegeId", requireCollegeAccess);

export default router;
