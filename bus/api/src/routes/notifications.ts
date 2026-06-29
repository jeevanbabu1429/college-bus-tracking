import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { AdminModel } from "../models/Admin.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { sendPush } from "../services/notifications.js";
import { isFirebaseReady } from "../services/firebase.js";

const router = Router();

type CallerRole = "admin" | "driver" | "student";
type Caller = { role: CallerRole; sub: string };

// Accept any of the three role tokens. Admin tokens don't carry an explicit
// `role` claim — they carry `adminId` — so we infer admin from that.
const requireAnyAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  let payload: { role?: string; adminId?: string; sub?: string };
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");
    payload = jwt.verify(token, secret) as typeof payload;
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!payload.sub || !isValidObjectId(payload.sub)) {
    res.status(401).json({ error: "Invalid token subject" });
    return;
  }
  const role: CallerRole | null =
    payload.role === "driver"
      ? "driver"
      : payload.role === "student"
      ? "student"
      : payload.adminId
      ? "admin"
      : null;
  if (!role) {
    res.status(401).json({ error: "Unknown token role" });
    return;
  }
  (req as unknown as { caller: Caller }).caller = { role, sub: payload.sub };
  next();
};

router.use(requireAnyAuth);

function modelFor(role: CallerRole) {
  return role === "admin" ? AdminModel : role === "driver" ? DriverModel : StudentModel;
}

router.post("/register-token", async (req, res) => {
  const caller = (req as unknown as { caller: Caller }).caller;
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  const Model = modelFor(caller.role);
  // $addToSet ensures the same device token is never stored twice. We don't
  // try to clear it from other accounts here — that would require a global
  // sweep across three collections and the dead-token pruning on send is
  // enough to keep things tidy.
  await (Model as typeof AdminModel).findByIdAndUpdate(caller.sub, {
    $addToSet: { fcmTokens: token.trim() },
  });
  res.json({ ok: true, fcmReady: isFirebaseReady() });
});

router.post("/unregister-token", async (req, res) => {
  const caller = (req as unknown as { caller: Caller }).caller;
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  const Model = modelFor(caller.role);
  await (Model as typeof AdminModel).findByIdAndUpdate(caller.sub, {
    $pull: { fcmTokens: token.trim() },
  });
  res.json({ ok: true });
});

// Useful while wiring things up — lets the logged-in user push a test
// notification to their own devices to confirm the round trip works.
router.post("/test", async (req, res) => {
  const caller = (req as unknown as { caller: Caller }).caller;
  const { title, body } = req.body ?? {};
  const sent = await sendPush(
    { role: caller.role, id: caller.sub },
    {
      title: typeof title === "string" && title ? title : "Test notification",
      body:
        typeof body === "string" && body
          ? body
          : "If you can read this, FCM is wired up end-to-end.",
      data: { kind: "test" },
    }
  );
  res.json({ ok: true, delivered: sent });
});

export default router;
