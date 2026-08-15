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

async function seedDriver() {
  const admin = await AdminModel.create({
    adminId: "AD001",
    name: "Owner",
    gender: "male",
    dob: new Date("1985-01-01"),
    mobile: "9000000010",
    email: "owner@example.com",
  });
  const college = await CollegeModel.create({
    admin: admin._id,
    name: "Green Valley Institute",
    address: "12 Anna Salai, Chennai",
    code: "GVI",
    busCount: 2,
    driverCount: 2,
  });
  const driver = await DriverModel.create({
    college: college._id,
    name: "Driver Dan",
    dob: new Date("1980-01-01"),
    gender: "male",
    licenceNumber: "LIC001",
    aadharNumber: "123412341234",
    mobile: "9000000020",
    address: "Depot",
  });
  return { college, driver };
}

describe("driver sees their college", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  it("returns the college on the driver's own profile", async () => {
    const { college, driver } = await seedDriver();
    const token = jwt.sign(
      { role: "driver", sub: driver.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/driver-auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.collegeInfo._id, String(college._id));
    assert.equal(res.body.collegeInfo.name, "Green Valley Institute");
    assert.equal(res.body.collegeInfo.code, "GVI");
    assert.equal(res.body.collegeInfo.address, "12 Anna Salai, Chennai");
  });

  it("keeps `college` as the raw id alongside it", async () => {
    // The admin-facing driver payloads share a type with this one on the
    // client and use `college` as an id, so the new field sits beside it
    // rather than replacing it.
    const { college, driver } = await seedDriver();
    const token = jwt.sign(
      { role: "driver", sub: driver.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/driver-auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(String(res.body.college), String(college._id));
  });

  it("returns it on sign-in too", async () => {
    const { driver } = await seedDriver();
    await request(app)
      .post("/api/driver-auth/request-otp")
      .send({ mobile: driver.mobile });

    // generateOtp is fixed at 0000 outside production.
    const res = await request(app)
      .post("/api/driver-auth/verify-otp")
      .send({ mobile: driver.mobile, otp: "0000" });

    assert.equal(res.status, 200);
    assert.equal(res.body.driver.collegeInfo.name, "Green Valley Institute");
  });

  it("is null rather than an error when the college is gone", async () => {
    const { college, driver } = await seedDriver();
    await CollegeModel.deleteOne({ _id: college._id });
    const token = jwt.sign(
      { role: "driver", sub: driver.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/driver-auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.collegeInfo, null);
  });
});
