import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { BusModel } from "../models/Bus.js";
import { CollegeModel } from "../models/College.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";

const router = Router({ mergeParams: true });

const DRIVER_PROJECTION = "-otp -otpExpiresAt";

router.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }
  const buses = await BusModel.find({ college: collegeId })
    .sort({ createdAt: -1 })
    .populate("driver", DRIVER_PROJECTION);
  res.json(buses);
});

// Live tracking feed for the admin. Only includes buses whose assigned driver
// has tripActive: true — drivers who haven't started a trip aren't relevant
// here. The shape is bus-centric (route + stops + notice + driver snapshot)
// so the website can render one card per live bus + drop a single map marker.
router.get("/live", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const activeDrivers = await DriverModel.find({
    college: collegeId,
    tripActive: true,
  })
    .select("name mobile licenceNumber currentLocation tripActive")
    .lean();

  if (activeDrivers.length === 0) {
    res.json([]);
    return;
  }

  const activeIds = activeDrivers.map((d) => d._id);
  const buses = await BusModel.find({
    college: collegeId,
    driver: { $in: activeIds },
  })
    .select("busNumber plateNumber capacity route stops notice driver")
    .lean();

  const driverById = new Map(activeDrivers.map((d) => [String(d._id), d]));
  const items = buses
    .map((bus) => {
      const driver = bus.driver ? driverById.get(String(bus.driver)) : null;
      if (!driver) return null;
      return {
        bus: {
          _id: bus._id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          capacity: bus.capacity,
          route: bus.route,
          stops: bus.stops,
          notice: bus.notice,
        },
        driver: {
          _id: driver._id,
          name: driver.name,
          mobile: driver.mobile,
          licenceNumber: driver.licenceNumber,
          tripActive: driver.tripActive,
          currentLocation: driver.currentLocation ?? null,
        },
      };
    })
    .filter((x) => x !== null);

  res.json(items);
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

  const { busNumber, plateNumber, capacity } = req.body ?? {};

  if (!busNumber || !plateNumber) {
    res.status(400).json({ error: "busNumber and plateNumber are required" });
    return;
  }
  if (typeof capacity !== "number" || capacity < 1) {
    res.status(400).json({ error: "capacity must be a number ≥ 1" });
    return;
  }

  try {
    const bus = await BusModel.create({
      college: college._id,
      busNumber,
      plateNumber,
      capacity,
    });
    res.status(201).json(bus);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
      const field = dup && "plateNumber" in dup ? "plateNumber" : "busNumber";
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

  const buses = (req.body ?? {}).buses;
  if (!Array.isArray(buses)) {
    res.status(400).json({ error: "buses must be an array" });
    return;
  }
  if (buses.length === 0) {
    res.status(400).json({ error: "buses must contain at least one row" });
    return;
  }
  if (buses.length > 500) {
    res.status(400).json({ error: "Cannot import more than 500 buses at once" });
    return;
  }

  type FailedRow = {
    row: number;
    busNumber?: string;
    plateNumber?: string;
    error: string;
  };
  const created: unknown[] = [];
  const failed: FailedRow[] = [];

  for (let i = 0; i < buses.length; i++) {
    const row = buses[i] ?? {};
    const busNumber =
      typeof row.busNumber === "string" ? row.busNumber.trim() : "";
    const plateNumber =
      typeof row.plateNumber === "string" ? row.plateNumber.trim() : "";
    const capacityRaw = row.capacity;
    const capacity =
      typeof capacityRaw === "number"
        ? capacityRaw
        : typeof capacityRaw === "string"
        ? Number(capacityRaw)
        : NaN;

    if (!busNumber) {
      failed.push({ row: i + 1, plateNumber, error: "busNumber is required" });
      continue;
    }
    if (!plateNumber) {
      failed.push({ row: i + 1, busNumber, error: "plateNumber is required" });
      continue;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      failed.push({
        row: i + 1,
        busNumber,
        plateNumber,
        error: "capacity must be a number ≥ 1",
      });
      continue;
    }

    try {
      const bus = await BusModel.create({
        college: college._id,
        busNumber,
        plateNumber,
        capacity,
      });
      created.push(bus);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
        const field = dup && "plateNumber" in dup ? "plateNumber" : "busNumber";
        failed.push({
          row: i + 1,
          busNumber,
          plateNumber,
          error: `${field} already exists`,
        });
      } else {
        failed.push({
          row: i + 1,
          busNumber,
          plateNumber,
          error: (err as Error).message || "Failed to create",
        });
      }
    }
  }

  res.status(201).json({ created, failed });
});

