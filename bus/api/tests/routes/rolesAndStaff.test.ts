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

async function seedCollege(code: string) {
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

describe("roles and staff", () => {
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

  function roles(collegeId: unknown, token: string) {
    return {
      list: () =>
        request(app)
          .get(`/api/colleges/${collegeId}/roles`)
          .set("Authorization", `Bearer ${token}`),
      create: (body: Record<string, unknown>) =>
        request(app)
          .post(`/api/colleges/${collegeId}/roles`)
          .set("Authorization", `Bearer ${token}`)
          .send(body),
      update: (id: unknown, body: Record<string, unknown>) =>
        request(app)
          .put(`/api/colleges/${collegeId}/roles/${id}`)
          .set("Authorization", `Bearer ${token}`)
          .send(body),
      remove: (id: unknown) =>
        request(app)
          .delete(`/api/colleges/${collegeId}/roles/${id}`)
          .set("Authorization", `Bearer ${token}`),
    };
  }

  it("serves the catalogue the matrix is drawn from", async () => {
    const { college, token } = await seedCollege("AAA");
    const res = await request(app)
      .get(`/api/colleges/${college._id}/roles/catalogue`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    const keys = res.body.modules.map((m: { key: string }) => m.key);
    assert.ok(keys.includes("buses"));
    assert.ok(keys.includes("access"));
    const buses = res.body.modules.find((m: { key: string }) => m.key === "buses");
    assert.deepEqual(buses.actions, ["create", "read", "update", "delete"]);
  });

  it("creates a role with permissions", async () => {
    const { college, token } = await seedCollege("AAA");
    const res = await roles(college._id, token).create({
      name: "Transport Officer",
      description: "Runs the fleet day to day",
      permissions: [
        { module: "buses", actions: ["read", "update"] },
        { module: "drivers", actions: ["read"] },
      ],
      landingPage: "/buses",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Transport Officer");
    assert.equal(res.body.landingPage, "/buses");
    assert.equal(res.body.staffCount, 0);
  });

  it("drops permissions the catalogue does not define", async () => {
    // A typo or a module removed from the catalogue must never end up stored
    // as a grant.
    const { college, token } = await seedCollege("AAA");
    const res = await roles(college._id, token).create({
      name: "Odd",
      permissions: [
        { module: "buses", actions: ["read", "teleport"] },
        { module: "nonsense", actions: ["read"] },
      ],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.permissions.length, 1);
    assert.deepEqual(res.body.permissions[0], {
      module: "buses",
      actions: ["read"],
    });
  });

  it("refuses two roles with the same name in one college", async () => {
    const { college, token } = await seedCollege("AAA");
    await roles(college._id, token).create({ name: "Supervisor" });
    const again = await roles(college._id, token).create({ name: "Supervisor" });
    assert.equal(again.status, 409);
  });

  it("allows the same role name in a different college", async () => {
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    assert.equal((await roles(a.college._id, a.token).create({ name: "Supervisor" })).status, 201);
    assert.equal((await roles(b.college._id, b.token).create({ name: "Supervisor" })).status, 201);
  });

  it("will not delete a role somebody is using", async () => {
    const { college, token } = await seedCollege("AAA");
    const role = await roles(college._id, token).create({ name: "Supervisor" });
    await request(app)
      .post(`/api/colleges/${college._id}/staff`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam", mobile: "9500000001", roleId: role.body._id });

    const res = await roles(college._id, token).remove(role.body._id);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /1 person is using this role/);
  });

  it("adds a staff member by name and mobile", async () => {
    const { college, token } = await seedCollege("AAA");
    const role = await roles(college._id, token).create({ name: "Supervisor" });

    const res = await request(app)
      .post(`/api/colleges/${college._id}/staff`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam Staff", mobile: "+91 95000 00001", roleId: role.body._id });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Sam Staff");
    assert.equal(res.body.mobile, "9500000001", "stored as ten digits");
    assert.equal(res.body.role.name, "Supervisor");
  });

  it("refuses a role belonging to another college", async () => {
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    const theirRole = await roles(b.college._id, b.token).create({ name: "Theirs" });

    const res = await request(app)
      .post(`/api/colleges/${a.college._id}/staff`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "Sam", mobile: "9500000002", roleId: theirRole.body._id });
    assert.equal(res.status, 400);
  });

  it("refuses the same mobile twice in one college", async () => {
    const { college, token } = await seedCollege("AAA");
    const role = await roles(college._id, token).create({ name: "Supervisor" });
    const body = { name: "Sam", mobile: "9500000003", roleId: role.body._id };

    assert.equal(
      (
        await request(app)
          .post(`/api/colleges/${college._id}/staff`)
          .set("Authorization", `Bearer ${token}`)
          .send(body)
      ).status,
      201
    );
    const again = await request(app)
      .post(`/api/colleges/${college._id}/staff`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    assert.equal(again.status, 409);
  });

  it("signs a staff member in with an OTP", async () => {
    const { college, token } = await seedCollege("AAA");
    const role = await roles(college._id, token).create({
      name: "Supervisor",
      permissions: [{ module: "buses", actions: ["read"] }],
    });
    await request(app)
      .post(`/api/colleges/${college._id}/staff`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam", mobile: "9500000004", roleId: role.body._id });

    await request(app)
      .post("/api/staff-auth/request-otp")
      .send({ mobile: "9500000004" });
    const res = await request(app)
      .post("/api/staff-auth/verify-otp")
      .send({ mobile: "9500000004", otp: "0000" });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.staff.role.name, "Supervisor");
    assert.deepEqual(res.body.staff.role.permissions, [
      { module: "buses", actions: ["read"] },
    ]);
    assert.equal(res.body.staff.college.code, "AAA");
  });

  it("asks which college when the mobile is staff at two", async () => {
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    for (const c of [a, b]) {
      const role = await roles(c.college._id, c.token).create({ name: "Supervisor" });
      await request(app)
        .post(`/api/colleges/${c.college._id}/staff`)
        .set("Authorization", `Bearer ${c.token}`)
        .send({ name: "Sam", mobile: "9500000005", roleId: role.body._id });
    }

    await request(app).post("/api/staff-auth/request-otp").send({ mobile: "9500000005" });
    const choose = await request(app)
      .post("/api/staff-auth/verify-otp")
      .send({ mobile: "9500000005", otp: "0000" });
    assert.equal(choose.body.needsCollege, true);
    assert.equal(choose.body.options.length, 2);

    const picked = choose.body.options.find(
      (o: { collegeCode: string }) => o.collegeCode === "BBB"
    );
    const done = await request(app)
      .post("/api/staff-auth/verify-otp")
      .send({ mobile: "9500000005", otp: "0000", staffId: picked.staffId });
    assert.equal(done.status, 200);
    assert.equal(done.body.staff.college.code, "BBB");
  });

  it("refuses a switched-off staff member at sign-in", async () => {
    const { college, token } = await seedCollege("AAA");
    const role = await roles(college._id, token).create({ name: "Supervisor" });
    const created = await request(app)
      .post(`/api/colleges/${college._id}/staff`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam", mobile: "9500000006", roleId: role.body._id });
    await StaffModel.updateOne(
      { _id: created.body._id },
      { $set: { active: false } }
    );

    const res = await request(app)
      .post("/api/staff-auth/request-otp")
      .send({ mobile: "9500000006" });
    assert.equal(res.status, 404);
  });

  it("keeps one college's roles out of another's list", async () => {
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    await roles(a.college._id, a.token).create({ name: "Mine" });
    await roles(b.college._id, b.token).create({ name: "Theirs" });

    const res = await roles(a.college._id, a.token).list();
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].name, "Mine");
  });

  it("only lets staff with the access module manage roles", async () => {
    const { college, token } = await seedCollege("AAA");
    const plain = await RoleModel.create({
      college: college._id,
      name: "Plain",
      permissions: [{ module: "buses", actions: ["read"] }],
    });
    const staff = await StaffModel.create({
      college: college._id,
      role: plain._id,
      name: "Sam",
      mobile: "9500000007",
    });
    const staffToken = jwt.sign(
      { role: "staff", sub: staff.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const blocked = await roles(college._id, staffToken).create({ name: "Sneaky" });
    assert.equal(blocked.status, 403);

    // And with the module granted, they can.
    await RoleModel.updateOne(
      { _id: plain._id },
      { $set: { permissions: [{ module: "access", actions: ["create", "read"] }] } }
    );
    const allowed = await roles(college._id, staffToken).create({ name: "Fine" });
    assert.equal(allowed.status, 201);
  });
});
