import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId, type Types } from "mongoose";
import { DriverModel } from "../models/Driver.js";
import { BusModel } from "../models/Bus.js";
import { StudentModel } from "../models/Student.js";
import { CollegeModel } from "../models/College.js";
import { sendPushSafe } from "../services/notifications.js";
import {
  checkCollegeAdminSuspension,
  sendSuspended,
} from "../lib/suspension.js";
import { haversineMeters } from "../lib/geo.js";

const router = Router();

const requireDriver: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: { role?: string; sub?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(token, secret) as { role?: string; sub?: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (payload.role !== "driver" || !payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Not a driver token" });
    return;
  }
  const driver = await DriverModel.findById(payload.sub).select("college").lean();
  const suspensionMsg = await checkCollegeAdminSuspension(
    driver?.college,
    "driver"
  );
  if (suspensionMsg) {
    sendSuspended(res, suspensionMsg);
    return;
  }
  (req as unknown as { driverId?: string }).driverId = payload.sub;
  next();
};

router.use(requireDriver);

router.get("/status", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  const bus = await BusModel.findOne({ driver: driver._id });
  res.json({
    bus: bus
      ? {
          _id: bus._id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          route: bus.route,
          stops: bus.stops,
          notice: bus.notice,
        }
      : null,
    tripActive: driver.tripActive ?? false,
    currentLocation: driver.currentLocation ?? null,
    currentIssue: driver.currentIssue ?? null,
    stopArrivals: driver.stopArrivals ?? [],
  });
});

const ISSUE_TYPES = new Set([
  "breakdown",
  "flat_tyre",
  "refuelling",
  "traffic",
  "mechanical",
  "weather",
  "other",
]);

const ISSUE_LABELS: Record<string, string> = {
  breakdown: "Breakdown",
  flat_tyre: "Flat tyre",
  refuelling: "Refuelling stop",
  traffic: "Traffic delay",
  mechanical: "Mechanical issue",
  weather: "Weather delay",
  other: "Issue reported",
};

// Students on the bus and the admin who runs the college. Both need to hear
// about a breakdown; only one of them can do anything about it.
async function busAudience(driverId: string): Promise<{
  busId: string;
  busNumber: string;
  studentIds: Types.ObjectId[];
  adminId: string | null;
} | null> {
  const bus = await BusModel.findOne({ driver: driverId })
    .select("_id busNumber college")
    .lean();
  if (!bus) return null;
  const [students, college] = await Promise.all([
    StudentModel.find({ bus: bus._id }).select("_id").lean(),
    CollegeModel.findById(bus.college).select("admin").lean(),
  ]);
  return {
    busId: bus._id.toString(),
    busNumber: bus.busNumber,
    studentIds: students.map((s) => s._id),
    adminId: college?.admin ? String(college.admin) : null,
  };
}

function notifyIssue(
  driverId: string,
  driverName: string,
  type: string,
  message: string
): void {
  (async () => {
    const audience = await busAudience(driverId);
    if (!audience) return;
    const label = ISSUE_LABELS[type] ?? "Issue reported";
    const data = {
      kind: "bus-issue",
      issue: type,
      busId: audience.busId,
      url: "/",
    };

    if (audience.studentIds.length > 0) {
      sendPushSafe(
        { role: "students", ids: audience.studentIds },
        {
          title: `Bus ${audience.busNumber}: ${label.toLowerCase()}`,
          body: message || `Your bus has reported a ${label.toLowerCase()}. Expect a delay.`,
          data,
        }
      );
    }

    // The admin gets the driver's name; the students do not need it and it is
    // the one detail that turns this into something the admin can act on.
    if (audience.adminId) {
      sendPushSafe(
        { role: "admin", id: audience.adminId },
        {
          title: `${label} on bus ${audience.busNumber}`,
          body: message
            ? `${driverName}: ${message}`
            : `${driverName} reported a ${label.toLowerCase()}.`,
          data,
        }
      );
    }
  })().catch((err) => console.error("[fcm] notifyIssue failed:", err));
}

