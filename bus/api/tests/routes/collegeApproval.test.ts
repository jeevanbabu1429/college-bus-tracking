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
import { seedSuperAdmin } from "../../src/seed.js";
import { AdminModel } from "../../src/models/Admin.js";
import { CollegeModel } from "../../src/models/College.js";

async function seedAdmin() {
  const admin = await AdminModel.create({
    adminId: "AD001",
    name: "Owner",
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: "9000000010",
    email: "owner@example.com",
    approved: true,
  });
  const token = jwt.sign(
    { adminId: admin.adminId, sub: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { admin, token };
}

const COLLEGE = {
  name: "Test College",
  address: "123 Road",
  busCount: 2,
  driverCount: 2,
};

describe("per-college verification", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(async () => {
    await clearDb();
    await seedSuperAdmin();
  });

  function createCollege(token: string, code: string) {
    return request(app)
      .post("/api/colleges")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...COLLEGE, code });
  }

  async function superToken() {
    const res = await request(app)
      .post("/api/super/login")
      .send({ email: "superadmin@gmail.com", password: "superadmin@123" });
    return res.body.token as string;
  }

  it("approves an admin's first college on creation", async () => {
    const { token } = await seedAdmin();
    const res = await createCollege(token, "TC1");
    assert.equal(res.status, 201);
    assert.equal(res.body.approved, true);
  });

  it("leaves every later college awaiting verification", async () => {
    const { token } = await seedAdmin();
    await createCollege(token, "TC1");

    const second = await createCollege(token, "TC2");
    assert.equal(second.status, 201);
    assert.equal(second.body.approved, false);

    const third = await createCollege(token, "TC3");
    assert.equal(third.body.approved, false);
  });

  it("blocks the pending college's buses, drivers and students", async () => {
    const { token } = await seedAdmin();
    await createCollege(token, "TC1");
    const pending = await createCollege(token, "TC2");
    const id = pending.body._id as string;

    for (const path of ["buses", "drivers", "students"]) {
      const res = await request(app)
        .get(`/api/colleges/${id}/${path}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 403, `GET /${path} should be blocked`);
      assert.equal(res.body.collegePending, true);
      assert.match(res.body.error, /24 hours/);
    }

    // Writes are blocked by the same middleware, not just reads.
    const write = await request(app)
      .post(`/api/colleges/${id}/buses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ busNumber: "B1", plateNumber: "TN01AA0001", capacity: 40 });
    assert.equal(write.status, 403);
  });

  it("does not use the account-level pendingApproval flag", async () => {
    // The clients replace the whole console on `pendingApproval`. A pending
    // college must never trigger that — only the one college is locked.
    const { token } = await seedAdmin();
    await createCollege(token, "TC1");
    const pending = await createCollege(token, "TC2");

    const res = await request(app)
      .get(`/api/colleges/${pending.body._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.body.pendingApproval, undefined);
  });

  it("leaves the admin's already-verified colleges working", async () => {
    const { token } = await seedAdmin();
    const live = await createCollege(token, "TC1");
    await createCollege(token, "TC2");

    const res = await request(app)
      .get(`/api/colleges/${live.body._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
  });

  it("still lists and allows editing a pending college", async () => {
    const { token } = await seedAdmin();
    await createCollege(token, "TC1");
    const pending = await createCollege(token, "TC2");

    const list = await request(app)
      .get("/api/colleges")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);

    // The admin can correct the details the super admin is reviewing.
    const edit = await request(app)
      .put(`/api/colleges/${pending.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...COLLEGE, name: "Corrected Name", code: "TC2" });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.name, "Corrected Name");
  });

  it("opens the college once the super admin verifies it", async () => {
    const { token } = await seedAdmin();
    await createCollege(token, "TC1");
    const pending = await createCollege(token, "TC2");
    const id = pending.body._id as string;

    const res = await request(app)
      .patch(`/api/super/colleges/${id}/approved`)
      .set("Authorization", `Bearer ${await superToken()}`)
      .send({ approved: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.approved, true);

    const buses = await request(app)
      .get(`/api/colleges/${id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(buses.status, 200);
  });

  it("can revoke a verified college again", async () => {
    const { token } = await seedAdmin();
    const live = await createCollege(token, "TC1");
    const id = live.body._id as string;

    await request(app)
      .patch(`/api/super/colleges/${id}/approved`)
      .set("Authorization", `Bearer ${await superToken()}`)
      .send({ approved: false });

    const buses = await request(app)
      .get(`/api/colleges/${id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(buses.status, 403);
  });

  it("keeps colleges that predate the field usable", async () => {
    const { admin, token } = await seedAdmin();
    // No `approved` value at all — a legacy row. `=== false` is what makes
    // this keep working; `!approved` would lock every existing customer out.
    const legacy = await CollegeModel.create({
      admin: admin._id,
      ...COLLEGE,
      code: "OLD",
    });
    assert.equal(legacy.approved, undefined);

    const res = await request(app)
      .get(`/api/colleges/${legacy._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
  });

  it("validates the super admin's approved payload", async () => {
    const { token } = await seedAdmin();
    const live = await createCollege(token, "TC1");
    const sToken = await superToken();

    const bad = await request(app)
      .patch(`/api/super/colleges/${live.body._id}/approved`)
      .set("Authorization", `Bearer ${sToken}`)
      .send({ approved: "yes" });
    assert.equal(bad.status, 400);

    const missing = await request(app)
      .patch("/api/super/colleges/507f1f77bcf86cd799439011/approved")
      .set("Authorization", `Bearer ${sToken}`)
      .send({ approved: true });
    assert.equal(missing.status, 404);

    const anon = await request(app)
      .patch(`/api/super/colleges/${live.body._id}/approved`)
      .send({ approved: true });
    assert.equal(anon.status, 401);
  });
});
