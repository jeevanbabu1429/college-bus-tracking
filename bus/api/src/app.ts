import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import driverAuthRouter from "./routes/driverAuth.js";
import studentAuthRouter from "./routes/studentAuth.js";
import driverTripRouter from "./routes/driverTrip.js";
import collegesRouter from "./routes/colleges.js";
import collegeBusesRouter from "./routes/collegeBuses.js";
import collegeDriversRouter from "./routes/collegeDrivers.js";
import collegeStudentsRouter from "./routes/collegeStudents.js";
import notificationsRouter from "./routes/notifications.js";
import superAdminRouter from "./routes/superAdmin.js";
import bannerRouter from "./routes/banner.js";

// Pure app factory — no DB connect, no listen. `index.ts` wires
// connectDB + seed + listen around it; the test suite imports it
// directly against an in-memory Mongo instance.
export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/driver-auth", driverAuthRouter);
  app.use("/api/student-auth", studentAuthRouter);
  app.use("/api/driver/trip", driverTripRouter);
  app.use("/api/colleges", collegesRouter);
  app.use("/api/colleges/:collegeId/buses", collegeBusesRouter);
  app.use("/api/colleges/:collegeId/drivers", collegeDriversRouter);
  app.use("/api/colleges/:collegeId/students", collegeStudentsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/super", superAdminRouter);
  app.use("/api/banner", bannerRouter);

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    const status = typeof err?.status === "number" ? err.status : 500;
    res.status(status).json({ error: err?.message ?? "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
