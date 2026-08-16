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
import { RoleModel } from "../../src/models/Role.js";
import { StaffModel } from "../../src/models/Staff.js";

let seq = 0;

async function seedAdminWithCollege(code: string) {
  seq += 1;
  const admin = await AdminModel.create({
    adminId: `AD00${seq}`,
    name: `Owner ${seq}`,
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: `900000001${seq}`,
    email: `owner${seq}@example.com`,
    approved: true,
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: `College ${code}`,
    address: "123 Road",
    code,
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

async function seedStaff(
  collegeId: unknown,
  permissions: { module: string; actions: string[] }[]
) {
  const role = await RoleModel.create({
    college: collegeId,
    name: `Role ${Math.random().toString(36).slice(2, 8)}`,
    permissions,
  });
  const staff = await StaffModel.create({
    college: collegeId,
    role: role._id,
    name: "Staff Sam",
    mobile: `95000000${String(seq).padStart(2, "0")}`,
  });
  const token = jwt.sign(
    { role: "staff", sub: staff.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { role, staff, token };
}

describe("college access control", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(async () => {
    await clearDb();
    seq = 0;
  });

  it("stops an admin reaching a college they do not own", async () => {
    // The hole this closes: requireAdmin proved you were *an* admin, and
    // nothing checked the :collegeId in the URL was yours.
    const mine = await seedAdminWithCollege("AAA");
    const theirs = await seedAdminWithCollege("BBB");

    const res = await request(app)
      .get(`/api/colleges/${theirs.college._id}/buses`)
      .set("Authorization", `Bearer ${mine.token}`);
    assert.equal(res.status, 404);

    const write = await request(app)
      .post(`/api/colleges/${theirs.college._id}/buses`)
      .set("Authorization", `Bearer ${mine.token}`)
      .send({ busNumber: "X1", plateNumber: "TN01XX0001", capacity: 40 });
    assert.equal(write.status, 404);
  });

  it("still lets an admin reach their own college", async () => {
    const mine = await seedAdminWithCollege("AAA");
    const res = await request(app)
      .get(`/api/colleges/${mine.college._id}/buses`)
      .set("Authorization", `Bearer ${mine.token}`);
    assert.equal(res.status, 200);
  });

  it("gives a staff member exactly what their role allows", async () => {
    const { college } = await seedAdminWithCollege("AAA");
    const { token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read"] },
    ]);

    const read = await request(app)
      .get(`/api/colleges/${college._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(read.status, 200);

    const write = await request(app)
      .post(`/api/colleges/${college._id}/buses`)
      .set("Authorization", `Bearer ${token}`)
      .send({ busNumber: "X1", plateNumber: "TN01XX0001", capacity: 40 });
    assert.equal(write.status, 403);
    assert.equal(write.body.forbidden, true);
  });

  it("refuses a module the role does not mention at all", async () => {
    const { college } = await seedAdminWithCollege("AAA");
    const { token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read"] },
    ]);

    const res = await request(app)
      .get(`/api/colleges/${college._id}/drivers`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("keeps a staff member out of every other college", async () => {
    const a = await seedAdminWithCollege("AAA");
    const b = await seedAdminWithCollege("BBB");
    const { token } = await seedStaff(a.college._id, [
      { module: "buses", actions: ["read"] },
    ]);

    const res = await request(app)
      .get(`/api/colleges/${b.college._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 404, "not 403 — other college ids are none of their business");
  });

  it("lists only the staff member's own college", async () => {
    const a = await seedAdminWithCollege("AAA");
    // The same admin owns a second campus the staff member is not part of.
    await CollegeModel.create({
      admin: a.admin._id,
      name: "Second Campus",
      address: "456 Road",
      code: "AAB",
      busCount: 1,
      driverCount: 1,
    });
    const { token } = await seedStaff(a.college._id, [
      { module: "buses", actions: ["read"] },
    ]);

    const res = await request(app)
      .get("/api/colleges")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].code, "AAA");
  });

  it("does not let staff create or edit colleges", async () => {
    const { college } = await seedAdminWithCollege("AAA");
    const { token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read", "create", "update", "delete"] },
    ]);

    const created = await request(app)
      .post("/api/colleges")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Sneaky College",
        address: "x",
        code: "SNK",
        busCount: 1,
        driverCount: 1,
      });
    assert.equal(created.status, 403);

    const edited = await request(app)
      .put(`/api/colleges/${college._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Renamed",
        address: "x",
        code: "AAA",
        busCount: 1,
        driverCount: 1,
      });
    assert.equal(edited.status, 403);
  });

  it("applies a narrowed role immediately, without a fresh sign-in", async () => {
    const { college } = await seedAdminWithCollege("AAA");
    const { role, token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read"] },
    ]);

    assert.equal(
      (
        await request(app)
          .get(`/api/colleges/${college._id}/buses`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
      200
    );

    await RoleModel.updateOne({ _id: role._id }, { $set: { permissions: [] } });

    assert.equal(
      (
        await request(app)
          .get(`/api/colleges/${college._id}/buses`)
          .set("Authorization", `Bearer ${token}`)
      ).status,
      403,
      "permissions are read per request, not baked into the token"
    );
  });

  it("locks out a staff member who has been switched off", async () => {
    const { college } = await seedAdminWithCollege("AAA");
    const { staff, token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read"] },
    ]);
    await StaffModel.updateOne({ _id: staff._id }, { $set: { active: false } });

    const res = await request(app)
      .get(`/api/colleges/${college._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("locks out staff when the owning admin is suspended", async () => {
    const { admin, college } = await seedAdminWithCollege("AAA");
    const { token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read"] },
    ]);
    await AdminModel.updateOne({ _id: admin._id }, { $set: { suspended: true } });

    const res = await request(app)
      .get(`/api/colleges/${college._id}/buses`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("maps route editing and assignments to their own modules", async () => {
    // Someone who may suspend a stop should not thereby be able to delete a
    // bus, so those paths resolve to `routes` and `assignments`, not `buses`.
    const { college } = await seedAdminWithCollege("AAA");
    const { token } = await seedStaff(college._id, [
      { module: "buses", actions: ["read", "create", "update", "delete"] },
    ]);

    const res = await request(app)
      .put(`/api/colleges/${college._id}/buses/507f1f77bcf86cd799439011/route`)
      .set("Authorization", `Bearer ${token}`)
      .send({ route: "New", stops: [] });
    assert.equal(res.status, 403, "buses.update must not imply routes.update");
  });
});
