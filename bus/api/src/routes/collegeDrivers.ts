import { Router } from "express";
import {
  duplicateField,
  duplicateMessage,
  isDuplicateKeyError,
  isText,
  MOBILE_MESSAGE,
  normaliseMobile,
  parseDate,
  rowErrorMessage,
} from "../lib/httpErrors.js";
import { isValidObjectId, Types } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { CollegeModel } from "../models/College.js";
import {
  deleteImage,
  imageUrlFor,
  parseImageField,
  storeImage,
} from "../lib/images.js";

const router = Router({ mergeParams: true });

const GENDERS = ["male", "female", "other"];

type DriverDoc = InstanceType<typeof DriverModel>;

// `image` in the database is either a legacy data URL or a storage path;
// clients get something they can put straight into <img src> either way.
async function withImageUrl(driver: DriverDoc) {
  return { ...driver.toJSON(), image: await imageUrlFor(driver.image) };
}

function photoPrefix(collegeId: unknown, driverId: unknown): string {
  return `drivers/${String(collegeId)}/${String(driverId)}`;
}

router.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }
  const drivers = await DriverModel.find({ college: collegeId }).sort({
    createdAt: -1,
  });
  res.json(await Promise.all(drivers.map(withImageUrl)));
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
    image,
  } = req.body ?? {};

  if (
    ![name, gender, licenceNumber, address].every(isText) ||
    !dob ||
    !aadharNumber ||
    !mobile
  ) {
    res.status(400).json({ error: "Please fill in every field." });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Please choose a gender." });
    return;
  }
  if (!/^\d{12}$/.test(String(aadharNumber))) {
    res.status(400).json({ error: "Aadhaar number must be 12 digits." });
    return;
  }
  const dobDate = parseDate(dob);
  if (!dobDate) {
    res.status(400).json({ error: "Please enter a valid date of birth." });
    return;
  }
  const mobileNumber = normaliseMobile(mobile);
  if (!mobileNumber) {
    res.status(400).json({ error: MOBILE_MESSAGE });
    return;
  }
  const photo = parseImageField(image);
  if (!photo.ok) {
    res.status(400).json({ error: photo.error });
    return;
  }

  // The id is minted up front so the photo can be filed under it before the
  // document exists.
  const driverId = new Types.ObjectId();
  // On create there is nothing to preserve, so "unchanged" is just "none".
  const storedImage =
    photo.kind === "set" && photo.value
      ? await storeImage(photo.value, photoPrefix(college._id, driverId))
      : null;

  try {
    const driver = await DriverModel.create({
      _id: driverId,
      college: college._id,
      name,
      dob: dobDate,
      gender,
      licenceNumber,
      aadharNumber: String(aadharNumber),
      mobile: mobileNumber,
      address,
      image: storedImage,
    });
    res.status(201).json(await withImageUrl(driver));
  } catch (err) {
    // The upload already happened; don't leave it behind for a driver that
    // was never created.
    await deleteImage(storedImage);
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: duplicateMessage(duplicateField(err)) });
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
    const mobile = normaliseMobile(row.mobile) ?? "";
    const typedMobile = str(row.mobile);
    const address = str(row.address);

    if (!name) {
      failed.push({ row: i + 1, error: "Name is missing" });
      continue;
    }
    if (!dob) {
      failed.push({ row: i + 1, name, error: "Date of birth is missing" });
      continue;
    }
    const dobDate = new Date(dob);
    if (Number.isNaN(dobDate.getTime())) {
      failed.push({ row: i + 1, name, error: "Date of birth is not a valid date" });
      continue;
    }
    if (!GENDERS.includes(gender)) {
      failed.push({
        row: i + 1,
        name,
        mobile: typedMobile,
        error: "Gender must be male, female or other",
      });
      continue;
    }
    if (!licenceNumber) {
      failed.push({ row: i + 1, name, mobile: typedMobile, error: "Licence number is missing" });
      continue;
    }
    if (!/^\d{12}$/.test(aadharNumber)) {
      failed.push({
        row: i + 1,
        name,
        mobile: typedMobile,
        error: "Aadhaar number must be 12 digits",
      });
      continue;
    }
    if (!mobile) {
      failed.push({
        row: i + 1,
        name,
        mobile: typedMobile,
        error: typedMobile ? "Mobile number must be 10 digits" : "Mobile number is missing",
      });
      continue;
    }
    if (!address) {
      failed.push({ row: i + 1, name, mobile, error: "Address is missing" });
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
      failed.push({ row: i + 1, name, mobile, error: rowErrorMessage(err) });
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
    image,
  } = req.body ?? {};

  if (
    ![name, gender, licenceNumber, address].every(isText) ||
    !dob ||
    !aadharNumber ||
    !mobile
  ) {
    res.status(400).json({ error: "Please fill in every field." });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Please choose a gender." });
    return;
  }
  if (!/^\d{12}$/.test(String(aadharNumber))) {
    res.status(400).json({ error: "Aadhaar number must be 12 digits." });
    return;
  }
  const dobDate = parseDate(dob);
  if (!dobDate) {
    res.status(400).json({ error: "Please enter a valid date of birth." });
    return;
  }
  const mobileNumber = normaliseMobile(mobile);
  if (!mobileNumber) {
    res.status(400).json({ error: MOBILE_MESSAGE });
    return;
  }
  const photo = parseImageField(image);
  if (!photo.ok) {
    res.status(400).json({ error: photo.error });
    return;
  }

  const previousImage = driver.image;
  const nextImage =
    photo.kind !== "set"
      ? undefined
      : photo.value
        ? await storeImage(photo.value, photoPrefix(collegeId, driverId))
        : null;

  driver.set({
    name,
    dob: dobDate,
    gender,
    licenceNumber,
    aadharNumber: String(aadharNumber),
    mobile: mobileNumber,
    address,
    // Only touch the photo when the caller actually sent the field. Clients
    // that don't know about photos (the mobile admin edit screen) must not
    // wipe one uploaded from the website.
    ...(nextImage !== undefined ? { image: nextImage } : {}),
  });

  try {
    await driver.save();
    // Only now that the new value is saved is the old file safe to remove.
    if (nextImage !== undefined && previousImage !== nextImage) {
      await deleteImage(previousImage);
    }
    res.json(await withImageUrl(driver));
  } catch (err) {
    if (nextImage) await deleteImage(nextImage);
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: duplicateMessage(duplicateField(err)) });
      return;
    }
    throw err;
  }
});

export default router;
