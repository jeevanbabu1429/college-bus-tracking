import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
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

describe("super admin", () => {
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

  it("logs in with default credentials and returns a token", async () => {
    const res = await request(app)
      .post("/api/super/login")
      .send({ email: "superadmin@gmail.com", password: "superadmin@123" });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
    assert.equal(res.body.superAdmin.email, "superadmin@gmail.com");
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/super/login")
      .send({ email: "superadmin@gmail.com", password: "wrong-pass" });
    assert.equal(res.status, 401);
  });

  it("rejects unknown email with 401 (same shape as wrong password)", async () => {
    const res = await request(app)
      .post("/api/super/login")
      .send({ email: "ghost@example.com", password: "whatever" });
    assert.equal(res.status, 401);
  });

  it("/api/super/admins requires a super token", async () => {
    const res = await request(app).get("/api/super/admins");
    assert.equal(res.status, 401);
  });

  it("lists admins with counts once authenticated", async () => {
    const admin = await AdminModel.create({
      adminId: "AD777",
      name: "Listed",
      gender: "male",
      dob: new Date("1980-01-01"),
      mobile: "9333300001",
      email: "listed@example.com",
    });
    await CollegeModel.create({
      admin: admin._id,
      name: "L College",
      address: "L Rd",
      code: "LST",
      busCount: 3,
      driverCount: 2,
    });
    const login = await request(app)
      .post("/api/super/login")
      .send({ email: "superadmin@gmail.com", password: "superadmin@123" });
    const token = login.body.token;
    const res = await request(app)
      .get("/api/super/admins")
      .set("authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const row = res.body.find(
      (a: { email: string }) => a.email === "listed@example.com"
    );
    assert.ok(row, "created admin should appear in the list");
  });
});
