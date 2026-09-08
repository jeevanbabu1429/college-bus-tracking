import { Router } from "express";
import { ALL_ROLES_ENABLED, readLoginRoles } from "../models/LoginRoles.js";

// Public sign-in-roles endpoint — no auth, same posture as /api/banner. The
// mobile app hits this before its login screen renders, which is necessarily
// before anyone has identified themselves.
const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await readLoginRoles());
  } catch (err) {
    // Fail open. A database blip must not leave every user staring at a
    // sign-in screen with no way in — far worse than briefly showing a role
    // the super admin had switched off.
    console.error("[login-roles] read failed, defaulting to all enabled:", err);
    res.json(ALL_ROLES_ENABLED);
  }
});

export default router;
