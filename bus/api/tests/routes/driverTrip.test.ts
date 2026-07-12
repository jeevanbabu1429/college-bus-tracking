import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { Types } from "mongoose";
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

function driverToken(driverId: string): string {
  return jwt.sign(
    { role: "driver", sub: driverId },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

async function seedDriverWithBus() {
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
    name: "Test College",
    address: "123 Road",
    code: "TC1",
    busCount: 1,
    driverCount: 1,
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
  const bus = await BusModel.create({
    college: college._id,
    busNumber: "B1",
    plateNumber: "TN01AA0001",
    capacity: 40,
    driver: driver._id,
    route: "Central",
    stops: [
      { name: "Stop A", lat: 13.0, lng: 80.0 },
      { name: "Stop B", lat: 13.0018, lng: 80.0 }, // ~200m north of A
      { name: "Stop C", lat: 13.0036, lng: 80.0 }, // ~400m north of A
    ],
  });
  return { admin, college, driver, bus };
}

describe("driver trip endpoints", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  it("start marks tripActive=true and clears notifiedStudentIds", async () => {
    const { driver } = await seedDriverWithBus();
    await DriverModel.updateOne(
      { _id: driver._id },
      { $set: { notifiedStudentIds: [new Types.ObjectId()] } }
    );
    const token = driverToken(driver.id);
    const res = await request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    const fresh = await DriverModel.findById(driver._id);
    assert.equal(fresh?.tripActive, true);
    assert.equal(fresh?.notifiedStudentIds?.length, 0);
  });

  it("stop marks tripActive=false and clears notifiedStudentIds", async () => {
    const { driver } = await seedDriverWithBus();
    await DriverModel.updateOne(
      { _id: driver._id },
      { $set: { tripActive: true, notifiedStudentIds: [new Types.ObjectId()] } }
    );
    const token = driverToken(driver.id);
    await request(app)
      .post("/api/driver/trip/stop")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    const fresh = await DriverModel.findById(driver._id);
    assert.equal(fresh?.tripActive, false);
    assert.equal(fresh?.notifiedStudentIds?.length, 0);
  });

  it("rejects /location with 400 when trip is not active", async () => {
    const { driver } = await seedDriverWithBus();
    const token = driverToken(driver.id);
    const res = await request(app)
      .post("/api/driver/trip/location")
      .set("authorization", `Bearer ${token}`)
      .send({ lat: 13.0, lng: 80.0 });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not active/i);
  });

  it("stores current location when trip is active", async () => {
    const { driver } = await seedDriverWithBus();
    const token = driverToken(driver.id);
    await request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    const res = await request(app)
      .post("/api/driver/trip/location")
      .set("authorization", `Bearer ${token}`)
      .send({ lat: 13.5, lng: 80.5 });
    assert.equal(res.status, 200);
    const fresh = await DriverModel.findById(driver._id);
    assert.equal(fresh?.currentLocation?.lat, 13.5);
    assert.equal(fresh?.currentLocation?.lng, 80.5);
  });

  it("marks student notified when bus arrives near their previous stop", async () => {
    const { driver, bus, college } = await seedDriverWithBus();
    const student = await StudentModel.create({
      college: college._id,
      name: "Sam",
      rollNumber: "R001",
      gender: "male",
      dob: new Date("2005-01-01"),
      address: "Home",
      mobile: "9000000030",
      bus: bus._id,
      stop: "Stop C",
    });
    const token = driverToken(driver.id);
    await request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    // Send location at Stop B — that's the "previous stop" for Sam whose
    // stop is C. Should trigger the arriving-soon reservation.
    await request(app)
      .post("/api/driver/trip/location")
      .set("authorization", `Bearer ${token}`)
      .send({ lat: 13.0018, lng: 80.0 })
      .expect(200);
    // Give the fire-and-forget notify a moment to persist.
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await DriverModel.findById(driver._id);
    const ids = (fresh?.notifiedStudentIds ?? []).map(String);
    assert.ok(
      ids.includes(String(student._id)),
      `expected student ${student._id} in notifiedStudentIds, got ${ids.join()}`
    );
  });

  it("does not re-notify the same student twice", async () => {
    const { driver, bus, college } = await seedDriverWithBus();
    const student = await StudentModel.create({
      college: college._id,
      name: "Sam",
      rollNumber: "R001",
      gender: "male",
      dob: new Date("2005-01-01"),
      address: "Home",
      mobile: "9000000031",
      bus: bus._id,
      stop: "Stop C",
    });
    const token = driverToken(driver.id);
    await request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`);
    await request(app)
      .post("/api/driver/trip/location")
      .set("authorization", `Bearer ${token}`)
      .send({ lat: 13.0018, lng: 80.0 });
    await new Promise((r) => setTimeout(r, 30));
    await request(app)
      .post("/api/driver/trip/location")
      .set("authorization", `Bearer ${token}`)
      .send({ lat: 13.0018, lng: 80.0 });
    await new Promise((r) => setTimeout(r, 30));
    const fresh = await DriverModel.findById(driver._id);
    const matches = (fresh?.notifiedStudentIds ?? [])
      .map(String)
      .filter((id) => id === String(student._id));
    assert.equal(matches.length, 1);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/driver/trip/status");
    assert.equal(res.status, 401);
  });

  it("issue endpoint validates the type enum", async () => {
    const { driver } = await seedDriverWithBus();
    const token = driverToken(driver.id);
    const res = await request(app)
      .post("/api/driver/trip/issue")
      .set("authorization", `Bearer ${token}`)
      .send({ type: "not-a-real-type" });
    assert.equal(res.status, 400);
  });

  it("issue endpoint accepts a valid type", async () => {
    const { driver } = await seedDriverWithBus();
    const token = driverToken(driver.id);
    const res = await request(app)
      .post("/api/driver/trip/issue")
      .set("authorization", `Bearer ${token}`)
      .send({ type: "flat_tyre", message: "Front left" });
    assert.equal(res.status, 200);
    const fresh = await DriverModel.findById(driver._id);
    assert.equal(fresh?.currentIssue?.type, "flat_tyre");
    assert.equal(fresh?.currentIssue?.message, "Front left");
  });
});
