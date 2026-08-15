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

async function seedCollege() {
  const admin = await AdminModel.create({
    adminId: "AD001",
    name: "Owner",
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: "9000000010",
    email: "owner@example.com",
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
  const token = jwt.sign(
    { adminId: admin.adminId, sub: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { admin, college, token };
}

function makeStudent(collegeId: unknown, n: number, tokens: string[]) {
  return StudentModel.create({
    college: collegeId,
    name: `Student ${n}`,
    rollNumber: `R${n}`,
    gender: "male",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: `90000001${String(n).padStart(2, "0")}`,
    fcmTokens: tokens,
  });
}

function makeDriver(collegeId: unknown, n: number, tokens: string[]) {
  return DriverModel.create({
    college: collegeId,
    name: `Driver ${n}`,
    dob: new Date("1980-01-01"),
    gender: "male",
    licenceNumber: `LIC00${n}`,
    aadharNumber: `12341234123${n}`,
    mobile: `90000002${String(n).padStart(2, "0")}`,
    address: "Depot",
    fcmTokens: tokens,
  });
}

const MESSAGE = { title: "Holiday tomorrow", body: "No buses will run." };

describe("admin announcements", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  function send(
    token: string,
    collegeId: string,
    payload: Record<string, unknown>
  ) {
    return request(app)
      .post(`/api/colleges/${collegeId}/notifications`)
      .set("Authorization", `Bearer ${token}`)
      .send(payload);
  }

  it("reports how many people the message can reach", async () => {
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);
    await makeStudent(college._id, 2, []); // never opened the app
    await makeDriver(college._id, 1, ["tok-d1"]);

    const res = await request(app)
      .get(`/api/colleges/${college._id}/notifications/audience`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.students, { total: 2, withDevice: 1 });
    assert.deepEqual(res.body.drivers, { total: 1, withDevice: 1 });
    // No Firebase credentials in the test env, and the form needs to know.
    assert.equal(res.body.pushConfigured, false);
  });

  it("refuses to send when the server has no push credentials", async () => {
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);

    const res = await send(token, college.id, {
      ...MESSAGE,
      audience: "students",
    });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /not configured/i);
  });

  it("refuses an empty title or message", async () => {
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);

    const noTitle = await send(token, college.id, {
      title: "   ",
      body: "x",
      audience: "students",
    });
    assert.equal(noTitle.status, 400);
    assert.match(noTitle.body.error, /title/i);

    const noBody = await send(token, college.id, {
      title: "x",
      body: "",
      audience: "students",
    });
    assert.equal(noBody.status, 400);
    assert.match(noBody.body.error, /message/i);
  });

  it("caps the title and message lengths", async () => {
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);

    const longTitle = await send(token, college.id, {
      title: "a".repeat(81),
      body: "x",
      audience: "students",
    });
    assert.equal(longTitle.status, 400);

    const longBody = await send(token, college.id, {
      title: "x",
      body: "a".repeat(301),
      audience: "students",
    });
    assert.equal(longBody.status, 400);
  });

  it("requires a valid audience", async () => {
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);

    for (const audience of [undefined, "everyone", "admins"]) {
      const res = await send(token, college.id, { ...MESSAGE, audience });
      assert.equal(res.status, 400, `audience=${audience} should be rejected`);
      assert.match(res.body.error, /audience/i);
    }
  });

  it("says so when the chosen group has no devices at all", async () => {
    // Validation order matters: this must be reported as an empty audience,
    // not swallowed by the push-not-configured check, or an admin whose
    // drivers have never signed in gets told to fix the server.
    const { college, token } = await seedCollege();
    await makeStudent(college._id, 1, ["tok-s1"]);
    await makeDriver(college._id, 1, []);

    const res = await send(token, college.id, {
      ...MESSAGE,
      audience: "drivers",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nobody/i);
  });

  it("rejects an anonymous caller", async () => {
    const { college } = await seedCollege();
    const res = await request(app)
      .post(`/api/colleges/${college._id}/notifications`)
      .send({ ...MESSAGE, audience: "both" });
    assert.equal(res.status, 401);

    const list = await request(app).get(
      `/api/colleges/${college._id}/notifications/audience`
    );
    assert.equal(list.status, 401);
  });

  it("404s an unknown college", async () => {
    const { token } = await seedCollege();
    const res = await request(app)
      .get("/api/colleges/507f1f77bcf86cd799439011/notifications/audience")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 404);
  });

  it("is blocked while the college is awaiting verification", async () => {
    // Inherited from colleges.ts, not re-implemented here — this asserts the
    // new router really does sit behind that gate.
    const { admin, token } = await seedCollege();
    const pending = await CollegeModel.create({
      admin: admin._id,
      name: "Second Campus",
      address: "456 Road",
      code: "TC2",
      busCount: 1,
      driverCount: 1,
      approved: false,
    });
    await makeStudent(pending._id, 1, ["tok-s1"]);

    const res = await send(token, pending.id, {
      ...MESSAGE,
      audience: "students",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.collegePending, true);

    const audience = await request(app)
      .get(`/api/colleges/${pending._id}/notifications/audience`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(audience.status, 403);
  });

  it("counts only the chosen college's people", async () => {
    const { college, token } = await seedCollege();
    const otherAdmin = await AdminModel.create({
      adminId: "AD002",
      name: "Other",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9000000011",
      email: "other@example.com",
      approved: true,
    });
    const otherCollege = await CollegeModel.create({
      admin: otherAdmin._id,
      name: "Other College",
      address: "789 Road",
      code: "OC1",
      busCount: 1,
      driverCount: 1,
    });
    await makeStudent(college._id, 1, ["tok-s1"]);
    await makeStudent(otherCollege._id, 2, ["tok-s2"]);

    const res = await request(app)
      .get(`/api/colleges/${college._id}/notifications/audience`)
      .set("Authorization", `Bearer ${token}`);
    assert.deepEqual(res.body.students, { total: 1, withDevice: 1 });
  });
});
