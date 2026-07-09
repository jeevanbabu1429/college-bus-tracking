import { Router } from "express";
import { isValidObjectId, Types } from "mongoose";
import { StudentModel } from "../models/Student.js";
import { CollegeModel } from "../models/College.js";
import { BusModel } from "../models/Bus.js";
import { sendPushSafe } from "../services/notifications.js";

const router = Router({ mergeParams: true });

const GENDERS = ["male", "female", "other"];

// A stop is valid for a bus if its NAME is on the route. Suspended stops still
// count as valid targets — suspension is a temporary overlay, not a removal.
function hasStop(
  bus: InstanceType<typeof BusModel> | null,
  name: string
): boolean {
  return !!bus && bus.stops.some((s) => s.name === name);
}

router.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }
  const students = await StudentModel.find({ college: collegeId })
    .sort({ createdAt: -1 })
    .populate("bus");
  res.json(students);
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

  const { name, rollNumber, gender, dob, address, mobile, busId, stop } =
    req.body ?? {};

  if (!name || !rollNumber || !gender || !dob || !address || !mobile) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Invalid gender" });
    return;
  }

  let resolvedBus: Types.ObjectId | null = null;
  let resolvedStop: string | null = null;

  if (busId) {
    if (!isValidObjectId(busId)) {
      res.status(400).json({ error: "Invalid bus id" });
      return;
    }
    const bus = await BusModel.findOne({ _id: busId, college: collegeId });
    if (!bus) {
      res.status(404).json({ error: "Bus not found in this college" });
      return;
    }
    const occupants = await StudentModel.countDocuments({ bus: bus._id });
    if (occupants >= bus.capacity) {
      res.status(409).json({ error: `Bus is full (${bus.capacity} seats)` });
      return;
    }
    resolvedBus = bus._id;

    if (stop !== undefined && stop !== null && stop !== "") {
      if (typeof stop !== "string") {
        res.status(400).json({ error: "Invalid stop" });
        return;
      }
      const trimmed = stop.trim();
      if (!hasStop(bus, trimmed)) {
        res.status(400).json({ error: "Stop is not on this bus's route" });
        return;
      }
      resolvedStop = trimmed;
    }
  } else if (stop) {
    res.status(400).json({ error: "Cannot set a stop without a bus" });
    return;
  }

  try {
    const student = await StudentModel.create({
      college: college._id,
      name,
      rollNumber,
      gender,
      dob,
      address,
      mobile,
      bus: resolvedBus,
      stop: resolvedStop,
    });
    const populated = await student.populate("bus");
    res.status(201).json(populated);
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

  const students = (req.body ?? {}).students;
  if (!Array.isArray(students)) {
    res.status(400).json({ error: "students must be an array" });
    return;
  }
  if (students.length === 0) {
    res.status(400).json({ error: "students must contain at least one row" });
    return;
  }
  if (students.length > 500) {
    res.status(400).json({ error: "Cannot import more than 500 students at once" });
    return;
  }

  type FailedRow = {
    row: number;
    name?: string;
    rollNumber?: string;
    error: string;
  };
  const created: unknown[] = [];
  const failed: FailedRow[] = [];

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  for (let i = 0; i < students.length; i++) {
    const row = students[i] ?? {};
    const name = str(row.name);
    const rollNumber = str(row.rollNumber);
    const gender = str(row.gender).toLowerCase();
    const dob = str(row.dob);
    const address = str(row.address);
    const mobile = str(row.mobile);

    if (!name) {
      failed.push({ row: i + 1, error: "name is required" });
      continue;
    }
    if (!rollNumber) {
      failed.push({ row: i + 1, name, error: "rollNumber is required" });
      continue;
    }
    if (!GENDERS.includes(gender)) {
      failed.push({
        row: i + 1,
        name,
        rollNumber,
        error: "gender must be male, female or other",
      });
      continue;
    }
    if (!dob) {
      failed.push({ row: i + 1, name, rollNumber, error: "dob is required" });
      continue;
    }
    const dobDate = new Date(dob);
    if (Number.isNaN(dobDate.getTime())) {
      failed.push({
        row: i + 1,
        name,
        rollNumber,
        error: "dob must be a valid date",
      });
      continue;
    }
    if (!address) {
      failed.push({ row: i + 1, name, rollNumber, error: "address is required" });
      continue;
    }
    if (!mobile) {
      failed.push({ row: i + 1, name, rollNumber, error: "mobile is required" });
      continue;
    }

    try {
      const student = await StudentModel.create({
        college: college._id,
        name,
        rollNumber,
        gender,
        dob: dobDate,
        address,
        mobile,
        bus: null,
        stop: null,
      });
      created.push(student);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        const dup = (err as { keyPattern?: Record<string, number> }).keyPattern;
        const field = dup ? Object.keys(dup).join("+") : "field";
        failed.push({
          row: i + 1,
          name,
          rollNumber,
          error: `${field} already exists`,
        });
      } else {
        failed.push({
          row: i + 1,
          name,
          rollNumber,
          error: (err as Error).message || "Failed to create",
        });
      }
    }
  }

  res.status(201).json({ created, failed });
});

