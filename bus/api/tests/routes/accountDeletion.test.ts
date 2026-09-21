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
import { BusModel } from "../../src/models/Bus.js";
import { StudentModel } from "../../src/models/Student.js";
import { StaffModel } from "../../src/models/Staff.js";
import { RoleModel } from "../../src/models/Role.js";
import { AccountDeletionModel } from "../../src/models/AccountDeletion.js";
import { AppSettingsModel } from "../../src/models/AppSettings.js";

// Deleting your own account from the app (App Store guideline 5.1.1(v)).

describe("account deletion", () => {
  let app: Express;
  let secret: string;
  let admin: Awaited<ReturnType<typeof AdminModel.create>>;
  let college: Awaited<ReturnType<typeof CollegeModel.create>>;
  let driver: Awaited<ReturnType<typeof DriverModel.create>>;
  let bus: Awaited<ReturnType<typeof BusModel.create>>;
  let student: Awaited<ReturnType<typeof StudentModel.create>>;

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
    admin = await AdminModel.create({
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
    driver = await DriverModel.create({
      college: college._id,
      name: "Ravi",
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: "LIC1",
      aadharNumber: "123412341234",
      mobile: "9200000001",
      address: "Depot",
    });
    bus = await BusModel.create({
      college: college._id,
      busNumber: "21",
      plateNumber: "TN01AA0001",
      capacity: 40,
      driver: driver._id,
      route: "Tambaram",
    });
    student = await StudentModel.create({
      college: college._id,
      name: "Ananya",
      rollNumber: "R1",
      mobile: "9300000001",
      gender: "female",
      dob: new Date("2004-01-01"),
      address: "Guindy",
      bus: bus._id,
    });
  });

  const tokenFor = {
    admin: () => jwt.sign({ adminId: "AD001", sub: admin.id }, secret),
    driver: () => jwt.sign({ role: "driver", sub: driver.id }, secret),
    student: () => jwt.sign({ role: "student", sub: student.id }, secret),
  };

  const requestCode = (token: string) =>
    request(app)
      .post("/api/account/delete/request-otp")
      .set("Authorization", `Bearer ${token}`);

  const remove = (token: string, body: Record<string, unknown>) =>
    request(app)
      .post("/api/account/delete")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("needs a signed-in account", async () => {
    assert.equal((await request(app).post("/api/account/delete/request-otp")).status, 401);
    assert.equal(
      (await request(app).post("/api/account/delete").send({ reason: "x", otp: "0000" }))
        .status,
      401
    );
  });

  it("sends a code to the account's own mobile", async () => {
    const res = await requestCode(tokenFor.student());
    assert.equal(res.status, 200);
    assert.equal(res.body.mobile, "9300000001");
    const fresh = await StudentModel.findById(student.id)
      .select("+deleteOtp +deleteOtpExpiresAt")
      .lean();
    assert.equal(fresh?.deleteOtp, "0000");
    assert.ok(fresh?.deleteOtpExpiresAt instanceof Date);
  });

  it("asks for a reason", async () => {
    const token = tokenFor.student();
    await requestCode(token);
    const res = await remove(token, { reason: "", otp: "0000" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /why/i);
    assert.ok(await StudentModel.findById(student.id));
  });

  it("refuses without a code request", async () => {
    const res = await remove(tokenFor.student(), {
      reason: "Left the college",
      otp: "0000",
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /send code/i);
    assert.ok(await StudentModel.findById(student.id));
  });

  it("refuses a wrong code", async () => {
    const token = tokenFor.student();
    await requestCode(token);
    const res = await remove(token, { reason: "Left the college", otp: "9999" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not right/i);
    assert.ok(await StudentModel.findById(student.id));
  });

  it("refuses an expired code", async () => {
    const token = tokenFor.student();
    await requestCode(token);
    await StudentModel.updateOne(
      { _id: student.id },
      { $set: { deleteOtpExpiresAt: new Date(Date.now() - 1000) } }
    );
    const res = await remove(token, { reason: "Left the college", otp: "0000" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /expired/i);
    assert.ok(await StudentModel.findById(student.id));
  });

  it("deletes a student and their seat, and nothing else", async () => {
    const token = tokenFor.student();
    await requestCode(token);
    const res = await remove(token, { reason: "Left the college", otp: "0000" });
    assert.equal(res.status, 200);
    assert.equal(await StudentModel.findById(student.id), null);
    assert.ok(await DriverModel.findById(driver.id));
    assert.ok(await BusModel.findById(bus.id));
    assert.ok(await CollegeModel.findById(college.id));
  });

  it("deletes a driver and leaves the bus without one", async () => {
    const token = tokenFor.driver();
    await requestCode(token);
    const res = await remove(token, { reason: "Changed job", otp: "0000" });
    assert.equal(res.status, 200);
    assert.equal(await DriverModel.findById(driver.id), null);
    const freshBus = await BusModel.findById(bus.id).lean();
    assert.ok(freshBus, "the bus stays");
    assert.equal(freshBus?.driver, null);
    assert.ok(await StudentModel.findById(student.id), "students keep their seats");
  });

  it("deletes an admin with their whole college", async () => {
    const token = tokenFor.admin();
    await requestCode(token);
    const res = await remove(token, { reason: "Closing the contract", otp: "0000" });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.removed, {
      colleges: 1,
      buses: 1,
      drivers: 1,
      students: 1,
    });
    assert.equal(await AdminModel.findById(admin.id), null);
    assert.equal(await CollegeModel.findById(college.id), null);
    assert.equal(await DriverModel.findById(driver.id), null);
    assert.equal(await BusModel.findById(bus.id), null);
    assert.equal(await StudentModel.findById(student.id), null);
  });

  it("keeps the reason after the account is gone", async () => {
    const token = tokenFor.driver();
    await requestCode(token);
    await remove(token, { reason: "Moving to another city", otp: "0000" });
    const record = await AccountDeletionModel.findOne().lean();
    assert.equal(record?.role, "driver");
    assert.equal(record?.name, "Ravi");
    assert.equal(record?.mobile, "9200000001");
    assert.equal(record?.reason, "Moving to another city");
    assert.equal(record?.collegeName, "College");
  });

  it("leaves the code unusable a second time", async () => {
    const token = tokenFor.student();
    await requestCode(token);
    await remove(token, { reason: "Left the college", otp: "0000" });
    // The account is gone, so the same token cannot delete anything again.
    const again = await remove(token, { reason: "Left the college", otp: "0000" });
    assert.equal(again.status, 401);
  });

  it("is refused while the super admin has it switched off", async () => {
    await AppSettingsModel.findOneAndUpdate(
      {},
      { accountDeletionEnabled: false },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const token = tokenFor.student();
    const asked = await requestCode(token);
    assert.equal(asked.status, 403);
    assert.match(asked.body.error, /switched off/i);
    const res = await remove(token, { reason: "Left the college", otp: "0000" });
    assert.equal(res.status, 403);
    assert.ok(await StudentModel.findById(student.id), "the account stays");
  });

  it("works again once it is switched back on", async () => {
    await AppSettingsModel.findOneAndUpdate(
      {},
      { accountDeletionEnabled: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
    const token = tokenFor.student();
    await requestCode(token);
    const res = await remove(token, { reason: "Left the college", otp: "0000" });
    assert.equal(res.status, 200);
    assert.equal(await StudentModel.findById(student.id), null);
  });

  it("tells staff to ask their college", async () => {
    const role = await RoleModel.create({
      college: college._id,
      name: "Dispatcher",
      permissions: [],
    });
    const staff = await StaffModel.create({
      college: college._id,
      role: role._id,
      name: "Sam",
      mobile: "9400000001",
    });
    const token = jwt.sign({ role: "staff", sub: staff.id }, secret);
    const res = await requestCode(token);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /your college/i);
    assert.ok(await StaffModel.findById(staff.id));
  });
});
