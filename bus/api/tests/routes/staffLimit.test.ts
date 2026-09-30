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
import { CollegeModel, DEFAULT_STAFF_LIMIT } from "../../src/models/College.js";
import { RoleModel } from "../../src/models/Role.js";
import { StaffModel } from "../../src/models/Staff.js";
import { SuperAdminModel } from "../../src/models/SuperAdmin.js";
import { seedSuperAdmin } from "../../src/seed.js";

// How many staff accounts a college may create, and who can lift it.

describe("staff account limit", () => {
  let app: Express;
  let secret: string;
  let college: Awaited<ReturnType<typeof CollegeModel.create>>;
  let role: Awaited<ReturnType<typeof RoleModel.create>>;
  let adminToken: string;
  let superToken: string;

  before(async () => {
    await startTestDb();
    app = await buildApp();
    secret = process.env.JWT_SECRET as string;
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    await seedSuperAdmin();
    const admin = await AdminModel.create({
      adminId: "AD001",
      name: "Owner",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9000000011",
      email: "owner@example.com",
      approved: true,
    });
    college = await CollegeModel.create({
      admin: admin._id,
      name: "College",
      address: "Road",
      code: "C1",
      busCount: 1,
      driverCount: 1,
      approved: true,
    });
    role = await RoleModel.create({
      college: college._id,
      name: "Dispatcher",
      permissions: [],
    });
    adminToken = jwt.sign({ adminId: "AD001", sub: admin.id }, secret);
    const superAdmin = await SuperAdminModel.findOne();
    superToken = jwt.sign(
      { role: "super", sub: String(superAdmin?._id) },
      secret
    );
  });

  const addStaff = (n: number) =>
    request(app)
      .post(`/api/colleges/${college.id}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Staff ${n}`, mobile: `94000000${String(n).padStart(2, "0")}`, roleId: role.id });

  const allowance = () =>
    request(app)
      .get(`/api/colleges/${college.id}/staff/allowance`)
      .set("Authorization", `Bearer ${adminToken}`);

  const setLimit = (staffLimit: unknown) =>
    request(app)
      .patch(`/api/super/colleges/${college.id}`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ staffLimit });

  it("includes five accounts by default", async () => {
    const res = await allowance();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { used: 0, limit: DEFAULT_STAFF_LIMIT, remaining: 5 });
  });

  it("counts down as staff are added", async () => {
    for (let i = 1; i <= 3; i++) assert.equal((await addStaff(i)).status, 201);
    assert.deepEqual((await allowance()).body, { used: 3, limit: 5, remaining: 2 });
  });

  it("stops the sixth and says how to get more", async () => {
    for (let i = 1; i <= 5; i++) assert.equal((await addStaff(i)).status, 201);
    const res = await addStaff(6);
    assert.equal(res.status, 403);
    assert.equal(res.body.limitReached, true);
    assert.match(res.body.error, /5 user accounts/);
    assert.match(res.body.error, /support/i);
    assert.match(res.body.error, /twostackd@gmail\.com/);
    assert.equal(await StaffModel.countDocuments({ college: college._id }), 5);
  });

  it("lets the super admin raise the limit, which unblocks the college", async () => {
    for (let i = 1; i <= 5; i++) await addStaff(i);
    assert.equal((await addStaff(6)).status, 403);

    const raised = await setLimit(8);
    assert.equal(raised.status, 200);
    assert.equal(raised.body.staffLimit, 8);

    assert.equal((await addStaff(6)).status, 201);
    assert.deepEqual((await allowance()).body, { used: 6, limit: 8, remaining: 2 });
  });

  it("lowering the limit blocks new accounts but keeps the existing ones", async () => {
    for (let i = 1; i <= 3; i++) await addStaff(i);
    await setLimit(2);
    assert.equal(await StaffModel.countDocuments({ college: college._id }), 3);
    assert.deepEqual((await allowance()).body, { used: 3, limit: 2, remaining: 0 });
    assert.equal((await addStaff(4)).status, 403);
  });

  it("refuses a limit that is not a sensible number", async () => {
    for (const bad of ["ten", -1, 2.5, 501]) {
      const res = await setLimit(bad);
      assert.equal(res.status, 400, `accepted ${JSON.stringify(bad)}`);
    }
  });

  it("keeps the limit out of the college's own hands", async () => {
    const res = await request(app)
      .put(`/api/colleges/${college.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "College",
        address: "Road",
        code: "C1",
        busCount: 1,
        driverCount: 1,
        staffLimit: 50,
      });
    assert.equal(res.status, 200);
    const fresh = await CollegeModel.findById(college.id).lean();
    assert.equal(fresh?.staffLimit, DEFAULT_STAFF_LIMIT, "admin edited their own limit");
  });
});
