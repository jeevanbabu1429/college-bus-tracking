import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  clearDb,
  startTestDb,
  stopTestDb,
} from "../helpers/testEnv.js";
import { AdminModel } from "../../src/models/Admin.js";
import { CollegeModel } from "../../src/models/College.js";
import {
  checkAdminSuspension,
  checkCollegeAdminSuspension,
} from "../../src/lib/suspension.js";

describe("suspension checks", () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(clearDb);

  it("returns null for a non-suspended admin", async () => {
    const admin = await AdminModel.create({
      adminId: "AD200",
      name: "Active",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9222200001",
      email: "active@example.com",
    });
    const msg = await checkAdminSuspension(admin._id, "admin");
    assert.equal(msg, null);
  });

  it("returns admin-facing copy when the admin is suspended", async () => {
    const admin = await AdminModel.create({
      adminId: "AD201",
      name: "Frozen",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9222200002",
      email: "frozen@example.com",
      suspended: true,
    });
    const msg = await checkAdminSuspension(admin._id, "admin");
    assert.ok(msg);
    assert.match(msg!, /Jeevan/);
  });

  it("returns generic downstream copy for drivers/students", async () => {
    const admin = await AdminModel.create({
      adminId: "AD202",
      name: "Frozen2",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9222200003",
      email: "frozen2@example.com",
      suspended: true,
    });
    const drv = await checkAdminSuspension(admin._id, "driver");
    const stu = await checkAdminSuspension(admin._id, "student");
    assert.match(drv!, /admin/);
    assert.equal(drv, stu);
    assert.doesNotMatch(drv!, /Jeevan/);
  });

  it("checkCollegeAdminSuspension resolves through the college doc", async () => {
    const admin = await AdminModel.create({
      adminId: "AD203",
      name: "Owner",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9222200004",
      email: "owner@example.com",
      suspended: true,
    });
    const college = await CollegeModel.create({
      admin: admin._id,
      name: "C",
      address: "A",
      code: "C1",
      busCount: 1,
      driverCount: 1,
    });
    const msg = await checkCollegeAdminSuspension(college._id, "student");
    assert.ok(msg);
  });

  it("treats a missing/dangling admin ref as not-suspended", async () => {
    const msg = await checkAdminSuspension(new Types.ObjectId(), "admin");
    assert.equal(msg, null);
  });
});
