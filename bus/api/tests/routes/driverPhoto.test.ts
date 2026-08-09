import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import {
  buildApp,
  clearDb,
  startTestDb,
  stopTestDb,
} from "../helpers/testEnv.js";
import { AdminModel } from "../../src/models/Admin.js";
import { CollegeModel } from "../../src/models/College.js";
import { DriverModel } from "../../src/models/Driver.js";

// 1x1 GIFs — the smallest thing that satisfies the data URL validator, so
// these tests assert on plumbing rather than on image content.
const PHOTO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const OTHER_PHOTO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Every /api/colleges/* path is gated by the blanket `router.use(requireAdmin)`
// inside collegesRouter — it is mounted on the "/api/colleges" prefix, so it
// runs before Express reaches the more specific sub-routers.
function adminToken(adminId: string, sub: string): string {
  return jwt.sign({ adminId, sub }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}

function driverToken(driverId: string): string {
  return jwt.sign(
    { role: "driver", sub: driverId },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

async function seedDriver() {
  const admin = await AdminModel.create({
    adminId: "AD001",
    name: "Owner",
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: "9000000010",
    email: "owner@example.com",
    // Approved, so these tests exercise the photo rules rather than the
    // separate new-admin verification gate.
    approved: true,
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: "Test College",
    address: "123 Road",
    code: "TC1",
    busCount: 1,
    driverCount: 1,
  });
  const driver = await DriverModel.create({
    college: college._id,
    name: "Driver Dan",
    dob: new Date("1980-01-01"),
    gender: "male",
    licenceNumber: "LIC001",
    aadharNumber: "123412341234",
    mobile: "9000000020",
    address: "Depot",
  });
  return { college, driver, token: adminToken(admin.adminId, admin.id) };
}

const driverBody = {
  name: "Driver Dan",
  dob: "1980-01-01",
  gender: "male",
  licenceNumber: "LIC001",
  aadharNumber: "123412341234",
  mobile: "9000000020",
  address: "Depot",
};

describe("driver profile photo", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await clearDb();
  });

  describe("admin edit preserves the photo", () => {
    it("keeps an existing photo when the update omits image", async () => {
      const { college, driver, token } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });

      // Exactly what the mobile admin edit screen sends — no image key at
      // all. This used to silently wipe a photo uploaded from the website.
      const res = await request(app)
        .put(`/api/colleges/${college._id}/drivers/${driver._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(driverBody);

      assert.equal(res.status, 200);
      const updated = await DriverModel.findById(driver._id).lean();
      assert.equal(updated?.image, PHOTO);
    });

    it("clears the photo when image is explicitly null", async () => {
      const { college, driver, token } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });

      const res = await request(app)
        .put(`/api/colleges/${college._id}/drivers/${driver._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...driverBody, image: null });

      assert.equal(res.status, 200);
      const updated = await DriverModel.findById(driver._id).lean();
      assert.equal(updated?.image, null);
    });

    it("replaces the photo when a new data URL is sent", async () => {
      const { college, driver, token } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });

      const res = await request(app)
        .put(`/api/colleges/${college._id}/drivers/${driver._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...driverBody, image: OTHER_PHOTO });

      assert.equal(res.status, 200);
      const updated = await DriverModel.findById(driver._id).lean();
      assert.equal(updated?.image, OTHER_PHOTO);
    });

    it("rejects a non-data-URL string", async () => {
      const { college, driver, token } = await seedDriver();
      const res = await request(app)
        .put(`/api/colleges/${college._id}/drivers/${driver._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...driverBody, image: "https://example.com/photo.jpg" });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /data URL/);
    });
  });

  describe("driver self-service", () => {
    it("sets and then clears its own photo", async () => {
      const { driver } = await seedDriver();
      const token = driverToken(driver.id);

      const set = await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: PHOTO });
      assert.equal(set.status, 200);
      assert.equal(set.body.image, PHOTO);

      const cleared = await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: null });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.image, null);
    });

    it("rejects a missing image field rather than silently doing nothing", async () => {
      const { driver } = await seedDriver();
      const res = await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${driverToken(driver.id)}`)
        .send({});
      assert.equal(res.status, 400);
    });

    it("requires a driver token", async () => {
      await seedDriver();
      const res = await request(app)
        .put("/api/driver-auth/me/photo")
        .send({ image: PHOTO });
      assert.equal(res.status, 401);
    });

    it("returns the photo on GET /me but never in the login payload", async () => {
      const { driver } = await seedDriver();
      const token = driverToken(driver.id);
      await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: PHOTO });

      const me = await request(app)
        .get("/api/driver-auth/me")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(me.status, 200);
      assert.equal(me.body.image, PHOTO);

      // The login response is persisted to SecureStore, so it must stay small.
      await request(app)
        .post("/api/driver-auth/request-otp")
        .send({ mobile: "9000000020" });
      const login = await request(app)
        .post("/api/driver-auth/verify-otp")
        .send({ mobile: "9000000020", otp: "0000" });
      assert.equal(login.status, 200);
      assert.equal(login.body.driver.image, undefined);
    });
  });

  describe("GET /api/drivers/:id/photo", () => {
    it("serves the decoded bytes with an ETag", async () => {
      const { driver } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });

      const res = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${driverToken(driver.id)}`);

      assert.equal(res.status, 200);
      assert.equal(res.headers["content-type"], "image/gif");
      assert.ok(res.headers.etag);
      assert.ok(res.body.length > 0);
    });

    it("answers 304 when the client already has that exact photo", async () => {
      const { driver } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });
      const token = driverToken(driver.id);

      const first = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${token}`);

      const second = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${token}`)
        .set("If-None-Match", first.headers.etag);

      assert.equal(second.status, 304);
    });

    it("changes the ETag when the photo changes", async () => {
      const { driver } = await seedDriver();
      const token = driverToken(driver.id);

      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });
      const first = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${token}`);

      await DriverModel.findByIdAndUpdate(driver._id, { image: OTHER_PHOTO });
      const second = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${token}`);

      assert.notEqual(first.headers.etag, second.headers.etag);
    });

    it("404s when the driver has no photo", async () => {
      const { driver } = await seedDriver();
      const res = await request(app)
        .get(`/api/drivers/${driver._id}/photo`)
        .set("Authorization", `Bearer ${driverToken(driver.id)}`);
      assert.equal(res.status, 404);
    });

    it("401s without a token", async () => {
      const { driver } = await seedDriver();
      await DriverModel.findByIdAndUpdate(driver._id, { image: PHOTO });
      const res = await request(app).get(`/api/drivers/${driver._id}/photo`);
      assert.equal(res.status, 401);
    });
  });
});
