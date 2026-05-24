import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { CollegeModel } from "../models/College.js";

const router = Router({ mergeParams: true });

const GENDERS = ["male", "female", "other"];

router.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }
  const drivers = await DriverModel.find({ college: collegeId }).sort({
    createdAt: -1,
  });
  res.json(drivers);
});

router.post("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const college = await CollegeModel.findById(collegeId);
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }

  const {
    name,
    dob,
    gender,
    licenceNumber,
    aadharNumber,
    mobile,
    address,
  } = req.body ?? {};

  if (
    !name ||
    !dob ||
    !gender ||
    !licenceNumber ||
    !aadharNumber ||
    !mobile ||
    !address
  ) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Invalid gender" });
    return;
  }
  if (!/^\d{12}$/.test(String(aadharNumber))) {
    res.status(400).json({ error: "Aadhar must be 12 digits" });
    return;
  }

  try {
    const driver = await DriverModel.create({
      college: college._id,
      name,
      dob,
      gender,
      licenceNumber,
      aadharNumber,
      mobile,
      address,
    });
    res.status(201).json(driver);
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

router.post("/bulk", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const college = await CollegeModel.findById(collegeId);
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }

  const drivers = (req.body ?? {}).drivers;
  if (!Array.isArray(drivers)) {
    res.status(400).json({ error: "drivers must be an array" });
    return;
  }
  if (drivers.length === 0) {
    res.status(400).json({ error: "drivers must contain at least one row" });
    return;
  }
  if (drivers.length > 500) {
    res.status(400).json({ error: "Cannot import more than 500 drivers at once" });
    return;
  }

  type FailedRow = {
    row: number;
    name?: string;
    mobile?: string;
    error: string;
  };
  const created: unknown[] = [];
  const failed: FailedRow[] = [];

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  for (let i = 0; i < drivers.length; i++) {
    const row = drivers[i] ?? {};
    const name = str(row.name);
    const dob = str(row.dob);
    const gender = str(row.gender).toLowerCase();
    const licenceNumber = str(row.licenceNumber).toUpperCase();
    const aadharNumber = str(row.aadharNumber);
    const mobile = str(row.mobile);
    const address = str(row.address);

    if (!name) {
      failed.push({ row: i + 1, error: "name is required" });
      continue;
    }
    if (!dob) {
      failed.push({ row: i + 1, name, error: "dob is required" });
      continue;
    }
    const dobDate = new Date(dob);
    if (Number.isNaN(dobDate.getTime())) {
      failed.push({ row: i + 1, name, error: "dob must be a valid date" });
      continue;
    }
    if (!GENDERS.includes(gender)) {
      failed.push({
        row: i + 1,
        name,
        mobile,
        error: "gender must be male, female or other",
      });
      continue;
    }
    if (!licenceNumber) {
      failed.push({ row: i + 1, name, mobile, error: "licenceNumber is required" });
      continue;
    }
    if (!/^\d{12}$/.test(aadharNumber)) {
      failed.push({
        row: i + 1,
        name,
        mobile,
        error: "aadharNumber must be 12 digits",
      });
      continue;
    }
    if (!mobile) {
      failed.push({ row: i + 1, name, error: "mobile is required" });
      continue;
    }
    if (!address) {
      failed.push({ row: i + 1, name, mobile, error: "address is required" });
      continue;
    }

    try {
      const driver = await DriverModel.create({
        college: college._id,
        name,
        dob: dobDate,
        gender,
        licenceNumber,
        aadharNumber,
        mobile,
        address,
      });
      created.push(driver);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
        const field = dup ? Object.keys(dup)[0] : "field";
        failed.push({
          row: i + 1,
          name,
          mobile,
          error: `${field} already exists`,
        });
      } else {
        failed.push({
          row: i + 1,
          name,
          mobile,
          error: (err as Error).message || "Failed to create",
        });
      }
    }
  }

  res.status(201).json({ created, failed });
});

router.put("/:driverId", async (req, res) => {
  const { collegeId, driverId } = req.params as {
    collegeId: string;
    driverId: string;
  };
  if (!isValidObjectId(collegeId) || !isValidObjectId(driverId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const driver = await DriverModel.findOne({
    _id: driverId,
    college: collegeId,
  });
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }

  const {
    name,
    dob,
    gender,
    licenceNumber,
    aadharNumber,
    mobile,
    address,
  } = req.body ?? {};

  if (
    !name ||
    !dob ||
    !gender ||
    !licenceNumber ||
    !aadharNumber ||
    !mobile ||
    !address
  ) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Invalid gender" });
    return;
  }
  if (!/^\d{12}$/.test(String(aadharNumber))) {
    res.status(400).json({ error: "Aadhar must be 12 digits" });
    return;
  }

  driver.set({ name, dob, gender, licenceNumber, aadharNumber, mobile, address });

  try {
    await driver.save();
    res.json(driver);
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

export default router;
