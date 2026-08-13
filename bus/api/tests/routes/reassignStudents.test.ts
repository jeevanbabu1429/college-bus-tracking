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
import { StudentModel } from "../../src/models/Student.js";
import { BusModel } from "../../src/models/Bus.js";

async function seedCampus() {
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
    busCount: 2,
    driverCount: 2,
  });

  const busA = await BusModel.create({
    college: college._id,
    busNumber: "A",
    plateNumber: "TN01AA0001",
    capacity: 10,
    route: "North",
    stops: [{ name: "Anna Nagar" }, { name: "Shared Stop" }],
  });
  const busB = await BusModel.create({
    college: college._id,
    busNumber: "B",
    plateNumber: "TN01AA0002",
    capacity: 2,
    route: "South",
    stops: [{ name: "Shared Stop" }],
  });

  async function mkStudent(n: number, bus: unknown, stop: string | null) {
    return StudentModel.create({
      college: college._id,
      name: `Student ${n}`,
      rollNumber: `R${n}`,
      gender: "male",
      dob: new Date("2005-01-01"),
      address: "Somewhere",
      mobile: `900000010${n}`,
      bus,
      stop,
    });
  }

  const s1 = await mkStudent(1, busA._id, "Anna Nagar");
  const s2 = await mkStudent(2, busA._id, "Shared Stop");
  const s3 = await mkStudent(3, null, null);
  const s4 = await mkStudent(4, null, null);

  const token = jwt.sign(
    { adminId: admin.adminId, sub: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { college, token, busA, busB, s1, s2, s3, s4 };
}

describe("POST /students/reassign-bus", () => {
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

  function post(collegeId: string, token: string, body: unknown) {
    return request(app)
      .post(`/api/colleges/${collegeId}/students/reassign-bus`)
      .set("Authorization", `Bearer ${token}`)
      .send(body as object);
  }

  it("moves several students onto a bus in one call", async () => {
    const { college, token, busB, s3, s4 } = await seedCampus();

    const res = await post(String(college._id), token, {
      studentIds: [String(s3._id), String(s4._id)],
      toBusId: String(busB._id),
    });
    assert.equal(res.status, 200);

    const count = await StudentModel.countDocuments({ bus: busB._id });
    assert.equal(count, 2);
  });

  it("refuses the whole batch when it would overfill the bus", async () => {
    const { college, token, busB, s1, s2, s3 } = await seedCampus();

    // Bus B seats 2; three students cannot fit.
    const res = await post(String(college._id), token, {
      studentIds: [String(s1._id), String(s2._id), String(s3._id)],
      toBusId: String(busB._id),
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /seat|full/i);

    // Nothing moved — the check runs before any write.
    const onB = await StudentModel.countDocuments({ bus: busB._id });
    assert.equal(onB, 0);
  });

  it("keeps a stop that exists on the destination route", async () => {
    const { college, token, busB, s2 } = await seedCampus();

    // s2 is on "Shared Stop", which bus B also serves.
    const res = await post(String(college._id), token, {
      studentIds: [String(s2._id)],
      toBusId: String(busB._id),
    });
    assert.equal(res.status, 200);

    const after = await StudentModel.findById(s2._id).lean();
    assert.equal(after?.stop, "Shared Stop");
  });

  it("clears a stop the destination route does not have", async () => {
    const { college, token, busB, s1 } = await seedCampus();

    // s1 is on "Anna Nagar", which only bus A serves.
    const res = await post(String(college._id), token, {
      studentIds: [String(s1._id)],
      toBusId: String(busB._id),
    });
    assert.equal(res.status, 200);

    const after = await StudentModel.findById(s1._id).lean();
    assert.equal(after?.stop, null);
  });

  it("unassigns when toBusId is null, clearing the stop", async () => {
    const { college, token, s1, s2 } = await seedCampus();

    const res = await post(String(college._id), token, {
      studentIds: [String(s1._id), String(s2._id)],
      toBusId: null,
    });
    assert.equal(res.status, 200);

    const rows = await StudentModel.find({
      _id: { $in: [s1._id, s2._id] },
    }).lean();
    for (const r of rows) {
      assert.equal(r.bus, null);
      assert.equal(r.stop, null);
    }
  });

  it("does not count students already on the bus against its capacity", async () => {
    const { college, token, busB, s3, s4 } = await seedCampus();

    await post(String(college._id), token, {
      studentIds: [String(s3._id), String(s4._id)],
      toBusId: String(busB._id),
    });
    // Re-sending the same pair to the same full bus must be a no-op, not a
    // capacity error — they already occupy those seats.
    const again = await post(String(college._id), token, {
      studentIds: [String(s3._id), String(s4._id)],
      toBusId: String(busB._id),
    });
    assert.equal(again.status, 200);
  });

  it("rejects a student from another college", async () => {
    const { college, token, busA } = await seedCampus();
    const otherAdmin = await AdminModel.create({
      adminId: "AD002",
      name: "Other",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9000000099",
      email: "other@example.com",
      approved: true,
    });
    const otherCollege = await CollegeModel.create({
      admin: otherAdmin._id,
      name: "Other College",
      address: "x",
      code: "OC1",
      busCount: 0,
      driverCount: 0,
    });
    const outsider = await StudentModel.create({
      college: otherCollege._id,
      name: "Outsider",
      rollNumber: "X1",
      gender: "male",
      dob: new Date("2005-01-01"),
      address: "Elsewhere",
      mobile: "9111111111",
    });

    const res = await post(String(college._id), token, {
      studentIds: [String(outsider._id)],
      toBusId: String(busA._id),
    });
    assert.equal(res.status, 404);
  });

  it("validates its input", async () => {
    const { college, token } = await seedCampus();
    assert.equal((await post(String(college._id), token, {})).status, 400);
    assert.equal(
      (await post(String(college._id), token, { studentIds: [] })).status,
      400
    );
    assert.equal(
      (await post(String(college._id), token, { studentIds: ["nope"] })).status,
      400
    );
  });
});
