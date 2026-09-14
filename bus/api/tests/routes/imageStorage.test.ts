import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  buildApp,
  clearDb,
  startTestDb,
  stopTestDb,
} from "../helpers/testEnv.js";
import { AdminModel } from "../../src/models/Admin.js";
import { BannerModel } from "../../src/models/Banner.js";
import { CollegeModel } from "../../src/models/College.js";
import { ComplaintModel } from "../../src/models/Complaint.js";
import { DriverModel } from "../../src/models/Driver.js";
import { StudentModel } from "../../src/models/Student.js";
import { SuperAdminModel } from "../../src/models/SuperAdmin.js";

const PHOTO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const OTHER_PHOTO =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// testEnv.ts points the local-disk provider at a throwaway folder, so these
// assertions look at real files the way they would land on the server.
const root = () => process.env.IMAGE_SERVER_PATH as string;
const BASE = "http://localhost/images";

function exists(stored: string): boolean {
  return fs.existsSync(path.join(root(), stored));
}

function fileCount(): number {
  if (!fs.existsSync(root())) return 0;
  return (fs.readdirSync(root(), { recursive: true }) as string[]).filter((f) =>
    fs.statSync(path.join(root(), f)).isFile()
  ).length;
}

function sign(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

let seq = 0;

async function seed() {
  seq += 1;
  const admin = await AdminModel.create({
    adminId: `AD${900 + seq}`,
    name: "Owner",
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: `90000009${String(seq).padStart(2, "0")}`,
    email: `owner${seq}@example.com`,
    approved: true,
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: "Test College",
    address: "123 Road",
    code: `IS${seq}`,
    busCount: 1,
    driverCount: 1,
  });
  const su = await SuperAdminModel.create({
    email: `super${seq}@example.com`,
    passwordHash: "x",
  });
  return {
    admin,
    college,
    adminToken: sign({ adminId: admin.adminId, sub: admin.id }),
    superToken: sign({ role: "super", sub: su.id }),
  };
}

function driverBody(n: number) {
  return {
    name: `Driver ${n}`,
    dob: "1980-01-01",
    gender: "male",
    licenceNumber: `LICIS${n}`,
    aadharNumber: `5555${String(n).padStart(8, "0")}`,
    mobile: `98000000${String(n).padStart(2, "0")}`,
    address: "Depot",
  };
}

describe("image storage (local-disk provider)", () => {
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
    fs.rmSync(root(), { recursive: true, force: true });
    fs.mkdirSync(root(), { recursive: true });
  });

  describe("driver photos, admin console", () => {
    it("stores a path in MongoDB, the file on disk, and returns a URL that loads", async () => {
      const { college, adminToken } = await seed();

      const res = await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(1), image: PHOTO });
      assert.equal(res.status, 201, JSON.stringify(res.body));

      const stored = await DriverModel.findById(res.body._id).lean();
      const key = stored?.image as string;
      // Filed under the college and the driver it belongs to.
      assert.match(key, new RegExp(`^drivers/${college._id}/${res.body._id}/.+\\.gif$`));
      assert.ok(exists(key));
      assert.equal(res.body.image, `${BASE}/${key}`);

      const list = await request(app)
        .get(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(list.body[0].image, `${BASE}/${key}`);

      // The URL actually loads: /images serves it with no auth header.
      const served = await request(app).get(`/images/${key}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers["content-type"], "image/gif");
    });

    it("does not serve anything outside the image folder", async () => {
      const res = await request(app).get("/images/..%2f..%2fetc%2fpasswd");
      assert.notEqual(res.status, 200);
    });

    it("serves the bytes from the photo route with an ETag", async () => {
      const { college, adminToken } = await seed();
      const created = await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(2), image: PHOTO });

      const img = await request(app)
        .get(`/api/drivers/${created.body._id}/photo`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(img.status, 200);
      assert.equal(img.headers["content-type"], "image/gif");
      assert.ok(img.headers.etag);
      assert.deepEqual(
        Buffer.from(img.body),
        Buffer.from(PHOTO.split(",")[1], "base64")
      );
    });

    it("deletes the old file when the photo is replaced, and when it is cleared", async () => {
      const { college, adminToken } = await seed();
      const created = await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(3), image: PHOTO });
      const firstKey = (await DriverModel.findById(created.body._id).lean())?.image as string;

      await request(app)
        .put(`/api/colleges/${college._id}/drivers/${created.body._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(3), image: OTHER_PHOTO });
      const secondKey = (await DriverModel.findById(created.body._id).lean())?.image as string;
      assert.notEqual(secondKey, firstKey);
      assert.equal(exists(firstKey), false);
      assert.equal(exists(secondKey), true);

      await request(app)
        .put(`/api/colleges/${college._id}/drivers/${created.body._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(3), image: null });
      assert.equal((await DriverModel.findById(created.body._id).lean())?.image, null);
      assert.equal(fileCount(), 0);
    });

    it("treats the URL it handed out as unchanged when a form posts it back", async () => {
      const { college, adminToken } = await seed();
      const created = await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(4), image: PHOTO });
      const key = (await DriverModel.findById(created.body._id).lean())?.image;

      const res = await request(app)
        .put(`/api/colleges/${college._id}/drivers/${created.body._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(4), name: "Renamed", image: created.body.image });
      assert.equal(res.status, 200);

      assert.equal((await DriverModel.findById(created.body._id).lean())?.image, key);
      assert.equal(fileCount(), 1);
    });

    it("does not leave an uploaded photo behind when the driver fails to save", async () => {
      const { college, adminToken } = await seed();
      await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(5), image: PHOTO });
      assert.equal(fileCount(), 1);

      // Same licence and mobile: a duplicate-key failure after the upload.
      const dup = await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(5), image: OTHER_PHOTO });
      assert.equal(dup.status, 409);
      assert.equal(fileCount(), 1);
    });

    it("still serves a legacy base64 photo written before storage moved", async () => {
      const { college, adminToken } = await seed();
      const legacy = await DriverModel.create({
        ...driverBody(6),
        dob: new Date("1980-01-01"),
        college: college._id,
        image: PHOTO,
      });

      const list = await request(app)
        .get(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(list.body[0].image, PHOTO);

      const img = await request(app)
        .get(`/api/drivers/${legacy.id}/photo`)
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(img.status, 200);
      assert.equal(img.headers["content-type"], "image/gif");

      // Replacing it uploads the new one and has nothing in storage to delete.
      await request(app)
        .put(`/api/colleges/${college._id}/drivers/${legacy.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(6), image: OTHER_PHOTO });
      const stored = (await DriverModel.findById(legacy.id).lean())?.image as string;
      assert.match(stored, /^drivers\//);
      assert.equal(fileCount(), 1);
    });

    it("removes driver photos from storage when the college is deleted", async () => {
      const { college, adminToken, superToken } = await seed();
      await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(7), image: PHOTO });
      await request(app)
        .post(`/api/colleges/${college._id}/drivers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...driverBody(8), image: OTHER_PHOTO });
      assert.equal(fileCount(), 2);

      const res = await request(app)
        // The route makes you type the college code back as a safeguard.
        .delete(`/api/super/colleges/${college._id}?confirm=${college.code}`)
        .set("Authorization", `Bearer ${superToken}`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(fileCount(), 0);
    });
  });

  describe("driver self-service photo", () => {
    it("stores, returns a URL, and replaces cleanly", async () => {
      const { college } = await seed();
      const driver = await DriverModel.create({
        ...driverBody(9),
        dob: new Date("1980-01-01"),
        college: college._id,
      });
      const token = sign({ role: "driver", sub: driver.id });

      const set = await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: PHOTO });
      assert.equal(set.status, 200);
      const firstKey = (await DriverModel.findById(driver.id).lean())?.image as string;
      assert.match(firstKey, new RegExp(`^drivers/${college._id}/${driver.id}/`));
      assert.equal(set.body.image, `${BASE}/${firstKey}`);

      const me = await request(app)
        .get("/api/driver-auth/me")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(me.body.image, `${BASE}/${firstKey}`);

      await request(app)
        .put("/api/driver-auth/me/photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: OTHER_PHOTO });
      assert.equal(exists(firstKey), false);
      assert.equal(fileCount(), 1);
    });
  });

  describe("complaint screenshots", () => {
    it("stores under the complaint, serves it to the owner, gives the console a URL, deletes with it", async () => {
      const { college, superToken } = await seed();
      const student = await StudentModel.create({
        college: college._id,
        name: "Student",
        rollNumber: "R1",
        gender: "female",
        dob: new Date("2005-01-01"),
        address: "Hostel",
        mobile: "9700000001",
      });
      const token = sign({ role: "student", sub: student.id });

      const created = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${token}`)
        .send({ category: "bug", message: "map is blank", screenshot: PHOTO });
      assert.equal(created.status, 201, JSON.stringify(created.body));

      const key = (await ComplaintModel.findById(created.body._id).lean())?.screenshot as string;
      assert.match(key, new RegExp(`^complaints/${created.body._id}/`));
      assert.ok(exists(key));

      const img = await request(app)
        .get(`/api/complaints/${created.body._id}/screenshot`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(img.status, 200);
      assert.equal(img.headers["content-type"], "image/gif");

      const detail = await request(app)
        .get(`/api/super/complaints/${created.body._id}`)
        .set("Authorization", `Bearer ${superToken}`);
      assert.equal(detail.body.screenshot, `${BASE}/${key}`);

      await request(app)
        .delete(`/api/super/complaints/${created.body._id}`)
        .set("Authorization", `Bearer ${superToken}`);
      assert.equal(fileCount(), 0);
    });
  });

  describe("banner", () => {
    it("stores the poster, serves a URL publicly, and cleans up on replace and delete", async () => {
      const { superToken } = await seed();

      const put = await request(app)
        .put("/api/super/banner")
        .set("Authorization", `Bearer ${superToken}`)
        .send({ imageDataUrl: PHOTO });
      assert.equal(put.status, 200, JSON.stringify(put.body));

      const firstKey = (await BannerModel.findOne().lean())?.imageDataUrl as string;
      assert.match(firstKey, /^banner\//);
      assert.equal(put.body.imageDataUrl, `${BASE}/${firstKey}`);

      const pub = await request(app).get("/api/banner");
      assert.equal(pub.body.imageDataUrl, `${BASE}/${firstKey}`);

      await request(app)
        .put("/api/super/banner")
        .set("Authorization", `Bearer ${superToken}`)
        .send({ imageDataUrl: OTHER_PHOTO });
      assert.equal(exists(firstKey), false);
      assert.equal(fileCount(), 1);

      await request(app)
        .delete("/api/super/banner")
        .set("Authorization", `Bearer ${superToken}`);
      assert.equal(fileCount(), 0);
    });

    it("rejects a data URL that is not an image", async () => {
      const { superToken } = await seed();
      const res = await request(app)
        .put("/api/super/banner")
        .set("Authorization", `Bearer ${superToken}`)
        .send({ imageDataUrl: "data:text/html;base64,PHNjcmlwdD4=" });
      assert.equal(res.status, 400);
      assert.equal(fileCount(), 0);
    });
  });
});
