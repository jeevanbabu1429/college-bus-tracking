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

async function seedBusWithDriver(
  collegeId: unknown,
  n: number,
  opts: {
    issue?: { type: string; message: string; reportedAt: Date } | null;
    tripActive?: boolean;
  } = {}
) {
  const driver = await DriverModel.create({
    college: collegeId,
    name: `Driver ${n}`,
    dob: new Date("1980-01-01"),
    gender: "male",
    licenceNumber: `LIC00${n}`,
    aadharNumber: `12341234123${n}`,
    mobile: `92000000${String(n).padStart(2, "0")}`,
    address: "Depot",
    tripActive: opts.tripActive ?? false,
    currentIssue: opts.issue ?? null,
  });
  const bus = await BusModel.create({
    college: collegeId,
    busNumber: `B${n}`,
    plateNumber: `TN01AA000${n}`,
    capacity: 40,
    driver: driver._id,
    route: `Route ${n}`,
  });
  return { driver, bus };
}

function get(app: Express, collegeId: unknown, token: string) {
  return request(app)
    .get(`/api/colleges/${collegeId}/buses/issues`)
    .set("Authorization", `Bearer ${token}`);
}

describe("bus issues for the admin dashboard", () => {
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

  it("is empty when nothing is wrong", async () => {
    const { college, token } = await seedCollege("AAA");
    await seedBusWithDriver(college._id, 1);

    const res = await get(app, college._id, token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns the bus, the driver and the issue", async () => {
    const { college, token } = await seedCollege("AAA");
    const { bus } = await seedBusWithDriver(college._id, 1, {
      tripActive: true,
      issue: {
        type: "breakdown",
        message: "Engine trouble",
        reportedAt: new Date(),
      },
    });

    const res = await get(app, college._id, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);

    const item = res.body[0];
    assert.equal(item.bus._id, String(bus._id));
    assert.equal(item.bus.busNumber, "B1");
    assert.equal(item.driver.name, "Driver 1");
    assert.equal(item.driver.mobile, "9200000001");
    assert.equal(item.driver.licenceNumber, "LIC001");
    assert.equal(item.driver.tripActive, true);
    assert.equal(item.issue.type, "breakdown");
    assert.equal(item.issue.message, "Engine trouble");
  });

  it("still lists a bus whose driver ended the trip", async () => {
    // The reason this endpoint exists rather than reusing /live: currentIssue
    // is not cleared when a trip stops, and a bus that broke down and came off
    // the road is exactly the one the admin needs to see.
    const { college, token } = await seedCollege("AAA");
    await seedBusWithDriver(college._id, 1, {
      tripActive: false,
      issue: { type: "breakdown", message: "", reportedAt: new Date() },
    });

    const res = await get(app, college._id, token);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].driver.tripActive, false);
  });

  it("counts the students stranded by each one", async () => {
    const { college, token } = await seedCollege("AAA");
    const { bus } = await seedBusWithDriver(college._id, 1, {
      issue: { type: "flat_tyre", message: "", reportedAt: new Date() },
    });
    for (let i = 0; i < 3; i += 1) {
      await StudentModel.create({
        college: college._id,
        name: `Student ${i}`,
        rollNumber: `R${i}`,
        gender: "male",
        dob: new Date("2005-01-01"),
        address: "Home",
        mobile: `9300000${String(i).padStart(3, "0")}`,
        bus: bus._id,
      });
    }

    const res = await get(app, college._id, token);
    assert.equal(res.body[0].studentCount, 3);
  });

  it("puts the longest-running issue first", async () => {
    const { college, token } = await seedCollege("AAA");
    await seedBusWithDriver(college._id, 1, {
      issue: {
        type: "traffic",
        message: "recent",
        reportedAt: new Date(Date.now() - 60_000),
      },
    });
    await seedBusWithDriver(college._id, 2, {
      issue: {
        type: "breakdown",
        message: "oldest",
        reportedAt: new Date(Date.now() - 3_600_000),
      },
    });

    const res = await get(app, college._id, token);
    assert.deepEqual(
      res.body.map((i: { issue: { message: string } }) => i.issue.message),
      ["oldest", "recent"]
    );
  });

  it("never shows another college's breakdowns", async () => {
    const a = await seedCollege("AAA");
    const b = await seedCollege("BBB");
    await seedBusWithDriver(a.college._id, 1, {
      issue: { type: "breakdown", message: "mine", reportedAt: new Date() },
    });
    await seedBusWithDriver(b.college._id, 2, {
      issue: { type: "breakdown", message: "theirs", reportedAt: new Date() },
    });

    const res = await get(app, a.college._id, a.token);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].issue.message, "mine");
  });

  it("skips a driver with an issue but no bus assigned", async () => {
    const { college, token } = await seedCollege("AAA");
    await DriverModel.create({
      college: college._id,
      name: "Spare Driver",
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: "LIC999",
      aadharNumber: "123412349999",
      mobile: "9299999999",
      address: "Depot",
      currentIssue: { type: "other", message: "x", reportedAt: new Date() },
    });

    const res = await get(app, college._id, token);
    assert.deepEqual(res.body, []);
  });

  it("rejects an anonymous caller", async () => {
    const { college } = await seedCollege("AAA");
    const res = await request(app).get(
      `/api/colleges/${college._id}/buses/issues`
    );
    assert.equal(res.status, 401);
  });
});
