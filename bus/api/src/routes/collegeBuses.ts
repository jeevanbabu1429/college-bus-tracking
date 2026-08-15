import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { BusModel } from "../models/Bus.js";
import { CollegeModel } from "../models/College.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { sendPushSafe } from "../services/notifications.js";

const router = Router({ mergeParams: true });

// `image` is a base64 data URL — excluded here so bus payloads (fetched on
// several screens) don't carry photos nobody renders.
const DRIVER_PROJECTION = "-otp -otpExpiresAt -image";

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

// Buses whose driver has an unresolved problem.
//
// Deliberately NOT filtered by tripActive, unlike /live. currentIssue is not
// cleared when a trip stops — the driver decides when the situation is over —
// and a bus that broke down and came off the road is precisely the one the
// admin most needs on their dashboard.
router.get("/issues", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const drivers = await DriverModel.find({
    college: collegeId,
    currentIssue: { $ne: null },
  })
    .select("name mobile licenceNumber tripActive currentLocation currentIssue")
    .lean();
  if (drivers.length === 0) {
    res.json([]);
    return;
  }

  const buses = await BusModel.find({
    college: collegeId,
    driver: { $in: drivers.map((d) => d._id) },
  })
    .select("busNumber plateNumber route driver")
    .lean();

  // How many people are actually stranded by each one. It is the number that
  // decides which of two breakdowns the admin deals with first.
  const riderCounts = await Promise.all(
    buses.map((b) => StudentModel.countDocuments({ bus: b._id }))
  );
  const ridersByBus = new Map(
    buses.map((b, i) => [String(b._id), riderCounts[i]])
  );

  const driverById = new Map(drivers.map((d) => [String(d._id), d]));
  const items = buses
    .map((bus) => {
      const driver = bus.driver ? driverById.get(String(bus.driver)) : null;
      if (!driver?.currentIssue) return null;
      return {
        bus: {
          _id: bus._id,
          busNumber: bus.busNumber,
          plateNumber: bus.plateNumber,
          route: bus.route,
        },
        driver: {
          _id: driver._id,
          name: driver.name,
          mobile: driver.mobile,
          licenceNumber: driver.licenceNumber,
          tripActive: driver.tripActive ?? false,
          currentLocation: driver.currentLocation ?? null,
        },
        issue: driver.currentIssue,
        studentCount: ridersByBus.get(String(bus._id)) ?? 0,
      };
    })
    .filter((x) => x !== null);

  // Longest-running first: the one reported an hour ago has been ignored the
  // longest, whatever it is.
  items.sort(
    (a, b) =>
      new Date(a!.issue.reportedAt).getTime() -
      new Date(b!.issue.reportedAt).getTime()
  );

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

// Move a driver onto a bus in one request, handling the two-sided bookkeeping
// the plain PUT /:busId/driver cannot.
//
// `Bus.driver` carries a partial unique index, so a driver already sitting on
// another bus makes a naive assign fail with a duplicate key error — which is
// why the assign-drivers page has to grey those drivers out. Here both sides
// are cleared before either is set, so the write order never collides.
//
// When the destination bus already has a driver:
//   * the moved driver came from another bus -> the two SWAP places
//   * the moved driver came from the pool     -> the sitting driver is freed
//
// Body: { driverId, toBusId }. A null toBusId just unassigns the driver.
router.post("/reassign-driver", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const { driverId, toBusId } = (req.body ?? {}) as {
    driverId?: unknown;
    toBusId?: unknown;
  };

  if (typeof driverId !== "string" || !isValidObjectId(driverId)) {
    res.status(400).json({ error: "driverId is required" });
    return;
  }
  const targetId =
    toBusId === null || toBusId === undefined || toBusId === ""
      ? null
      : toBusId;
  if (targetId !== null && (typeof targetId !== "string" || !isValidObjectId(targetId))) {
    res.status(400).json({ error: "toBusId must be a bus id or null" });
    return;
  }

  const driver = await DriverModel.findOne({
    _id: driverId,
    college: collegeId,
  }).select("_id name");
  if (!driver) {
    res.status(404).json({ error: "Driver not found in this college" });
    return;
  }

  const fromBus = await BusModel.findOne({
    college: collegeId,
    driver: driver._id,
  });
  const toBus = targetId
    ? await BusModel.findOne({ _id: targetId, college: collegeId })
    : null;
  if (targetId && !toBus) {
    res.status(404).json({ error: "Bus not found in this college" });
    return;
  }

  // Already where it was asked to go — nothing to write.
  if (toBus && fromBus && toBus._id.equals(fromBus._id)) {
    const same = await toBus.populate("driver", DRIVER_PROJECTION);
    res.json({ buses: [same] });
    return;
  }

  const displacedId = toBus?.driver ?? null;
  const touched: string[] = [];

  // Release both sides first. Assigning before releasing would momentarily
  // put the same driver on two buses and trip the unique index.
  if (fromBus) {
    fromBus.driver = null;
    await fromBus.save();
    touched.push(fromBus._id.toString());
  }
  if (toBus && displacedId) {
    toBus.driver = null;
    await toBus.save();
  }

  if (toBus) {
    toBus.driver = driver._id;
    await toBus.save();
    touched.push(toBus._id.toString());

    // Swap only makes sense when the moved driver vacated a bus; otherwise
    // the displaced driver simply returns to the unassigned pool.
    if (displacedId && fromBus) {
      fromBus.driver = displacedId;
      await fromBus.save();
    }
  }

  const buses = await BusModel.find({ _id: { $in: touched } })
    .populate("driver", DRIVER_PROJECTION)
    .sort({ busNumber: 1 });

  res.json({ buses });
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

  const prevNotice = bus.notice ?? "";
  const prevRoute = bus.route ?? "";
  const prevOrder = (bus.stops ?? []).map((s) => s.name).join(" ");
  const prevSuspended = new Set(
    (bus.stops ?? []).filter((s) => s.suspended).map((s) => s.name)
  );
  const prevNames = new Set((bus.stops ?? []).map((s) => s.name));

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
    temporaryReplacement: string | null;
  }[] = [];
  for (const raw of stops) {
    const isObj = raw && typeof raw === "object";
    const name = (isObj ? raw.name : raw);
    if (typeof name !== "string" || !name.trim()) continue;
    const trimmed = name.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    const suspended = isObj && raw.suspended === true;
    const rawTemp =
      isObj && typeof raw.temporaryReplacement === "string"
        ? raw.temporaryReplacement.trim()
        : null;
    // Only preserve a temporary replacement while suspended is true —
    // storing one on a non-suspended stop would just be dead metadata.
    const temporaryReplacement = suspended && rawTemp ? rawTemp : null;
    normalizedStops.push({
      name: trimmed,
      lat: isObj && typeof raw.lat === "number" ? raw.lat : null,
      lng: isObj && typeof raw.lng === "number" ? raw.lng : null,
      suspended,
      temporaryReplacement,
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

  // Fan-out notifications. Three things students care about: a new/changed
  // notice banner, a stop being suspended, and a stop being removed entirely.
  const newSuspended = new Set(
    normalizedStops.filter((s) => s.suspended).map((s) => s.name)
  );
  const newlySuspended = [...newSuspended].filter((n) => !prevSuspended.has(n));
  const newlyResumed = [...prevSuspended].filter((n) => !newSuspended.has(n) && stopNames.includes(n));
  const removedStops = [...prevNames].filter((n) => !newSuspended.has(n) && !stopNames.includes(n));
  const noticeChanged = (typeof notice === "string" ? notice.trim() : prevNotice) !== prevNotice;

  // Map each newly-suspended stop to its temporary-replacement name (if any)
  // so the notification body can name it directly instead of pointing at the
  // in-app nearest-open-stop hint.
  const tempByStop = new Map<string, string | null>();
  for (const s of normalizedStops) {
    if (s.suspended) tempByStop.set(s.name, s.temporaryReplacement);
  }

  // The shape of the line itself: renamed route, stops added, or the order
  // rearranged. Suspensions are excluded — those already reach exactly the
  // students they affect, and a second blanket alert would double-notify.
  const addedStops = stopNames.filter((n) => !prevNames.has(n));
  const routeRenamed = bus.route !== prevRoute;
  const reordered = stopNames.join(" ") !== prevOrder;
  const lineChanged =
    routeRenamed || addedStops.length > 0 || removedStops.length > 0 || reordered;

  if (
    noticeChanged ||
    newlySuspended.length ||
    newlyResumed.length ||
    removedStops.length ||
    lineChanged
  ) {
    notifyBusUpdate(bus._id.toString(), bus.busNumber, {
      noticeChanged,
      notice: bus.notice,
      newlySuspended,
      newlyResumed,
      removedStops,
      tempByStop,
      lineChanged,
      routeRenamed,
      routeName: bus.route,
      addedStops,
      driverId: bus.driver ? String(bus.driver) : null,
    });
  }

  res.json(populated);
});

// One sentence covering whichever part of the line moved. Named stops where
// there are few enough to name, since "2 stops added" makes a reader open the
// app to find out which.
function describeLineChange(changes: {
  routeRenamed: boolean;
  routeName: string;
  addedStops: string[];
  removedStops: string[];
}): string {
  const parts: string[] = [];
  if (changes.addedStops.length > 0) {
    parts.push(
      changes.addedStops.length <= 3
        ? `${changes.addedStops.join(", ")} added`
        : `${changes.addedStops.length} stops added`
    );
  }
  if (changes.removedStops.length > 0) {
    parts.push(
      changes.removedStops.length <= 3
        ? `${changes.removedStops.join(", ")} removed`
        : `${changes.removedStops.length} stops removed`
    );
  }
  if (changes.routeRenamed && changes.routeName) {
    parts.push(`now running as "${changes.routeName}"`);
  }
  if (parts.length === 0) return "The stop order has changed. Check the app for the new route.";
  return `${parts.join("; ")}. Check the app for the full route.`;
}

function notifyBusUpdate(
  busId: string,
  busNumber: string,
  changes: {
    noticeChanged: boolean;
    notice: string;
    newlySuspended: string[];
    newlyResumed: string[];
    removedStops: string[];
    tempByStop: Map<string, string | null>;
    lineChanged: boolean;
    routeRenamed: boolean;
    routeName: string;
    addedStops: string[];
    driverId: string | null;
  }
) {
  (async () => {
    const students = await StudentModel.find({ bus: busId }).select("_id stop").lean();

    // The driver drives whatever the admin last saved, so any edit to the line
    // is theirs to know about — they were previously the only person on the
    // bus who was never told.
    if (changes.lineChanged && changes.driverId) {
      sendPushSafe(
        { role: "driver", id: changes.driverId },
        {
          title: `Bus ${busNumber} route updated`,
          body: describeLineChange(changes),
          data: { kind: "route-updated", busId, url: "/" },
        }
      );
    }

    if (students.length === 0) return;

    // Everyone on the bus, not just the students at a changed stop: a
    // reordered or renamed route changes the journey for all of them.
    if (changes.lineChanged) {
      sendPushSafe(
        { role: "students", ids: students.map((s) => s._id) },
        {
          title: `Bus ${busNumber} route updated`,
          body: describeLineChange(changes),
          data: { kind: "route-updated", busId, url: "/" },
        }
      );
    }

    if (changes.noticeChanged) {
      sendPushSafe(
        { role: "students", ids: students.map((s) => s._id) },
        {
          title: `Bus ${busNumber} — route notice`,
          body: changes.notice ? changes.notice : "The route notice has been cleared.",
          data: { kind: "notice", busId, url: "/" },
        }
      );
    }

    for (const stop of changes.newlySuspended) {
      const affected = students.filter((s) => s.stop === stop).map((s) => s._id);
      if (affected.length === 0) continue;
      const temp = changes.tempByStop.get(stop) ?? null;
      const body = temp
        ? `${stop} is temporarily suspended on bus ${busNumber}. Board at "${temp}" instead.`
        : `Your stop on bus ${busNumber} is temporarily suspended. Check the app for the nearest open stop.`;
      sendPushSafe(
        { role: "students", ids: affected },
        {
          title: `${stop} suspended`,
          body,
          data: {
            kind: "stop-suspended",
            busId,
            stop,
            temporaryReplacement: temp ?? "",
            url: "/",
          },
        }
      );
    }

    for (const stop of changes.newlyResumed) {
      const affected = students.filter((s) => s.stop === stop).map((s) => s._id);
      if (affected.length === 0) continue;
      sendPushSafe(
        { role: "students", ids: affected },
        {
          title: `${stop} resumed`,
          body: `Your stop on bus ${busNumber} is back in service.`,
          data: { kind: "stop-resumed", busId, stop, url: "/" },
        }
      );
    }

    for (const stop of changes.removedStops) {
      // These students were just un-assigned by the cascade above, but they're
      // still on this bus document until the next refresh — the lean() snapshot
      // captured the old stop name, which is what we want.
      const affected = students.filter((s) => s.stop === stop).map((s) => s._id);
      if (affected.length === 0) continue;
      sendPushSafe(
        { role: "students", ids: affected },
        {
          title: `${stop} removed`,
          body: `Your stop has been removed from bus ${busNumber}'s route. Please contact the admin to pick a new stop.`,
          data: { kind: "stop-removed", busId, stop, url: "/" },
        }
      );
    }
  })().catch((err) => console.error("[fcm] notifyBusUpdate failed:", err));
}

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
