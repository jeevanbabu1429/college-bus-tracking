import { Router } from "express";
import { readAppVersions } from "../models/AppVersions.js";
import { updateAction } from "../lib/appVersion.js";

// Public update check — no auth, same posture as /api/banner and
// /api/login-roles. The app asks this the moment it opens, which is before
// anyone has signed in.
//
//   GET /api/app-version?platform=android&version=1.0.4
//   -> { action: "optional", latest: "1.0.5", minimum: "1.0.3" }
const router = Router();

router.get("/", async (req, res) => {
  const platform = String(req.query.platform ?? "").toLowerCase();
  const version = String(req.query.version ?? "");
  try {
    const versions = await readAppVersions();
    const latest =
      platform === "ios" ? versions.iosLatest : versions.androidLatest;
    const minimum =
      platform === "ios" ? versions.iosMinimum : versions.androidMinimum;
    // An unknown platform gets no answer rather than Android's, so a future
    // client is never blocked by a setting that was not meant for it.
    if (platform !== "ios" && platform !== "android") {
      res.json({ action: "none", latest: "", minimum: "" });
      return;
    }
    res.json({ action: updateAction(version, latest, minimum), latest, minimum });
  } catch (err) {
    // Fail open. A database blip must never put a "you must update" wall in
    // front of every user of the app.
    console.error("[app-version] check failed, allowing the app through:", err);
    res.json({ action: "none", latest: "", minimum: "" });
  }
});

export default router;