router.post("/driver-assignments", async (req, res) => {
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

  const assignments = (req.body ?? {}).assignments;
  if (!Array.isArray(assignments)) {
    res.status(400).json({ error: "assignments must be an array" });
    return;
  }
  if (assignments.length === 0) {
    res.status(400).json({ error: "assignments must contain at least one row" });
    return;
  }
  if (assignments.length > 500) {
    res
      .status(400)
      .json({ error: "Cannot assign more than 500 drivers at once" });
    return;
  }

  type FailedRow = {
    row: number;
    busNumber?: string;
    driver?: string;
    error: string;
  };
  const applied: unknown[] = [];
  const failed: FailedRow[] = [];

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const seenBuses = new Set<string>();
  const seenDrivers = new Set<string>();

  for (let i = 0; i < assignments.length; i++) {
    const row = assignments[i] ?? {};
    const busNumber = str(row.busNumber);
    const licenceNumber = str(row.licenceNumber).toUpperCase();
    const mobile = str(row.mobile);
    const driverLabel = licenceNumber || mobile || "";

    if (!busNumber) {
      failed.push({ row: i + 1, error: "busNumber is required" });
      continue;
    }
    if (!licenceNumber && !mobile) {
      failed.push({
        row: i + 1,
        busNumber,
        error: "licenceNumber or mobile is required",
      });
      continue;
    }

    if (seenBuses.has(busNumber)) {
      failed.push({
        row: i + 1,
        busNumber,
        driver: driverLabel,
        error: "busNumber appears more than once in this upload",
      });
      continue;
    }
    const driverKey = licenceNumber || `m:${mobile}`;
    if (seenDrivers.has(driverKey)) {
      failed.push({
        row: i + 1,
        busNumber,
        driver: driverLabel,
        error: "driver appears more than once in this upload",
      });
      continue;
    }

    const bus = await BusModel.findOne({ college: college._id, busNumber });
    if (!bus) {
      failed.push({
        row: i + 1,
        busNumber,
        driver: driverLabel,
        error: "bus not found in this college",
      });
      continue;
    }

    const driverQuery = licenceNumber
      ? { college: college._id, licenceNumber }
      : { college: college._id, mobile };
    const driver = await DriverModel.findOne(driverQuery);
    if (!driver) {
      failed.push({
        row: i + 1,
        busNumber,
        driver: driverLabel,
        error: "driver not found in this college",
      });
      continue;
    }

    seenBuses.add(busNumber);
    seenDrivers.add(driverKey);

    // If this driver is already assigned to a different bus, clear that bus
    // first — otherwise the unique index on bus.driver would reject the save.
    if (bus.driver?.toString() !== driver._id.toString()) {
      await BusModel.updateOne(
        { college: college._id, driver: driver._id, _id: { $ne: bus._id } },
        { $set: { driver: null } }
      );
    }

    bus.driver = driver._id;

    try {
      await bus.save();
      const populated = await bus.populate("driver", DRIVER_PROJECTION);
      applied.push(populated);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        failed.push({
          row: i + 1,
          busNumber,
          driver: driverLabel,
          error: "driver is already assigned to another bus",
        });
      } else {
        failed.push({
          row: i + 1,
          busNumber,
          driver: driverLabel,
          error: (err as Error).message || "Failed to assign",
        });
      }
    }
  }

  res.status(200).json({ applied, failed });
});

router.put("/:busId/route", async (req, res) => {
  const { collegeId, busId } = req.params as {
    collegeId: string;
    busId: string;
  };
  if (!isValidObjectId(collegeId) || !isValidObjectId(busId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bus = await BusModel.findOne({ _id: busId, college: collegeId });
  if (!bus) {
    res.status(404).json({ error: "Bus not found" });
    return;
  }

  const { route, stops, notice } = req.body ?? {};
  if (typeof route !== "string") {
    res.status(400).json({ error: "route must be a string" });
    return;
  }
  if (!Array.isArray(stops)) {
    res.status(400).json({ error: "stops must be an array" });
    return;
  }
  if (notice !== undefined && typeof notice !== "string") {
    res.status(400).json({ error: "notice must be a string" });
    return;
  }

  // Accept stops either as plain strings (legacy/simple) or as objects
  // { name, lat?, lng?, suspended? }. Normalize, drop unnamed entries, and
  // de-duplicate by name (first occurrence wins) so the name stays a stable key.
  const seen = new Set<string>();
  const normalizedStops: {
    name: string;
    lat: number | null;
    lng: number | null;
    suspended: boolean;
  }[] = [];
  for (const raw of stops) {
    const isObj = raw && typeof raw === "object";
    const name = (isObj ? raw.name : raw);
    if (typeof name !== "string" || !name.trim()) continue;
    const trimmed = name.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalizedStops.push({
      name: trimmed,
      lat: isObj && typeof raw.lat === "number" ? raw.lat : null,
      lng: isObj && typeof raw.lng === "number" ? raw.lng : null,
      suspended: isObj && raw.suspended === true,
    });
  }

  bus.route = route.trim();
  bus.set("stops", normalizedStops);
  if (typeof notice === "string") bus.notice = notice.trim();

  await bus.save();

  // Cascade: students keep their stop as long as its NAME still exists on the
  // route — suspending a stop does NOT clear assignments. Only a stop that was
  // truly removed un-assigns the affected students.
  const stopNames = normalizedStops.map((s) => s.name);
  await StudentModel.updateMany(
    { bus: bus._id, stop: { $nin: stopNames, $ne: null } },
    { $set: { stop: null } }
  );

  const populated = await bus.populate("driver", DRIVER_PROJECTION);
  res.json(populated);
});

router.put("/:busId/driver", async (req, res) => {
  const { collegeId, busId } = req.params as {
    collegeId: string;
    busId: string;
  };
  if (!isValidObjectId(collegeId) || !isValidObjectId(busId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bus = await BusModel.findOne({ _id: busId, college: collegeId });
  if (!bus) {
    res.status(404).json({ error: "Bus not found" });
    return;
  }

  const { driverId } = req.body ?? {};

  if (driverId === null || driverId === undefined || driverId === "") {
    bus.driver = null;
    await bus.save();
    const populated = await bus.populate("driver", DRIVER_PROJECTION);
    res.json(populated);
    return;
  }

  if (!isValidObjectId(driverId)) {
    res.status(400).json({ error: "Invalid driver id" });
    return;
  }

  const driver = await DriverModel.findOne({
    _id: driverId,
    college: collegeId,
  });
  if (!driver) {
    res.status(404).json({ error: "Driver not found in this college" });
    return;
  }

  bus.driver = driver._id;

  try {
    await bus.save();
    const populated = await bus.populate("driver", DRIVER_PROJECTION);
    res.json(populated);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res
        .status(409)
        .json({ error: "Driver is already assigned to another bus" });
      return;
    }
    throw err;
  }
});

export default router;
