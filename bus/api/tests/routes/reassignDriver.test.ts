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

async function seedFleet() {
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

  async function mkDriver(n: number) {
    return DriverModel.create({
      college: college._id,
      name: `Driver ${n}`,
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: `LIC00${n}`,
      aadharNumber: `12341234123${n}`,
      mobile: `900000002${n}`,
      address: "Depot",
    });
  }
  async function mkBus(n: number, driver: unknown = null) {
    return BusModel.create({
      college: college._id,
      busNumber: `B${n}`,
      plateNumber: `TN01AA000${n}`,
      capacity: 40,
      driver,
    });
  }

  const d1 = await mkDriver(1);
  const d2 = await mkDriver(2);
  const d3 = await mkDriver(3);
  const b1 = await mkBus(1, d1._id);
  const b2 = await mkBus(2, d2._id);
  const b3 = await mkBus(3);

  const token = jwt.sign(
    { adminId: admin.adminId, sub: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { college, token, d1, d2, d3, b1, b2, b3 };
}

describe("POST /buses/reassign-driver", () => {
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
      .post(`/api/colleges/${collegeId}/buses/reassign-driver`)
      .set("Authorization", `Bearer ${token}`)
      .send(body as object);
  }

  it("swaps two drivers when both buses are occupied", async () => {
    const { college, token, d1, d2, b1, b2 } = await seedFleet();

    const res = await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: String(b2._id),
    });
    assert.equal(res.status, 200);

    const [after1, after2] = await Promise.all([
      BusModel.findById(b1._id).lean(),
      BusModel.findById(b2._id).lean(),
    ]);
    // d1 moved to b2, and b1 did not end up empty — d2 took the vacated seat.
    assert.equal(String(after2?.driver), String(d1._id));
    assert.equal(String(after1?.driver), String(d2._id));
  });

  it("moves onto an empty bus, leaving the origin empty", async () => {
    const { college, token, d1, b1, b3 } = await seedFleet();

    const res = await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: String(b3._id),
    });
    assert.equal(res.status, 200);

    const [after1, after3] = await Promise.all([
      BusModel.findById(b1._id).lean(),
      BusModel.findById(b3._id).lean(),
    ]);
    assert.equal(after1?.driver, null);
    assert.equal(String(after3?.driver), String(d1._id));
  });

  it("frees the sitting driver when the mover came from the pool", async () => {
    const { college, token, d3, d1, b1 } = await seedFleet();

    // d3 is unassigned; dropping it on b1 should push d1 back to the pool
    // rather than swapping (there is no origin bus to swap into).
    const res = await post(String(college._id), token, {
      driverId: String(d3._id),
      toBusId: String(b1._id),
    });
    assert.equal(res.status, 200);

    const after1 = await BusModel.findById(b1._id).lean();
    assert.equal(String(after1?.driver), String(d3._id));

    const stillAssigned = await BusModel.countDocuments({ driver: d1._id });
    assert.equal(stillAssigned, 0);
  });

  it("unassigns when toBusId is null", async () => {
    const { college, token, d1, b1 } = await seedFleet();

    const res = await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: null,
    });
    assert.equal(res.status, 200);

    const after1 = await BusModel.findById(b1._id).lean();
    assert.equal(after1?.driver, null);
  });

  it("is a no-op when the driver is already on that bus", async () => {
    const { college, token, d1, b1 } = await seedFleet();

    const res = await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: String(b1._id),
    });
    assert.equal(res.status, 200);

    const after1 = await BusModel.findById(b1._id).lean();
    assert.equal(String(after1?.driver), String(d1._id));
  });

  it("never leaves a driver on two buses at once", async () => {
    const { college, token, d1, d2, b1, b2, b3 } = await seedFleet();

    await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: String(b2._id),
    });
    await post(String(college._id), token, {
      driverId: String(d2._id),
      toBusId: String(b3._id),
    });

    const buses = await BusModel.find({ college: college._id }).lean();
    const assigned = buses.map((b) => b.driver).filter(Boolean).map(String);
    assert.equal(
      new Set(assigned).size,
      assigned.length,
      "the same driver appears on more than one bus"
    );
    void b1;
  });

  it("rejects a driver from another college", async () => {
    const { college, token, b1 } = await seedFleet();
    const other = await DriverModel.create({
      college: college._id,
      name: "Outsider",
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: "LICZZZ",
      aadharNumber: "999988887777",
      mobile: "9111111111",
      address: "Elsewhere",
    });
    await DriverModel.updateOne(
      { _id: other._id },
      { $set: { college: (await CollegeModel.create({
        admin: (await AdminModel.findOne({}))!._id,
        name: "Other College",
        address: "x",
        code: "OC1",
        busCount: 0,
        driverCount: 0,
      }))._id } }
    );

    const res = await post(String(college._id), token, {
      driverId: String(other._id),
      toBusId: String(b1._id),
    });
    assert.equal(res.status, 404);
  });

  it("validates its input", async () => {
    const { college, token, d1 } = await seedFleet();
    const bad = await post(String(college._id), token, { driverId: "nope" });
    assert.equal(bad.status, 400);

    const badBus = await post(String(college._id), token, {
      driverId: String(d1._id),
      toBusId: "not-an-id",
    });
    assert.equal(badBus.status, 400);
  });
});
