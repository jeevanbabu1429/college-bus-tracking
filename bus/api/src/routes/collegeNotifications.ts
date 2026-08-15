import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { CollegeModel } from "../models/College.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { isPushConfigured, sendPush } from "../services/notifications.js";

const router = Router({ mergeParams: true });

export const TITLE_MAX = 80;
export const BODY_MAX = 300;

const AUDIENCES = new Set(["students", "drivers", "both"]);
type AudienceChoice = "students" | "drivers" | "both";

type Reach = { total: number; withDevice: number };

// "withDevice" is the number that will actually get the alert. Someone who has
// never opened the app has no token, and the difference between the two counts
// is the only honest way to tell an admin their message reached 38 of 42
// students without them concluding the feature is broken.
async function reachFor(collegeId: string): Promise<{
  students: Reach;
  drivers: Reach;
}> {
  const [
    studentsTotal,
    studentsWithDevice,
    driversTotal,
    driversWithDevice,
  ] = await Promise.all([
    StudentModel.countDocuments({ college: collegeId }),
    StudentModel.countDocuments({
      college: collegeId,
      "fcmTokens.0": { $exists: true },
    }),
    DriverModel.countDocuments({ college: collegeId }),
    DriverModel.countDocuments({
      college: collegeId,
      "fcmTokens.0": { $exists: true },
    }),
  ]);
  return {
    students: { total: studentsTotal, withDevice: studentsWithDevice },
    drivers: { total: driversTotal, withDevice: driversWithDevice },
  };
}

// Lets the compose form show the size of the blast before the admin commits to
// it, and surfaces a server with no Firebase credentials before they type a
// message they can't send.
router.get("/audience", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }
  const college = await CollegeModel.findById(collegeId).select("_id").lean();
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }
  res.json({ ...(await reachFor(collegeId)), pushConfigured: isPushConfigured() });
});

router.post("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  if (!isValidObjectId(collegeId)) {
    res.status(400).json({ error: "Invalid college id" });
    return;
  }

  const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const rawBody = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const audience = req.body?.audience as AudienceChoice | undefined;

  if (!rawTitle) {
    res.status(400).json({ error: "A title is required" });
    return;
  }
  if (rawTitle.length > TITLE_MAX) {
    res.status(400).json({ error: `Title must be ${TITLE_MAX} characters or fewer` });
    return;
  }
  if (!rawBody) {
    res.status(400).json({ error: "A message is required" });
    return;
  }
  if (rawBody.length > BODY_MAX) {
    res.status(400).json({ error: `Message must be ${BODY_MAX} characters or fewer` });
    return;
  }
  if (!audience || !AUDIENCES.has(audience)) {
    res.status(400).json({ error: "audience must be students, drivers or both" });
    return;
  }

  const college = await CollegeModel.findById(collegeId).select("name").lean();
  if (!college) {
    res.status(404).json({ error: "College not found" });
    return;
  }

  const reach = await reachFor(collegeId);
  const targeted = {
    students: audience === "drivers" ? { total: 0, withDevice: 0 } : reach.students,
    drivers: audience === "students" ? { total: 0, withDevice: 0 } : reach.drivers,
  };

  if (targeted.students.withDevice + targeted.drivers.withDevice === 0) {
    res.status(400).json({
      error:
        "Nobody in that group has opened the app on a phone yet, so there is no device to notify.",
    });
    return;
  }

  // Ordered after the audience check on purpose. Both conditions produce a
  // send of zero, but only one of them is the admin's to fix — telling someone
  // whose drivers have never signed in that the *server* is misconfigured
  // sends them chasing the wrong thing.
  if (!isPushConfigured()) {
    res.status(503).json({
      error:
        "Push notifications are not configured on this server. Set the Firebase credentials and try again.",
    });
    return;
  }

  // Awaited, unlike every other push in the codebase. Those are side effects of
  // some other action; this one IS the action, so the admin has to be told
  // whether it landed.
  let devices = 0;
  try {
    devices = await sendPush(
      { role: "college", collegeId, to: audience },
      {
        title: rawTitle,
        body: rawBody,
        data: { kind: "admin-announcement", collegeId, url: "/" },
      }
    );
  } catch (err) {
    console.error("[fcm] admin announcement failed:", err);
    res.status(502).json({ error: "The notification service rejected the send" });
    return;
  }

  res.status(201).json({ ok: true, devices, sentTo: targeted });
});

export default router;