function notifyIssueCleared(
  driverId: string,
  driverName: string,
  type: string
): void {
  (async () => {
    const audience = await busAudience(driverId);
    if (!audience) return;
    const label = (ISSUE_LABELS[type] ?? "issue").toLowerCase();
    const data = {
      kind: "bus-issue-cleared",
      issue: type,
      busId: audience.busId,
      url: "/",
    };

    if (audience.studentIds.length > 0) {
      sendPushSafe(
        { role: "students", ids: audience.studentIds },
        {
          title: `Bus ${audience.busNumber} is back on the road`,
          body: `The ${label} has been sorted out. The bus is running again.`,
          data,
        }
      );
    }
    if (audience.adminId) {
      sendPushSafe(
        { role: "admin", id: audience.adminId },
        {
          title: `Bus ${audience.busNumber} resolved`,
          body: `${driverName} marked the ${label} as resolved.`,
          data,
        }
      );
    }
  })().catch((err) => console.error("[fcm] notifyIssueCleared failed:", err));
}

router.post("/issue", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { type, message } = req.body ?? {};
  if (typeof type !== "string" || !ISSUE_TYPES.has(type)) {
    res.status(400).json({
      error: "type must be one of breakdown, flat_tyre, refuelling, traffic, mechanical, weather, other",
    });
    return;
  }
  const trimmedMessage =
    typeof message === "string" ? message.trim().slice(0, 240) : "";
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    {
      $set: {
        currentIssue: {
          type,
          message: trimmedMessage,
          reportedAt: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  notifyIssue(driver._id.toString(), driver.name, type, trimmedMessage);
  res.json({ ok: true, currentIssue: driver.currentIssue ?? null });
});

router.delete("/issue", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  // Default `new: false` on purpose — the pre-update document is the only
  // place the issue being resolved still exists, and the message names it.
  const before = await DriverModel.findByIdAndUpdate(driverId, {
    $set: { currentIssue: null },
  });
  if (!before) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  // Silent when there was nothing to clear: a driver double-tapping "Mark
  // resolved" must not tell the whole bus twice that it is back on the road.
  if (before.currentIssue) {
    notifyIssueCleared(
      before._id.toString(),
      before.name,
      before.currentIssue.type
    );
  }
  res.json({ ok: true });
});

router.post("/start", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    // Also wipe the arriving-soon dedup list and last run's arrivals so every
    // trip starts fresh.
    { $set: { tripActive: true, notifiedStudentIds: [], stopArrivals: [] } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  notifyTripChange(driver._id.toString(), "start");
  res.json({ ok: true });
});

router.post("/stop", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const driver = await DriverModel.findByIdAndUpdate(
    driverId,
    { $set: { tripActive: false, notifiedStudentIds: [], stopArrivals: [] } },
    { new: true }
  );
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  notifyTripChange(driver._id.toString(), "stop");
  res.json({ ok: true });
});

function notifyTripChange(driverId: string, kind: "start" | "stop") {
  (async () => {
    const bus = await BusModel.findOne({ driver: driverId }).select("_id busNumber");
    if (!bus) return;
    const students = await StudentModel.find({ bus: bus._id }).select("_id").lean();
    const ids = students.map((s) => s._id);
    if (ids.length === 0) return;
    const title = kind === "start" ? "Bus has started" : "Bus has stopped";
    const body =
      kind === "start"
        ? `Bus ${bus.busNumber} is on the route. Track its live location.`
        : `Bus ${bus.busNumber} has finished its trip.`;
    sendPushSafe(
      { role: "students", ids },
      { title, body, data: { kind: `trip-${kind}`, busId: bus._id.toString(), url: "/" } }
    );
  })().catch((err) => console.error("[fcm] notifyTripChange failed:", err));
}

