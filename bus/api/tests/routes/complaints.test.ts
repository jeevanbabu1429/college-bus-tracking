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
import { StudentModel } from "../../src/models/Student.js";
import { StaffModel } from "../../src/models/Staff.js";
import { RoleModel } from "../../src/models/Role.js";
import { SuperAdminModel } from "../../src/models/SuperAdmin.js";
import { ComplaintModel } from "../../src/models/Complaint.js";
import { MAX_IMAGE_CHARS } from "../../src/lib/images.js";

let app: Express;
let seq = 0;

function sign(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

// A 1x1 transparent PNG — the smallest thing parseImageField will accept.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function seedEveryRole() {
  seq += 1;
  const admin = await AdminModel.create({
    adminId: `AD10${seq}`,
    name: `Owner ${seq}`,
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: `911000000${seq}`,
    email: `owner${seq}@example.com`,
    approved: true,
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: `College ${seq}`,
    address: "123 Road",
    code: `C${seq}`,
    busCount: 1,
    driverCount: 1,
  });
  const driver = await DriverModel.create({
    college: college._id,
    name: `Driver ${seq}`,
    dob: new Date("1980-01-01"),
    gender: "male",
    licenceNumber: `LICX0${seq}`,
    aadharNumber: `${10000000000 + seq}1`,
    mobile: `912000000${seq}`,
    address: "1 Depot Road",
  });
  const student = await StudentModel.create({
    college: college._id,
    name: `Student ${seq}`,
    rollNumber: `R${seq}`,
    gender: "female",
    dob: new Date("2005-01-01"),
    address: "9 Hostel Lane",
    mobile: `913000000${seq}`,
  });
  const role = await RoleModel.create({
    college: college._id,
    name: `Dispatcher ${seq}`,
    permissions: [],
  });
  const staff = await StaffModel.create({
    college: college._id,
    role: role._id,
    name: `Staff ${seq}`,
    mobile: `914000000${seq}`,
  });

  return {
    college,
    admin,
    driver,
    student,
    staff,
    tokens: {
      admin: sign({ adminId: admin.adminId, sub: admin.id }),
      driver: sign({ role: "driver", sub: driver.id }),
      student: sign({ role: "student", sub: student.id }),
      staff: sign({ role: "staff", sub: staff.id }),
    },
  };
}

async function superToken(): Promise<string> {
  seq += 1;
  const su = await SuperAdminModel.create({
    email: `super${seq}@example.com`,
    passwordHash: "x",
  });
  return sign({ role: "super", sub: su.id });
}

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

describe("POST /api/complaints", () => {
  it("accepts a complaint from every signed-in role", async () => {
    const s = await seedEveryRole();

    for (const role of ["admin", "driver", "student", "staff"] as const) {
      const res = await request(app)
        .post("/api/complaints")
        .set("Authorization", `Bearer ${s.tokens[role]}`)
        .send({ category: "bug", message: `${role} cannot see the map` });

      assert.equal(res.status, 201, `${role}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.status, "open");
      assert.equal(res.body.category, "bug");
      assert.equal(res.body.hasScreenshot, false);
    }

    const stored = await ComplaintModel.find().lean();
    assert.equal(stored.length, 4);
    // The reporter's name and mobile are denormalised at write time so the
    // console never has to look across four collections.
    const driverRow = stored.find((c) => c.reporter?.role === "driver");
    assert.equal(driverRow?.reporter?.name, s.driver.name);
    assert.equal(driverRow?.reporter?.mobile, s.driver.mobile);
    assert.equal(String(driverRow?.college), String(s.college._id));
  });

  it("rejects an unauthenticated caller", async () => {
    const res = await request(app)
      .post("/api/complaints")
      .send({ category: "bug", message: "no token" });
    assert.equal(res.status, 401);
    assert.equal(await ComplaintModel.countDocuments(), 0);
  });

  it("rejects a super admin token — they read the inbox, they do not file into it", async () => {
    const token = await superToken();
    const res = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "bug", message: "hello" });
    assert.equal(res.status, 403);
  });

  it("rejects an empty message, an unknown category, and an oversized screenshot", async () => {
    const s = await seedEveryRole();
    const auth = { Authorization: `Bearer ${s.tokens.student}` };

    const blank = await request(app)
      .post("/api/complaints")
      .set(auth)
      .send({ category: "bug", message: "   " });
    assert.equal(blank.status, 400);

    const badCategory = await request(app)
      .post("/api/complaints")
      .set(auth)
      .send({ category: "nonsense", message: "something broke" });
    assert.equal(badCategory.status, 400);

    const huge = `data:image/png;base64,${"A".repeat(MAX_IMAGE_CHARS)}`;
    const tooBig = await request(app)
      .post("/api/complaints")
      .set(auth)
      .send({ category: "bug", message: "screenshot attached", screenshot: huge });
    assert.equal(tooBig.status, 400);

    assert.equal(await ComplaintModel.countDocuments(), 0);
  });

  it("stores a screenshot and diagnostics, and serves the image back to its owner", async () => {
    const s = await seedEveryRole();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({
        category: "tracking",
        message: "bus marker frozen",
        screenshot: TINY_PNG,
        diagnostics: {
          appVersion: "1.0.0",
          buildNumber: "3",
          platform: "ios",
          osVersion: "26.5",
          deviceModel: "iPhone 14",
          unknownKey: "ignored",
        },
      });
    assert.equal(created.status, 201);
    assert.equal(created.body.hasScreenshot, true);

    const stored = await ComplaintModel.findById(created.body._id).lean();
    assert.equal(stored?.diagnostics?.deviceModel, "iPhone 14");
    assert.equal(stored?.diagnostics?.platform, "ios");

    const img = await request(app)
      .get(`/api/complaints/${created.body._id}/screenshot`)
      .set("Authorization", `Bearer ${s.tokens.student}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers["content-type"], "image/png");
    assert.ok(img.headers.etag);

    // Another signed-in user must not be able to read it.
    const other = await request(app)
      .get(`/api/complaints/${created.body._id}/screenshot`)
      .set("Authorization", `Bearer ${s.tokens.driver}`);
    assert.equal(other.status, 404);
  });
});

describe("GET /api/complaints/mine", () => {
  it("returns only the caller's own complaints, and never the screenshot bytes", async () => {
    const s = await seedEveryRole();

    await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "mine one", screenshot: TINY_PNG });
    await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.driver}`)
      .send({ category: "login", message: "not mine" });

    const res = await request(app)
      .get("/api/complaints/mine")
      .set("Authorization", `Bearer ${s.tokens.student}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].message, "mine one");
    assert.equal(res.body[0].hasScreenshot, true);
    assert.equal(res.body[0].screenshot, undefined);
  });
});

