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

// Push delivery itself can't be asserted — Firebase is unconfigured in tests,
// so sendPush is a no-op. What IS observable is the dedup reservation the
// "one stop away" alert writes before sending: a student's id landing in
// notifiedStudentIds means that student was selected to be told. That set is
// the proxy these tests assert on, and it happens to cover the part most
// likely to be wrong — working out which stop comes next.
function driverToken(driverId: string): string {
  return jwt.sign(
    { role: "driver", sub: driverId },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

const STOPS = ["Alpha", "Bravo", "Charlie", "Delta"];

async function seedRoute(opts: { suspend?: string } = {}) {
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
    stops: STOPS.map((name, i) => ({
      name,
      lat: 13 + i * 0.002,
      lng: 80,
      suspended: opts.suspend === name,
    })),
  });
  // Rides from Charlie, the third stop — so it has a neighbour on both sides.
  const student = await StudentModel.create({
    college: college._id,
    name: "Sam",
    rollNumber: "R1",
    gender: "male",
    dob: new Date("2005-01-01"),
    address: "Home",
    mobile: "9000000030",
    bus: bus._id,
    stop: "Charlie",
  });
  return { admin, college, driver, bus, student };
}

describe("trip notifications", () => {
  let app: Express;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });
  after(stopTestDb);
  beforeEach(clearDb);

  function start(token: string) {
    return request(app)
      .post("/api/driver/trip/start")
      .set("authorization", `Bearer ${token}`);
  }
  function mark(token: string, stop: string) {
    return request(app)
      .post("/api/driver/trip/arrival")
      .set("authorization", `Bearer ${token}`)
      .send({ stop, arrived: true });
  }
  // The notification fires in the background after the response returns.
  async function settle() {
    await new Promise((r) => setTimeout(r, 120));
  }
  async function notified(driverId: unknown): Promise<string[]> {
    const d = await DriverModel.findById(driverId).select("notifiedStudentIds").lean();
    return (d?.notifiedStudentIds ?? []).map((id) => String(id));
  }

  it("alerts the next stop's students when the one before it is marked", async () => {
    const { driver, student } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    await mark(token, "Alpha"); // first mark, at the start of the line
    await settle();
    assert.deepEqual(
      await notified(driver._id),
      [],
      "Bravo is next, not Charlie — our student stays quiet"
    );

    await mark(token, "Bravo"); // Alpha -> Bravo, so Charlie is next
    await settle();
    assert.deepEqual(await notified(driver._id), [String(student._id)]);
  });

  it("works on the return run, where the route is driven backwards", async () => {
    // The evening trip covers the same stops in reverse. Charlie's neighbour
    // is now Delta, and reading "the stop before" off the array would alert
    // nobody at all.
    const { driver, student } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    await mark(token, "Delta"); // first mark, at the far end of the line
    await settle();
    assert.deepEqual(
      await notified(driver._id),
      [String(student._id)],
      "direction is unambiguous from an end stop"
    );
  });

  it("stays silent when the direction cannot be worked out", async () => {
    // A first mark in the middle of the line could be heading either way.
    // Guessing would tell the wrong half of the bus to get ready.
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    await mark(token, "Bravo");
    await settle();
    assert.deepEqual(await notified(driver._id), []);
  });

  it("does not alert students at a suspended stop", async () => {
    const { driver } = await seedRoute({ suspend: "Charlie" });
    const token = driverToken(driver.id);
    await start(token);

    await mark(token, "Alpha");
    await mark(token, "Bravo");
    await settle();
    assert.deepEqual(
      await notified(driver._id),
      [],
      "the bus is not stopping there today"
    );
  });

  it("alerts a student once per trip, not once per mark", async () => {
    const { driver, student } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    await mark(token, "Alpha");
    await mark(token, "Bravo");
    await settle();
    // Undo and re-mark: the driver corrected a mis-tap.
    await request(app)
      .post("/api/driver/trip/arrival")
      .set("authorization", `Bearer ${token}`)
      .send({ stop: "Bravo", arrived: false });
    await mark(token, "Bravo");
    await settle();

    assert.deepEqual(
      await notified(driver._id),
      [String(student._id)],
      "still exactly one reservation"
    );
  });

  it("clears the alert record so the next trip can alert again", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);
    await mark(token, "Alpha");
    await mark(token, "Bravo");
    await settle();

    await start(token); // a fresh trip
    assert.deepEqual(await notified(driver._id), []);
  });

  it("reports and resolves an issue without disturbing the trip", async () => {
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);
    await start(token);

    const reported = await request(app)
      .post("/api/driver/trip/issue")
      .set("authorization", `Bearer ${token}`)
      .send({ type: "breakdown", message: "Engine trouble near Bravo" });
    assert.equal(reported.status, 200);
    assert.equal(reported.body.currentIssue.type, "breakdown");

    const cleared = await request(app)
      .delete("/api/driver/trip/issue")
      .set("authorization", `Bearer ${token}`);
    assert.equal(cleared.status, 200);

    const fresh = await DriverModel.findById(driver._id).lean();
    assert.equal(fresh?.currentIssue, null);
  });

  it("clearing an issue that was never reported is a quiet no-op", async () => {
    // Guards the resolved-notification: a driver double-tapping "Mark
    // resolved" must not tell the whole bus twice that it is back on the road.
    const { driver } = await seedRoute();
    const token = driverToken(driver.id);

    const first = await request(app)
      .delete("/api/driver/trip/issue")
      .set("authorization", `Bearer ${token}`);
    assert.equal(first.status, 200);

    const fresh = await DriverModel.findById(driver._id).lean();
    assert.equal(fresh?.currentIssue ?? null, null);
  });
});