// Mark a stop as reached, or take the mark back.
//
// Deliberately driver-confirmed rather than derived from GPS. A bus sits
// inside a stop's radius at a red light, and a route often doubles back past
// a stop it has not served — auto-marking on proximity would tell students
// the bus had been somewhere it had not stopped. The driver taps once and the
// claim is theirs.
router.post("/arrival", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { stop, arrived } = req.body ?? {};
  if (typeof stop !== "string" || !stop.trim()) {
    res.status(400).json({ error: "stop (a stop name) is required" });
    return;
  }
  if (typeof arrived !== "boolean") {
    res.status(400).json({ error: "arrived (a boolean) is required" });
    return;
  }

  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  if (!driver.tripActive) {
    res.status(400).json({ error: "Start the trip before marking stops" });
    return;
  }

  const bus = await BusModel.findOne({ driver: driver._id })
    .select("_id busNumber stops")
    .lean();
  if (!bus) {
    res.status(404).json({ error: "No bus assigned to this driver" });
    return;
  }
  // Match the route's own spelling so what gets stored always equals a
  // student's `stop` value exactly, whatever casing the client sent.
  const known = bus.stops.find(
    (s) => s.name.toLowerCase() === stop.trim().toLowerCase()
  );
  if (!known) {
    res.status(400).json({ error: "That stop is not on this bus's route" });
    return;
  }

  const existing = (driver.stopArrivals ?? []).find(
    (a) => a.stop === known.name
  );

  if (arrived) {
    // Idempotent: re-marking keeps the first arrival time rather than sliding
    // it forward every time the button is tapped twice.
    if (!existing) {
      driver.stopArrivals.push({ stop: known.name, at: new Date() });
      await driver.save();
      notifyStopArrival(bus._id.toString(), bus.busNumber, known.name);
      notifyNextStop(
        driver._id.toString(),
        bus._id.toString(),
        bus.busNumber,
        bus.stops.map((st) => ({ name: st.name, suspended: !!st.suspended })),
        driver.stopArrivals.map((a) => ({ stop: a.stop, at: a.at }))
      );
    }
  } else if (existing) {
    const at = driver.stopArrivals.findIndex((a) => a.stop === known.name);
    driver.stopArrivals.splice(at, 1);
    await driver.save();
  }

  res.json({ ok: true, stopArrivals: driver.stopArrivals ?? [] });
});

// "Your bus is one stop away" — fired when the driver marks the stop directly
// before someone's own.
//
// Which stop is "before" cannot come from the array order: the same route is
// driven forwards in the morning and backwards in the evening. It is inferred
// from the marks themselves — the step from the previous mark to this one is
// the direction of travel. On the very first mark of a trip there is nothing
// to compare against, so it is only safe when the bus started at one end of
// the line; anywhere else the alert is skipped rather than guessed, since
// telling the wrong half of the bus to get ready is worse than saying nothing.
function notifyNextStop(
  driverId: string,
  busId: string,
  busNumber: string,
  stops: { name: string; suspended: boolean }[],
  arrivals: { stop: string; at: Date }[]
): void {
  (async () => {
    if (stops.length < 2) return;

    const indexByName = new Map(stops.map((s, i) => [s.name, i]));
    const marks = [...arrivals]
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((a) => indexByName.get(a.stop))
      .filter((i): i is number => i !== undefined);
    if (marks.length === 0) return;

    const current = marks[marks.length - 1];
    let direction = 0;
    if (marks.length >= 2) {
      direction = Math.sign(current - marks[marks.length - 2]);
    } else if (current === 0) {
      direction = 1;
    } else if (current === stops.length - 1) {
      direction = -1;
    }
    // Unknown direction, or the driver re-marked the stop they were already on.
    if (direction === 0) return;

    const next = stops[current + direction];
    // Past the end of the line, or a stop the bus is not serving today — the
    // students there were told it was suspended when the admin closed it.
    if (!next || next.suspended) return;

    const students = await StudentModel.find({ bus: busId, stop: next.name })
      .select("_id")
      .lean();
    if (students.length === 0) return;

    // Shares the dedup set with the GPS-driven arriving-soon push, so a
    // student gets one "get ready" per trip no matter which of the two
    // mechanisms noticed first.
    const dr = await DriverModel.findById(driverId)
      .select("notifiedStudentIds")
      .lean();
    const already = new Set((dr?.notifiedStudentIds ?? []).map((id) => String(id)));
    const fresh = students.filter((s) => !already.has(String(s._id)));
    if (fresh.length === 0) return;

    // Reserve before sending, like notifyArrivingSoon — two marks in quick
    // succession must not both get through.
    await DriverModel.updateOne(
      { _id: driverId },
      { $addToSet: { notifiedStudentIds: { $each: fresh.map((s) => s._id) } } }
    );

    sendPushSafe(
      { role: "students", ids: fresh.map((s) => s._id) },
      {
        title: "Your bus is one stop away",
        body: `Bus ${busNumber} has just reached ${stops[current].name}. ${next.name} is next — get ready to board.`,
        data: {
          kind: "next-stop",
          busId,
          stop: next.name,
          previousStop: stops[current].name,
          url: "/",
        },
      }
    );
  })().catch((err) => console.error("[fcm] notifyNextStop failed:", err));
}

