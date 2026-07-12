import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearDb,
  startTestDb,
  stopTestDb,
} from "../helpers/testEnv.js";
import { AdminModel } from "../../src/models/Admin.js";
import { CollegeModel } from "../../src/models/College.js";
import { BusModel } from "../../src/models/Bus.js";
import { DriverModel } from "../../src/models/Driver.js";
import { StudentModel } from "../../src/models/Student.js";
import {
  deleteAdminCascade,
  deleteCollegeCascade,
} from "../../src/lib/cascades.js";

async function seedFullCustomer() {
  const admin = await AdminModel.create({
    adminId: "AD100",
    name: "Cascade Test",
    gender: "male",
    dob: new Date("1980-01-01"),
    mobile: "9111100000",
    email: "cascade@example.com",
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: "Cascade College",
    address: "Somewhere",
    code: "CAS",
    busCount: 2,
    driverCount: 2,
  });
  const d1 = await DriverModel.create({
    college: college._id,
    name: "D1",
    dob: new Date("1975-01-01"),
    gender: "male",
    licenceNumber: "LICCAS1",
    aadharNumber: "111122223333",
    mobile: "9111100001",
    address: "A",
  });
  const d2 = await DriverModel.create({
    college: college._id,
    name: "D2",
    dob: new Date("1975-01-01"),
    gender: "female",
    licenceNumber: "LICCAS2",
    aadharNumber: "111122223334",
    mobile: "9111100002",
    address: "B",
  });
  await BusModel.create({
    college: college._id,
    busNumber: "CB1",
    plateNumber: "CAS0001",
    capacity: 40,
    driver: d1._id,
  });
  await BusModel.create({
    college: college._id,
    busNumber: "CB2",
    plateNumber: "CAS0002",
    capacity: 40,
    driver: d2._id,
  });
  await StudentModel.create({
    college: college._id,
    name: "Stu 1",
    rollNumber: "S1",
    gender: "male",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: "9111100010",
  });
  await StudentModel.create({
    college: college._id,
    name: "Stu 2",
    rollNumber: "S2",
    gender: "female",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: "9111100011",
  });
  return { admin, college };
}

describe("cascade deletes", () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(clearDb);

  it("deleteCollegeCascade wipes students, drivers, buses, then the college", async () => {
    const { college } = await seedFullCustomer();
    const result = await deleteCollegeCascade(college._id);
    assert.equal(result.students, 2);
    assert.equal(result.drivers, 2);
    assert.equal(result.buses, 2);
    assert.equal(await StudentModel.countDocuments({ college: college._id }), 0);
    assert.equal(await DriverModel.countDocuments({ college: college._id }), 0);
    assert.equal(await BusModel.countDocuments({ college: college._id }), 0);
    assert.equal(await CollegeModel.countDocuments({ _id: college._id }), 0);
  });

  it("deleteAdminCascade removes admin plus every downstream doc", async () => {
    const { admin } = await seedFullCustomer();
    const result = await deleteAdminCascade(admin._id);
    assert.equal(result.colleges, 1);
    assert.equal(result.students, 2);
    assert.equal(result.drivers, 2);
    assert.equal(result.buses, 2);
    assert.equal(await AdminModel.countDocuments({ _id: admin._id }), 0);
    assert.equal(await StudentModel.countDocuments(), 0);
    assert.equal(await DriverModel.countDocuments(), 0);
    assert.equal(await BusModel.countDocuments(), 0);
    assert.equal(await CollegeModel.countDocuments(), 0);
  });

  it("releases the partial-unique driver index before dropping drivers", async () => {
    // Re-using the same plate + driver combo would fail if the cascade left
    // a dangling index entry. This test proves the cascade cleans up first.
    const { admin, college } = await seedFullCustomer();
    await deleteCollegeCascade(college._id);
    const admin2 = await AdminModel.findById(admin._id).lean();
    assert.ok(admin2, "admin should still exist");
    const college2 = await CollegeModel.create({
      admin: admin._id,
      name: "Cascade College 2",
      address: "X",
      code: "CAS2",
      busCount: 1,
      driverCount: 1,
    });
    const d = await DriverModel.create({
      college: college2._id,
      name: "New Driver",
      dob: new Date("1970-01-01"),
      gender: "male",
      licenceNumber: "LICNEW1",
      aadharNumber: "444455556666",
      mobile: "9111100003",
      address: "New Depot",
    });
    // If the partial-unique index still holds a phantom entry this insert
    // will throw a duplicate-key error.
    const bus = await BusModel.create({
      college: college2._id,
      busNumber: "NB1",
      plateNumber: "NEW0001",
      capacity: 30,
      driver: d._id,
    });
    assert.ok(bus._id);
  });
});