router.put("/:studentId", async (req, res) => {
  const { collegeId, studentId } = req.params as {
    collegeId: string;
    studentId: string;
  };
  if (!isValidObjectId(collegeId) || !isValidObjectId(studentId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const student = await StudentModel.findOne({
    _id: studentId,
    college: collegeId,
  });
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const { name, rollNumber, gender, dob, address, mobile, busId, stop } =
    req.body ?? {};

  if (!name || !rollNumber || !gender || !dob || !address || !mobile) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  if (!GENDERS.includes(gender)) {
    res.status(400).json({ error: "Invalid gender" });
    return;
  }

  let nextBus: Types.ObjectId | null;
  let nextBusDoc: InstanceType<typeof BusModel> | null = null;

  if (busId === undefined) {
    nextBus = student.bus ?? null;
    if (nextBus) nextBusDoc = await BusModel.findById(nextBus);
  } else if (busId === null || busId === "") {
    nextBus = null;
  } else {
    if (!isValidObjectId(busId)) {
      res.status(400).json({ error: "Invalid bus id" });
      return;
    }
    if (student.bus && student.bus.toString() === busId) {
      nextBus = student.bus;
      nextBusDoc = await BusModel.findById(nextBus);
    } else {
      const bus = await BusModel.findOne({ _id: busId, college: collegeId });
      if (!bus) {
        res.status(404).json({ error: "Bus not found in this college" });
        return;
      }
      const occupants = await StudentModel.countDocuments({
        bus: bus._id,
        _id: { $ne: student._id },
      });
      if (occupants >= bus.capacity) {
        res.status(409).json({
          error: `Bus is full (${bus.capacity} seats)`,
        });
        return;
      }
      nextBus = bus._id;
      nextBusDoc = bus;
    }
  }

  let nextStop: string | null;
  if (nextBus === null) {
    nextStop = null;
  } else if (stop === undefined) {
    nextStop =
      student.stop && hasStop(nextBusDoc, student.stop)
        ? student.stop
        : null;
  } else if (stop === null || stop === "") {
    nextStop = null;
  } else {
    if (typeof stop !== "string") {
      res.status(400).json({ error: "Invalid stop" });
      return;
    }
    const trimmed = stop.trim();
    if (!hasStop(nextBusDoc, trimmed)) {
      res.status(400).json({ error: "Stop is not on this bus's route" });
      return;
    }
    nextStop = trimmed;
  }

  student.set({
    name,
    rollNumber,
    gender,
    dob,
    address,
    mobile,
    bus: nextBus,
    stop: nextStop,
  });

  try {
    await student.save();
    const populated = await student.populate("bus");
    res.json(populated);
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

router.post("/bus-assignments", async (req, res) => {
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
  if (assignments.length > 1000) {
    res
      .status(400)
      .json({ error: "Cannot assign more than 1000 students at once" });
    return;
  }

  type FailedRow = {
    row: number;
    student?: string;
    busNumber?: string;
    error: string;
  };
  const applied: unknown[] = [];
  const failed: FailedRow[] = [];

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const seenStudents = new Set<string>();
  // Cache buses so we don't re-fetch within a single upload.
  const busCache = new Map<string, InstanceType<typeof BusModel>>();

  for (let i = 0; i < assignments.length; i++) {
    const row = assignments[i] ?? {};
    const rollNumber = str(row.rollNumber);
    const mobile = str(row.mobile).replace(/\s+/g, "");
    const busNumber = str(row.busNumber);
    const stop = str(row.stop);
    const studentLabel = rollNumber || mobile;

    if (!rollNumber && !mobile) {
      failed.push({ row: i + 1, error: "rollNumber or mobile is required" });
      continue;
    }

    const studentKey = rollNumber || `m:${mobile}`;
    if (seenStudents.has(studentKey)) {
      failed.push({
        row: i + 1,
        student: studentLabel,
        busNumber,
        error: "student appears more than once in this upload",
      });
      continue;
    }

    const studentQuery = rollNumber
      ? { college: college._id, rollNumber }
      : { college: college._id, mobile };
    const student = await StudentModel.findOne(studentQuery);
    if (!student) {
      failed.push({
        row: i + 1,
        student: studentLabel,
        busNumber,
        error: "student not found in this college",
      });
      continue;
    }

    seenStudents.add(studentKey);

    // Empty busNumber = unassign.
    if (!busNumber) {
      student.bus = null;
      student.stop = null;
      try {
        await student.save();
        const populated = await student.populate("bus");
        applied.push(populated);
      } catch (err) {
        failed.push({
          row: i + 1,
          student: studentLabel,
          error: (err as Error).message || "Failed to unassign",
        });
      }
      continue;
    }

    let bus = busCache.get(busNumber) ?? null;
    if (!bus) {
      bus = await BusModel.findOne({ college: college._id, busNumber });
      if (bus) busCache.set(busNumber, bus);
    }
    if (!bus) {
      failed.push({
        row: i + 1,
        student: studentLabel,
        busNumber,
        error: "bus not found in this college",
      });
      continue;
    }

    const isCurrent = student.bus?.toString() === bus._id.toString();
    if (!isCurrent) {
      const occupants = await StudentModel.countDocuments({
        bus: bus._id,
        _id: { $ne: student._id },
      });
      if (occupants >= bus.capacity) {
        failed.push({
          row: i + 1,
          student: studentLabel,
          busNumber,
          error: `bus is full (${bus.capacity} seats)`,
        });
        continue;
      }
    }

    let resolvedStop: string | null = null;
    if (stop) {
      if (!hasStop(bus, stop)) {
        failed.push({
          row: i + 1,
          student: studentLabel,
          busNumber,
          error: `stop "${stop}" is not on this bus's route`,
        });
        continue;
      }
      resolvedStop = stop;
    }

    student.bus = bus._id;
    student.stop = resolvedStop;

    try {
      await student.save();
      const populated = await student.populate("bus");
      applied.push(populated);
    } catch (err) {
      failed.push({
        row: i + 1,
        student: studentLabel,
        busNumber,
        error: (err as Error).message || "Failed to assign",
      });
    }
  }

  res.status(200).json({ applied, failed });
});

router.put("/:studentId/bus", async (req, res) => {
  const { collegeId, studentId } = req.params as {
    collegeId: string;
    studentId: string;
  };
  if (!isValidObjectId(collegeId) || !isValidObjectId(studentId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const student = await StudentModel.findOne({
    _id: studentId,
    college: collegeId,
  });
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const prevBusId = student.bus ? student.bus.toString() : null;
  const prevStop = student.stop ?? null;

  const { busId, stop } = req.body ?? {};

  if (busId === null || busId === undefined || busId === "") {
    student.bus = null;
    student.stop = null;
    await student.save();
    if (prevBusId) {
      sendPushSafe(
        { role: "student", id: student._id },
        {
          title: "Bus unassigned",
          body: "You have been removed from your bus. Please contact the admin.",
          data: { kind: "bus-unassigned", url: "/" },
        }
      );
    }
    const populated = await student.populate("bus");
    res.json(populated);
    return;
  }

  if (!isValidObjectId(busId)) {
    res.status(400).json({ error: "Invalid bus id" });
    return;
  }

  let bus: InstanceType<typeof BusModel> | null;
  if (student.bus && student.bus.toString() === busId) {
    bus = await BusModel.findById(student.bus);
  } else {
    bus = await BusModel.findOne({ _id: busId, college: collegeId });
    if (!bus) {
      res.status(404).json({ error: "Bus not found in this college" });
      return;
    }
    const occupants = await StudentModel.countDocuments({
      bus: bus._id,
      _id: { $ne: student._id },
    });
    if (occupants >= bus.capacity) {
      res.status(409).json({
        error: `Bus is full (${bus.capacity} seats)`,
      });
      return;
    }
    student.bus = bus._id;
  }

  if (stop === undefined) {
    if (!(student.stop && hasStop(bus, student.stop))) {
      student.stop = null;
    }
  } else if (stop === null || stop === "") {
    student.stop = null;
  } else {
    if (typeof stop !== "string") {
      res.status(400).json({ error: "Invalid stop" });
      return;
    }
    const trimmed = stop.trim();
    if (!hasStop(bus, trimmed)) {
      res.status(400).json({ error: "Stop is not on this bus's route" });
      return;
    }
    student.stop = trimmed;
  }

  await student.save();
  const newBusId = student.bus ? student.bus.toString() : null;
  const newStop = student.stop ?? null;
  if (newBusId && (newBusId !== prevBusId || newStop !== prevStop) && bus) {
    sendPushSafe(
      { role: "student", id: student._id },
      {
        title: `Assigned to bus ${bus.busNumber}`,
        body: newStop
          ? `Your stop is ${newStop}. Open the app to view the route.`
          : "Open the app to pick your stop.",
        data: { kind: "bus-assigned", busId: newBusId, stop: newStop ?? "", url: "/" },
      }
    );
  }
  const populated = await student.populate("bus");
  res.json(populated);
});

export default router;
