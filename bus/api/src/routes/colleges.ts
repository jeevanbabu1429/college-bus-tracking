import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { CollegeModel } from "../models/College.js";
import { BusModel } from "../models/Bus.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import {
  checkAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";

const router = Router();

const requireAdmin: RequestHandler = async (req, res, next) => {
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
  const suspensionMsg = await checkAdminSuspension(payload.sub, "admin");
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  (req as unknown as { adminSubId: string }).adminSubId = payload.sub;
  next();
};

router.use(requireAdmin);

router.get("/", async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const colleges = await CollegeModel.find({ admin: adminSubId })
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

router.post("/claim-orphans", async (req, res) => {
  const adminSubId = (req as unknown as { adminSubId: string }).adminSubId;
  const result = await CollegeModel.updateMany(
    { $or: [{ admin: { $exists: false } }, { admin: null }] },
    { $set: { admin: adminSubId } }
  );
  res.json({ claimed: result.modifiedCount });
});

router.put("/:collegeId", async (req, res) => {
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

router.post("/", async (req, res) => {
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

  const college = await CollegeModel.create({
    admin: adminSubId,
    name,
    address,
    code: upperCode,
    busCount,
    driverCount,
  });
  res.status(201).json(college);
});

export default router;
