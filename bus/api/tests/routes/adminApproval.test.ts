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
import { SuperAdminModel } from "../../src/models/SuperAdmin.js";

function superToken(sub: string): string {
  return jwt.sign({ role: "super", sub }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}

const registration = {
  name: "New Admin",
  gender: "male",
  dob: "1990-04-01",
  mobile: "9000000099",
  email: "new.admin@example.com",
};

async function seedSuper() {
  const s = await SuperAdminModel.create({
    email: "super@example.com",
    passwordHash: "$2a$10$invalidinvalidinvalidinvalidinvi",
  });
  return superToken(s.id);
}

describe("admin approval gate", () => {
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

  describe("registration", () => {
    it("returns a token so the admin lands on the dashboard, marked unapproved", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(registration);

      assert.equal(res.status, 201);
      assert.ok(res.body.token, "expected an auto-login token");
      assert.equal(res.body.admin.approved, false);
      assert.equal(res.body.admin.approvedAt, null);
    });

    it("stores an explicit false rather than leaving the field absent", async () => {
      await request(app).post("/api/auth/register").send(registration);
      const raw = await AdminModel.collection.findOne({
        email: registration.email,
      });
      assert.equal(raw?.approved, false);
    });
  });

  describe("what a pending admin can and cannot do", () => {
    async function registerPending() {
      const res = await request(app)
        .post("/api/auth/register")
        .send(registration);
      return { token: res.body.token as string, admin: res.body.admin };
    }

    it("can read its own profile — that is how the dashboard sees approval land", async () => {
      const { token } = await registerPending();
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.admin.approved, false);
    });

    it("is blocked from listing colleges with pendingApproval", async () => {
      const { token } = await registerPending();
      const res = await request(app)
        .get("/api/colleges")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.pendingApproval, true);
      assert.match(res.body.error, /24 hours/);
    });

    it("is blocked from creating a college", async () => {
      const { token } = await registerPending();
      const res = await request(app)
        .post("/api/colleges")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "X",
          address: "Y",
          code: "XY",
          busCount: 1,
          driverCount: 1,
        });
      assert.equal(res.status, 403);
      assert.equal(res.body.pendingApproval, true);
    });

    it("is blocked from the college sub-routes too", async () => {
      const { token } = await registerPending();
      const someCollegeId = "507f1f77bcf86cd799439011";
      for (const path of ["buses", "drivers", "students"]) {
        const res = await request(app)
          .get(`/api/colleges/${someCollegeId}/${path}`)
          .set("Authorization", `Bearer ${token}`);
        assert.equal(res.status, 403, `${path} should be gated`);
        assert.equal(res.body.pendingApproval, true, `${path} flag`);
      }
    });

    it("is blocked from editing its own profile", async () => {
      const { token } = await registerPending();
      const res = await request(app)
        .put("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...registration, name: "Renamed" });
      assert.equal(res.status, 403);
      assert.equal(res.body.pendingApproval, true);
    });

    it("can still sign in — the gate blocks actions, not access", async () => {
      await registerPending();
      await request(app)
        .post("/api/auth/request-otp")
        .send({ mobile: registration.mobile });
      const res = await request(app)
        .post("/api/auth/verify-otp")
        .send({ mobile: registration.mobile, otp: "0000" });
      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.admin.approved, false);
    });
  });

  describe("legacy admins (field absent) are never locked out", () => {
    it("treats a missing approved field as approved", async () => {
      const admin = await AdminModel.create({
        adminId: "AD900",
        name: "Legacy",
        gender: "female",
        dob: new Date("1980-01-01"),
        mobile: "9000000077",
        email: "legacy@example.com",
      });
      // Simulate a document written before the field existed.
      await AdminModel.collection.updateOne(
        { _id: admin._id },
        { $unset: { approved: "", approvedAt: "" } }
      );

      const token = jwt.sign(
        { adminId: "AD900", sub: admin.id },
        process.env.JWT_SECRET as string,
        { expiresIn: "1h" }
      );
      const res = await request(app)
        .get("/api/colleges")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
    });
  });

  describe("super admin approval", () => {
    it("approves an admin and unblocks them", async () => {
      const reg = await request(app)
        .post("/api/auth/register")
        .send(registration);
      const adminToken = reg.body.token as string;
      const adminId = reg.body.admin._id as string;
      const sToken = await seedSuper();

      const blocked = await request(app)
        .get("/api/colleges")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(blocked.status, 403);

      const patch = await request(app)
        .patch(`/api/super/admins/${adminId}/approved`)
        .set("Authorization", `Bearer ${sToken}`)
        .send({ approved: true });
      assert.equal(patch.status, 200);
      assert.equal(patch.body.approved, true);
      assert.ok(patch.body.approvedAt);

      const allowed = await request(app)
        .get("/api/colleges")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(allowed.status, 200);
    });

    it("can revoke approval, re-blocking the admin", async () => {
      const reg = await request(app)
        .post("/api/auth/register")
        .send(registration);
      const sToken = await seedSuper();
      const adminId = reg.body.admin._id as string;

      await request(app)
        .patch(`/api/super/admins/${adminId}/approved`)
        .set("Authorization", `Bearer ${sToken}`)
        .send({ approved: true });
      const revoked = await request(app)
        .patch(`/api/super/admins/${adminId}/approved`)
        .set("Authorization", `Bearer ${sToken}`)
        .send({ approved: false });

      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.approved, false);
      assert.equal(revoked.body.approvedAt, null);

      const res = await request(app)
        .get("/api/colleges")
        .set("Authorization", `Bearer ${reg.body.token}`);
      assert.equal(res.status, 403);
    });

    it("requires a boolean and a super token", async () => {
      const reg = await request(app)
        .post("/api/auth/register")
        .send(registration);
      const adminId = reg.body.admin._id as string;
      const sToken = await seedSuper();

      const bad = await request(app)
        .patch(`/api/super/admins/${adminId}/approved`)
        .set("Authorization", `Bearer ${sToken}`)
        .send({ approved: "yes" });
      assert.equal(bad.status, 400);

      const unauth = await request(app)
        .patch(`/api/super/admins/${adminId}/approved`)
        .send({ approved: true });
      assert.equal(unauth.status, 401);
    });
  });
});
