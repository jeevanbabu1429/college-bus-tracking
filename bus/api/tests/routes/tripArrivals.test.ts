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

function driverToken(driverId: string): string {
  return jwt.sign(
    { role: "driver", sub: driverId },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

function studentToken(studentId: string): string {
  return jwt.sign(
    { role: "student", sub: studentId },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

async function seedRoute() {
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
      { name: "Stop B", lat: 13.0018, lng: 80.0 },
      { name: "Stop C", lat: 13.0036, lng: 80.0 },
    ],
  });
  const student = await StudentModel.create({
    college: college._id,
    name: "Sam",
    rollNumber: "R1",
    gender: "male",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: "9000000030",
    bus: bus._id,
    stop: "Stop B",
  });
  return { college, driver, bus, student };
}

describe("driver stop arrivals", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  function mark(token: string, stop: string, arrived: boolean) {
    return request(app)
      .post("/api/driver/trip/arrival")
      .set("authorization", `Bearer ${token}`)
      .send({ stop, arrived });
  }

  function start(token: string) {
    return request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`);
  }

  it("records an arrival while a trip is running", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const res = await mark(token, "Stop A", true);
    assert.equal(res.status, 200);
    assert.equal(res.body.stopArrivals.length, 1);
    assert.equal(res.body.stopArrivals[0].stop, "Stop A");
    assert.ok(res.body.stopArrivals[0].at, "arrival carries a timestamp");
  });

  it("refuses to mark anything before the trip starts", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);

    const res = await mark(token, "Stop A", true);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Start the trip/);

    const fresh = await DriverModel.findById(driver._id).lean();
    assert.equal(fresh?.stopArrivals.length, 0);
  });

  it("keeps the first timestamp when the same stop is marked twice", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const first = await mark(token, "Stop A", true);
    const firstAt = first.body.stopArrivals[0].at;
    await new Promise((r) => setTimeout(r, 15));
    const second = await mark(token, "Stop A", true);

    assert.equal(second.body.stopArrivals.length, 1);
    assert.equal(second.body.stopArrivals[0].at, firstAt);
  });

  it("undoes an arrival the driver marked by mistake", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);
    await mark(token, "Stop A", true);
    await mark(token, "Stop B", true);

    const res = await mark(token, "Stop A", false);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.stopArrivals.map((a: { stop: string }) => a.stop),
      ["Stop B"]
    );
  });

  it("undoing a stop that was never marked is a no-op, not an error", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const res = await mark(token, "Stop C", false);
    assert.equal(res.status, 200);
    assert.equal(res.body.stopArrivals.length, 0);
  });

  it("stores the route's own spelling of the stop name", async () => {
    // Whatever casing the client sends, what lands must equal a student's
    // `stop` value exactly — that string is how the two are matched up.
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const res = await mark(token, "  stop b  ", true);
    assert.equal(res.status, 200);
    assert.equal(res.body.stopArrivals[0].stop, "Stop B");
  });

  it("rejects a stop that is not on this bus's route", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const res = await mark(token, "Some Other Place", true);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not on this bus/);
  });

  it("validates the payload", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const noStop = await request(app)
      .post("/api/driver/trip/arrival")
      .set("authorization", `Bearer ${token}`)
      .send({ arrived: true });
    assert.equal(noStop.status, 400);

    const badFlag = await mark(token, "Stop A", "yes" as unknown as boolean);
    assert.equal(badFlag.status, 400);

    const anon = await request(app)
      .post("/api/driver/trip/arrival")
      .send({ stop: "Stop A", arrived: true });
    assert.equal(anon.status, 401);
  });

  it("clears arrivals when a trip starts and when it stops", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);
    await mark(token, "Stop A", true);

    await request(app)
      .post("/api/driver/trip/stop")
      .set("authorization", `Bearer ${token}`);
    let fresh = await DriverModel.findById(driver._id).lean();
    assert.equal(fresh?.stopArrivals.length, 0, "cleared on stop");

    await start(token);
    await mark(token, "Stop A", true);
    await start(token);
    fresh = await DriverModel.findById(driver._id).lean();
    assert.equal(fresh?.stopArrivals.length, 0, "cleared on the next start");
  });

  it("reports arrivals back on the driver's own status", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);
    await mark(token, "Stop B", true);

    const res = await request(app)
      .get("/api/driver/trip/status")
      .set("authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.stopArrivals.length, 1);
    assert.equal(res.body.stopArrivals[0].stop, "Stop B");
  });

  it("shows the arrivals to the students on that bus", async () => {
    const { driver, student } = await seedRoute();
    const dToken = driverToken(driver.id);
    await start(dToken);
    await mark(dToken, "Stop A", true);

    const res = await request(app)
      .get("/api/student-auth/bus-location")
      .set("authorization", `Bearer ${studentToken(student.id)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.stopArrivals.map((a: { stop: string }) => a.stop),
      ["Stop A"]
    );
  });

  it("shows the arrivals on the live-buses list too", async () => {
    const { driver, student } = await seedRoute();
    const dToken = driverToken(driver.id);
    await start(dToken);
    await mark(dToken, "Stop A", true);

    const res = await request(app)
      .get("/api/student-auth/live-buses")
      .set("authorization", `Bearer ${studentToken(student.id)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.deepEqual(
      res.body[0].driver.stopArrivals.map((a: { stop: string }) => a.stop),
      ["Stop A"]
    );
  });

  it("a student sees no arrivals once the trip ends", async () => {
    const { driver, student } = await seedRoute();
    const dToken = driverToken(driver.id);
    await start(dToken);
    await mark(dToken, "Stop A", true);
    await request(app)
      .post("/api/driver/trip/stop")
      .set("authorization", `Bearer ${dToken}`);

    const res = await request(app)
      .get("/api/student-auth/bus-location")
      .set("authorization", `Bearer ${studentToken(student.id)}`);
    assert.equal(res.body.stopArrivals.length, 0);
  });

  it("keeps one driver's arrivals off another driver's bus", async () => {
    const { college, bus } = await seedRoute();
    const other = await DriverModel.create({
      college: college._id,
      name: "Driver Dee",
      dob: new Date("1981-01-01"),
      gender: "female",
      licenceNumber: "LIC002",
      aadharNumber: "123412341235",
      mobile: "9000000021",
      address: "Depot",
    });
    const token = driverToken(other.id);
    await start(token);

    // This driver has no bus, so no route to match a stop against.
    const res = await mark(token, "Stop A", true);
    assert.equal(res.status, 404);
    assert.match(res.body.error, /No bus assigned/);

    const busStillMine = await BusModel.findById(bus._id).lean();
    assert.ok(busStillMine);
  });
});
