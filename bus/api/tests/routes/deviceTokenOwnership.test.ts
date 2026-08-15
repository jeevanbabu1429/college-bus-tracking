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

const DEVICE = "device-token-abc";

function studentToken(id: string) {
  return jwt.sign({ role: "student", sub: id }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}
function driverToken(id: string) {
  return jwt.sign({ role: "driver", sub: id }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}

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
  const adminToken = jwt.sign(
    { adminId: admin.adminId, sub: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { admin, college, adminToken };
}

async function seedStudent(collegeId: unknown, n: number) {
  return StudentModel.create({
    college: collegeId,
    name: `Student ${n}`,
    rollNumber: `R${n}`,
    gender: "male",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: `91000000${String(n).padStart(2, "0")}`,
  });
}

describe("one device belongs to one account", () => {
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

  function register(token: string) {
    return request(app)
      .post("/api/notifications/register-token")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: DEVICE });
  }

  it("takes the token off the previous owner on the next sign-in", async () => {
    const a = await seedCollege("AAA");
    const first = await seedStudent(a.college._id, 1);
    const second = await seedStudent(a.college._id, 2);

    await register(studentToken(first.id));
    await register(studentToken(second.id));

    const firstFresh = await StudentModel.findById(first._id).lean();
    const secondFresh = await StudentModel.findById(second._id).lean();
    assert.deepEqual(firstFresh?.fcmTokens, [], "old owner released it");
    assert.deepEqual(secondFresh?.fcmTokens, [DEVICE], "new owner holds it");
  });

  it("does not leak a phone's registration across colleges", async () => {
    // The reported bug: one handset signed into two colleges was receiving
    // both colleges' announcements, because each sign-in only ever added the
    // token and never took it off the account before.
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    const inA = await seedStudent(a.college._id, 1);
    const inB = await seedStudent(b.college._id, 2);

    await register(studentToken(inA.id));
    await register(studentToken(inB.id));

    // Asserted through the audience endpoint, because that is what decides who
    // an admin's announcement actually reaches.
    const reachA = await request(app)
      .get(`/api/colleges/${a.college._id}/notifications/audience`)
      .set("Authorization", `Bearer ${a.adminToken}`);
    const reachB = await request(app)
      .get(`/api/colleges/${b.college._id}/notifications/audience`)
      .set("Authorization", `Bearer ${b.adminToken}`);

    assert.equal(reachA.body.students.withDevice, 0, "college A lost the phone");
    assert.equal(reachB.body.students.withDevice, 1, "college B has it");
  });

  it("takes the token across roles too", async () => {
    // A driver and a student sharing a handset is ordinary in a small college.
    const a = await seedCollege("AAA");
    const student = await seedStudent(a.college._id, 1);
    const driver = await DriverModel.create({
      college: a.college._id,
      name: "Driver Dan",
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: "LIC001",
      aadharNumber: "123412341234",
      mobile: "9200000001",
      address: "Depot",
    });

    await register(driverToken(driver.id));
    await register(studentToken(student.id));

    const driverFresh = await DriverModel.findById(driver._id).lean();
    const studentFresh = await StudentModel.findById(student._id).lean();
    assert.deepEqual(driverFresh?.fcmTokens, []);
    assert.deepEqual(studentFresh?.fcmTokens, [DEVICE]);
  });

  it("re-registering the same account is a no-op, not a duplicate", async () => {
    const a = await seedCollege("AAA");
    const student = await seedStudent(a.college._id, 1);

    await register(studentToken(student.id));
    await register(studentToken(student.id));

    const fresh = await StudentModel.findById(student._id).lean();
    assert.deepEqual(fresh?.fcmTokens, [DEVICE], "held once, still held");
  });

  it("leaves a different device on the same account alone", async () => {
    const a = await seedCollege("AAA");
    const student = await seedStudent(a.college._id, 1);
    const other = await seedStudent(a.college._id, 2);

    await request(app)
      .post("/api/notifications/register-token")
      .set("Authorization", `Bearer ${studentToken(student.id)}`)
      .send({ token: "their-tablet" });
    await register(studentToken(student.id));

    // Someone else now signs in on the phone, but not on the tablet.
    await register(studentToken(other.id));

    const fresh = await StudentModel.findById(student._id).lean();
    assert.deepEqual(
      fresh?.fcmTokens,
      ["their-tablet"],
      "only the handed-over device is removed"
    );
  });

  it("still lets a sign-out release the token explicitly", async () => {
    const a = await seedCollege("AAA");
    const student = await seedStudent(a.college._id, 1);

    await register(studentToken(student.id));
    const res = await request(app)
      .post("/api/notifications/unregister-token")
      .set("Authorization", `Bearer ${studentToken(student.id)}`)
      .send({ token: DEVICE });
    assert.equal(res.status, 200);

    const fresh = await StudentModel.findById(student._id).lean();
    assert.deepEqual(fresh?.fcmTokens, []);
  });
});
