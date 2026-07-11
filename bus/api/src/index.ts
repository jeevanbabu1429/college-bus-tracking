import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { connectDB } from "./db.js";
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
import { getFirebaseApp } from "./services/firebase.js";
import { seedSuperAdmin } from "./seed.js";

const app = express();
app.use(cors());
// Bumped from the default 100 KB so the super admin can upload banner
// posters up to ~7 MB after base64 inflation.
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

const port = Number(process.env.PORT ?? 4000);
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bus";

connectDB(uri)
  .then(async () => {
    getFirebaseApp();
    await seedSuperAdmin();
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
