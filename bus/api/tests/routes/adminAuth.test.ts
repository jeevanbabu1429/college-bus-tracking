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
import { AdminModel } from "../../src/models/Admin.js";

const adminInput = {
  name: "Ada Lovelace",
  gender: "female",
  dob: "1990-01-01",
  mobile: "9000000001",
  email: "ada@example.com",
};

describe("admin OTP auth flow", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  it("registers a new admin and returns generated adminId", async () => {
    const res = await request(app).post("/api/auth/register").send(adminInput);
    assert.equal(res.status, 201);
    assert.equal(res.body.admin.email, "ada@example.com");
    assert.match(res.body.admin.adminId, /^AD\d{3}$/);
  });

  it("rejects duplicate mobile with 409", async () => {
    await request(app).post("/api/auth/register").send(adminInput).expect(201);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...adminInput, email: "other@example.com" });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /mobile/);
  });

  it("request-otp on a missing mobile returns 404", async () => {
    const res = await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: "9999999999" });
    assert.equal(res.status, 404);
  });

  it("verify-otp with correct code issues JWT", async () => {
    await request(app).post("/api/auth/register").send(adminInput).expect(201);
    await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: adminInput.mobile })
      .expect(200);
    // NODE_ENV=test → otp is deterministic "0000".
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: adminInput.mobile, otp: "0000" });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
    assert.ok(res.body.token.length > 20);
  });

  it("verify-otp with wrong code returns 400", async () => {
    await request(app).post("/api/auth/register").send(adminInput).expect(201);
    await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: adminInput.mobile })
      .expect(200);
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: adminInput.mobile, otp: "9999" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /invalid/i);
  });

  it("verify-otp on a suspended admin returns 403 + suspended flag", async () => {
    await request(app).post("/api/auth/register").send(adminInput).expect(201);
    await AdminModel.updateOne(
      { mobile: adminInput.mobile },
      { $set: { suspended: true } }
    );
    await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: adminInput.mobile })
      .expect(200);
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: adminInput.mobile, otp: "0000" });
    assert.equal(res.status, 403);
    assert.equal(res.body.suspended, true);
  });

  it("clears otp fields once verify-otp succeeds", async () => {
    await request(app).post("/api/auth/register").send(adminInput).expect(201);
    await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: adminInput.mobile })
      .expect(200);
    await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: adminInput.mobile, otp: "0000" })
      .expect(200);
    const admin = await AdminModel.findOne({ mobile: adminInput.mobile });
    assert.equal(admin?.otp, null);
    assert.equal(admin?.otpExpiresAt, null);
  });
});
