import "./lib/asyncErrors.js";
import express, { type Express } from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import driverAuthRouter from "./routes/driverAuth.js";
import studentAuthRouter from "./routes/studentAuth.js";
import driverTripRouter from "./routes/driverTrip.js";
import collegesRouter from "./routes/colleges.js";
import collegeBusesRouter from "./routes/collegeBuses.js";
import collegeDriversRouter from "./routes/collegeDrivers.js";
import collegeStudentsRouter from "./routes/collegeStudents.js";
import collegeNotificationsRouter from "./routes/collegeNotifications.js";
import {
  collegeRolesRouter,
  collegeStaffRouter,
} from "./routes/collegeAccess.js";
import staffAuthRouter from "./routes/staffAuth.js";
import notificationsRouter from "./routes/notifications.js";
import superAdminRouter from "./routes/superAdmin.js";
import loginRolesRouter from "./routes/loginRoles.js";
import bannerRouter from "./routes/banner.js";
import complaintsRouter from "./routes/complaints.js";
import { fileStorageRoute } from "./fileStorage/fileRoute/fileStorageRoute.js";
import driverPhotoRouter from "./routes/driverPhoto.js";
import { errorHandler, notFoundHandler } from "./lib/httpErrors.js";

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
  app.use("/api/staff-auth", staffAuthRouter);
  app.use("/api/driver/trip", driverTripRouter);
  app.use("/api/colleges", collegesRouter);
  app.use("/api/colleges/:collegeId/buses", collegeBusesRouter);
  app.use("/api/colleges/:collegeId/drivers", collegeDriversRouter);
  app.use("/api/colleges/:collegeId/students", collegeStudentsRouter);
  // Mounted after collegesRouter like its siblings, so it inherits that
  // router's requireAdmin and its pending-college gate by fall-through.
  app.use("/api/colleges/:collegeId/notifications", collegeNotificationsRouter);
  app.use("/api/colleges/:collegeId/roles", collegeRolesRouter);
  app.use("/api/colleges/:collegeId/staff", collegeStaffRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/super", superAdminRouter);
  app.use("/api/banner", bannerRouter);
  app.use("/api/complaints", complaintsRouter);
  // Uploaded images, when they are kept on this server's disk rather than in
  // S3. Outside /api on purpose: these are plain static files, as in kareez.
  if (process.env.STORAGE_DRIVER !== "s3" && process.env.IMAGE_SERVER_PATH) {
    app.use("/images", fileStorageRoute());
  }
  app.use("/api/login-roles", loginRolesRouter);
  app.use("/api/drivers", driverPhotoRouter);

  // Anything unmatched, and every error, answers in JSON the clients can show.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
