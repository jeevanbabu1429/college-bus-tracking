import { Router } from "express";
import { createHash } from "node:crypto";
import { isValidObjectId, Types } from "mongoose";
import { requireAppUser } from "../lib/appUser.js";
import { deleteImage, parseImageField, readImage, storeImage } from "../lib/images.js";
import {
  parseCategory,
  parseDiagnostics,
  parseMessage,
  publicComplaint,
} from "../lib/complaints.js";
import { ComplaintModel } from "../models/Complaint.js";

// Support channel for the mobile app. Open to every signed-in role; the
// super admin console reads the other end via /api/super/complaints.
const router = Router();

router.use(requireAppUser);

// Enough to stop one frustrated user (or a loop in a client) from filling the
// collection, without being so tight that a real burst of reports about a real
// outage gets swallowed.
const MAX_OPEN_PER_REPORTER = 20;

router.post("/", async (req, res) => {
  const user = req.appUser!;
  const { category, message, screenshot, diagnostics } = req.body ?? {};

  const parsedCategory = parseCategory(category);
  if (!parsedCategory) {
    res.status(400).json({ error: "Please choose what the problem is about." });
    return;
  }

  const parsedMessage = parseMessage(message);
  if (!parsedMessage.ok) {
    res.status(400).json({ error: parsedMessage.error });
    return;
  }

  // Three-state parser, shared with the driver-photo routes. Here only
  // "unchanged" (absent) and "set" matter — there is nothing to clear yet.
  const image = parseImageField(screenshot);
  if (!image.ok) {
    res.status(400).json({ error: image.error });
    return;
  }

  const openCount = await ComplaintModel.countDocuments({
    "reporter.id": user.id,
    status: { $ne: "resolved" },
  });
  if (openCount >= MAX_OPEN_PER_REPORTER) {
    res.status(429).json({
      error:
        "You already have several complaints open. Please wait for a reply before sending more.",
    });
    return;
  }

  // Minted first so the screenshot is filed under the complaint it belongs to.
  const complaintId = new Types.ObjectId();
  const storedScreenshot =
    image.kind === "set" && image.value
      ? await storeImage(image.value, `complaints/${complaintId}`)
      : null;

  let complaint;
  try {
    complaint = await ComplaintModel.create({
      _id: complaintId,
      reporter: {
        role: user.role,
        id: user.id,
        name: user.name,
        mobile: user.mobile,
      },
      college: user.college,
      category: parsedCategory,
      message: parsedMessage.value,
      screenshot: storedScreenshot,
      hasScreenshot: Boolean(storedScreenshot),
      diagnostics: parseDiagnostics(diagnostics),
    });
  } catch (err) {
    // Uploaded, but the complaint never saved — don't strand the object.
    await deleteImage(storedScreenshot);
    throw err;
  }

  res.status(201).json(publicComplaint(complaint.toObject()));
});

router.get("/mine", async (req, res) => {
  const user = req.appUser!;
  const complaints = await ComplaintModel.find({ "reporter.id": user.id })
    .select("-screenshot")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(complaints.map(publicComplaint));
});

// Served as a real image response rather than inlined into JSON, and scoped to
// the reporter's own complaint — see routes/driverPhoto.ts for the same shape.
router.get("/:id/screenshot", async (req, res) => {
  const user = req.appUser!;
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid complaint id" });
    return;
  }

  const complaint = await ComplaintModel.findOne({
    _id: id,
    "reporter.id": user.id,
  })
    .select("screenshot")
    .lean();
  if (!complaint?.screenshot) {
    res.status(404).json({ error: "No screenshot on this complaint" });
    return;
  }

  const decoded = await readImage(complaint.screenshot);
  if (!decoded) {
    res.status(404).json({ error: "No screenshot on this complaint" });
    return;
  }

  // A complaint's screenshot never changes once sent, so this ETag is stable
  // for the life of the row.
  const etag = `"${createHash("sha1").update(decoded.buffer).digest("hex")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
  res.setHeader("Content-Type", decoded.contentType);

  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.send(decoded.buffer);
});

export default router;
