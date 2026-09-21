import { Router } from "express";
import { DEFAULT_APP_SETTINGS, readAppSettings } from "../models/AppSettings.js";

// Public app settings — no auth, same posture as /api/banner and
// /api/login-roles. The app reads this when it opens, before anyone has
// signed in.
const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await readAppSettings());
  } catch (err) {
    // Fail open: the server refuses a deletion it has switched off anyway, so
    // the worst case is a row that explains itself when tapped.
    console.error("[app-settings] read failed, using defaults:", err);
    res.json(DEFAULT_APP_SETTINGS);
  }
});

export default router;