describe("super admin complaint inbox", () => {
  it("lists with per-status counts and hides screenshot bytes", async () => {
    const s = await seedEveryRole();
    const token = await superToken();

    await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "one", screenshot: TINY_PNG });
    await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.driver}`)
      .send({ category: "login", message: "two" });

    const res = await request(app)
      .get("/api/super/complaints")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    assert.equal(res.body.counts.open, 2);
    assert.equal(res.body.counts.resolved, 0);
    assert.equal(res.body.complaints[0].screenshot, undefined);
    // The bytes are stripped but the flag must survive, or the console has
    // no way to know there is an image worth fetching.
    const withImage = res.body.complaints.find((c: { message: string }) => c.message === "one");
    assert.equal(withImage.hasScreenshot, true);
    // Who sent it is visible to the super admin but not in the app payload.
    assert.ok(res.body.complaints[0].reporter.name);
    assert.ok(res.body.complaints[0].diagnostics);
  });

  it("returns the screenshot inline on the detail view but not in the list", async () => {
    const s = await seedEveryRole();
    const token = await superToken();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "see this", screenshot: TINY_PNG });

    const detail = await request(app)
      .get(`/api/super/complaints/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.screenshot, TINY_PNG);
    assert.equal(detail.body.hasScreenshot, true);
    assert.ok(detail.body.reporter.name);

    const list = await request(app)
      .get("/api/super/complaints")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.body.complaints[0].screenshot, undefined);
  });

  it("filters by status", async () => {
    const s = await seedEveryRole();
    const token = await superToken();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "one" });

    await request(app)
      .patch(`/api/super/complaints/${created.body._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "in_progress" });

    const open = await request(app)
      .get("/api/super/complaints?status=open")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(open.body.total, 0);

    const inProgress = await request(app)
      .get("/api/super/complaints?status=in_progress")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(inProgress.body.total, 1);
  });

  it("appends a reply the reporter can then read", async () => {
    const s = await seedEveryRole();
    const token = await superToken();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "map is blank" });

    const replied = await request(app)
      .post(`/api/super/complaints/${created.body._id}/replies`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Fixed in the next release." });
    assert.equal(replied.status, 200);
    assert.equal(replied.body.replies.length, 1);

    const mine = await request(app)
      .get("/api/complaints/mine")
      .set("Authorization", `Bearer ${s.tokens.student}`);
    assert.equal(mine.body[0].replies.length, 1);
    assert.equal(mine.body[0].replies[0].body, "Fixed in the next release.");
  });

  it("rejects an empty reply and an unknown status", async () => {
    const s = await seedEveryRole();
    const token = await superToken();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "x" });

    const empty = await request(app)
      .post(`/api/super/complaints/${created.body._id}/replies`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "   " });
    assert.equal(empty.status, 400);

    const bad = await request(app)
      .patch(`/api/super/complaints/${created.body._id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "closed" });
    assert.equal(bad.status, 400);
  });

  it("is closed to app tokens", async () => {
    const s = await seedEveryRole();
    const res = await request(app)
      .get("/api/super/complaints")
      .set("Authorization", `Bearer ${s.tokens.admin}`);
    assert.equal(res.status, 401);
  });

  it("deletes a complaint", async () => {
    const s = await seedEveryRole();
    const token = await superToken();
    const created = await request(app)
      .post("/api/complaints")
      .set("Authorization", `Bearer ${s.tokens.student}`)
      .send({ category: "bug", message: "x" });

    const res = await request(app)
      .delete(`/api/super/complaints/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(await ComplaintModel.countDocuments(), 0);
  });
});