// Tell the students who board at this stop that their bus is actually there.
// Fired only on the transition into "arrived", so undoing and re-marking a
// stop the driver mis-tapped does not push the same alert twice in a row.
function notifyStopArrival(
  busId: string,
  busNumber: string,
  stopName: string
): void {
  (async () => {
    const students = await StudentModel.find({ bus: busId, stop: stopName })
      .select("_id")
      .lean();
    const ids = students.map((s) => s._id);
    if (ids.length === 0) return;
    sendPushSafe(
      { role: "students", ids },
      {
        title: "Your bus has arrived",
        body: `Bus ${busNumber} has reached ${stopName}.`,
        data: { kind: "stop-arrived", busId, stop: stopName, url: "/" },
      }
    );
  })().catch((err) => console.error("[fcm] notifyStopArrival failed:", err));
}

router.post("/location", async (req, res) => {
  const driverId = (req as unknown as { driverId: string }).driverId;
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng (numbers) are required" });
    return;
  }
  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    res.status(404).json({ error: "Driver not found" });
    return;
  }
  if (!driver.tripActive) {
    res.status(400).json({ error: "Trip is not active" });
    return;
  }
  driver.currentLocation = { lat, lng, updatedAt: new Date() };
  await driver.save();

  // Fire the "arriving soon" push if the bus has just entered the approach
  // zone of the stop right before any un-notified student's stop.
  notifyArrivingSoon(driver._id.toString(), lat, lng).catch((err) =>
    console.error("[fcm] arriving-soon check failed:", err)
  );

  res.json({ ok: true });
});

// Fire-once-per-trip proximity push. Runs after every /trip/location save,
// but only sends when a student's "previous stop" is within
// ARRIVING_SOON_METERS of the current bus location AND that student wasn't
// already notified this trip.
const ARRIVING_SOON_METERS = 300;

async function notifyArrivingSoon(
  driverId: string,
  lat: number,
  lng: number
): Promise<void> {
  const bus = await BusModel.findOne({ driver: driverId })
    .select("_id busNumber stops")
    .lean();
  if (!bus || bus.stops.length < 2) return;

  // Reload the *fresh* notifiedStudentIds — the caller's `driver` object was
  // saved before the array might've been mutated by a concurrent request.
  const dr = await DriverModel.findById(driverId)
    .select("notifiedStudentIds")
    .lean();
  const alreadyNotified = new Set(
    (dr?.notifiedStudentIds ?? []).map((id) => String(id))
  );

  const students = await StudentModel.find({
    bus: bus._id,
    stop: { $ne: null },
  })
    .select("_id stop")
    .lean();

  const stopIndexByName = new Map<string, number>();
  bus.stops.forEach((s, i) => stopIndexByName.set(s.name, i));

  const toNotify: { studentId: string; prevStop: string; myStop: string }[] = [];

  for (const student of students) {
    if (!student.stop) continue;
    if (alreadyNotified.has(String(student._id))) continue;
    const idx = stopIndexByName.get(student.stop);
    // idx === 0 → student is on the FIRST stop, no "previous" exists.
    // idx === undefined → stop was removed since; skip.
    if (idx === undefined || idx <= 0) continue;
    const prev = bus.stops[idx - 1];
    if (typeof prev.lat !== "number" || typeof prev.lng !== "number") continue;
    const d = haversineMeters(lat, lng, prev.lat, prev.lng);
    if (d > ARRIVING_SOON_METERS) continue;
    toNotify.push({
      studentId: String(student._id),
      prevStop: prev.name,
      myStop: student.stop,
    });
  }

  if (toNotify.length === 0) return;

  // Reserve first, send after — prevents duplicate pushes if two /location
  // requests race each other on the same driver.
  await DriverModel.updateOne(
    { _id: driverId },
    { $addToSet: { notifiedStudentIds: { $each: toNotify.map((n) => n.studentId) } } }
  );

  for (const n of toNotify) {
    sendPushSafe(
      { role: "student", id: n.studentId },
      {
        title: "Bus arriving soon",
        body: `Your bus is near ${n.prevStop} — one stop before ${n.myStop}. Get ready to board.`,
        data: {
          kind: "bus-approaching",
          busId: bus._id.toString(),
          stop: n.myStop,
          url: "/",
        },
      }
    );
  }
}

export default router;
