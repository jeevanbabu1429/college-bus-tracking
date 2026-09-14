import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { buildApp, startTestDb, stopTestDb } from "../helpers/testEnv.js";
import { AdminModel } from "../../src/models/Admin.js";
import { CollegeModel } from "../../src/models/College.js";
import { DriverModel } from "../../src/models/Driver.js";
import { BusModel } from "../../src/models/Bus.js";
import { StudentModel } from "../../src/models/Student.js";

// Quality-of-errors suite: what a person sees when something goes wrong.
//
// Every failure a client can show must come back quickly, as JSON, in plain
// English — never a hung request, a crashed process, an HTML page, or a
// database/driver message such as "Cast to date failed" or "E11000".
// Test names carry the case IDs used in docs/Test-Report.docx.

// An async route that throws is not caught by Express 4. The request hangs and,
// outside the test runner, Node exits the process on the unhandled rejection.
const unhandled: string[] = [];
const onUnhandled = (e: unknown) =>
  unhandled.push(String((e as Error)?.message ?? e));

const TECHNICAL = [
  /cast to \w+ failed/i,
  /validation failed/i,
  /E11000/,
  /duplicate key/i,
  /unexpected (token|end)/i,
  /JSON/,
  /entity too large/i,
  /ObjectId/i,
  /\bat path\b/i,
  /\bundefined\b|\bnull\b/,
  // Code identifiers leaking into sentences: plateNumber, aadharNumber, toBusId
  /\b[a-z]+[A-Z][A-Za-z]*\b/,
  /\b[a-z]+_[a-z_]+\b/,
];

type Res = { status: number; headers: Record<string, string>; body: unknown };

function assertFriendly(res: Res, expectStatus?: number) {
  assert.ok(res.status < 500, `server error ${res.status}`);
  if (expectStatus) assert.equal(res.status, expectStatus);
  assert.match(
    String(res.headers["content-type"] ?? ""),
    /json/,
    "error response is not JSON"
  );
  const msg = (res.body as { error?: unknown })?.error;
  assert.equal(typeof msg, "string", "no error message in body");
  for (const re of TECHNICAL) {
    assert.doesNotMatch(msg as string, re, `technical wording: "${msg}"`);
  }
}

const TIMEOUT = 4000;

describe("error handling and messages", () => {
  let app: Express;
  let C: string;
  let tAdmin: string;
  let tDriver: string;
  let busId: string;
  let studentId: string;

  before(async () => {
    process.on("unhandledRejection", onUnhandled);
    await startTestDb();
    app = await buildApp();
    // Unique indexes build in the background; duplicate checks need them now.
    await Promise.all(
      [AdminModel, CollegeModel, DriverModel, BusModel, StudentModel].map((m) =>
        m.init()
      )
    );
    const S = process.env.JWT_SECRET as string;
    const admin = await AdminModel.create({
      adminId: "AD001",
      name: "Owner",
      gender: "male",
      dob: new Date("1985-01-01"),
      mobile: "9000000011",
      email: "owner@example.com",
      approved: true,
    });
    const college = await CollegeModel.create({
      admin: admin._id,
      name: "College",
      address: "Road",
      code: "C1",
      busCount: 2,
      driverCount: 2,
      approved: true,
    });
    const driver = await DriverModel.create({
      college: college._id,
      name: "Ravi",
      dob: new Date("1980-01-01"),
      gender: "male",
      licenceNumber: "LIC1",
      aadharNumber: "123412341234",
      mobile: "9200000001",
      address: "Depot",
    });
    const bus = await BusModel.create({
      college: college._id,
      busNumber: "21",
      plateNumber: "TN01AA0001",
      capacity: 40,
      driver: driver._id,
      route: "Tambaram",
    });
    const student = await StudentModel.create({
      college: college._id,
      name: "Ananya",
      rollNumber: "R1",
      mobile: "9300000001",
      gender: "female",
      dob: new Date("2004-01-01"),
      address: "Guindy",
      bus: bus._id,
    });
    C = `/api/colleges/${college.id}`;
    busId = bus.id;
    studentId = student.id;
    tAdmin = jwt.sign({ adminId: admin.adminId, sub: admin.id }, S);
    tDriver = jwt.sign({ role: "driver", sub: driver.id }, S);
  });

  after(async () => {
    process.off("unhandledRejection", onUnhandled);
    await stopTestDb();
  });

  const student = {
    name: "Kavya",
    rollNumber: "R2",
    gender: "female",
    address: "Chromepet",
    mobile: "9300000002",
    dob: "2004-02-02",
  };
  const driverBody = {
    name: "Mani",
    gender: "male",
    licenceNumber: "LIC2",
    aadharNumber: "123412341299",
    mobile: "9200000002",
    address: "Depot",
    dob: "1981-01-01",
  };

  // ── General ────────────────────────────────────────────────────────────
  it("API-01 health check answers", async () => {
    const res = await request(app).get("/health").timeout(TIMEOUT);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });

  it("API-02 unknown API address returns a JSON 404, not an HTML page", async () => {
    const res = await request(app).get("/api/does-not-exist").timeout(TIMEOUT);
    assertFriendly(res, 404);
  });

  it("API-03 broken JSON body gets a plain-English message", async () => {
    const res = await request(app)
      .post("/api/auth/request-otp")
      .set("Content-Type", "application/json")
      .send('{"mobile": ')
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-04 upload larger than the limit gets a plain-English message", async () => {
    const res = await request(app)
      .post(`${C}/buses`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ blob: "a".repeat(11 * 1024 * 1024) })
      .timeout(10000);
    assertFriendly(res, 413);
  });

  it("API-05 expired or invalid sign-in token gets 401 with a message", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.token")
      .timeout(TIMEOUT);
    assertFriendly(res, 401);
  });

  // ── Requests that used to hang the server ─────────────────────────────
  it("API-06 driver OTP request with a malformed mobile answers (no hang)", async () => {
    const res = await request(app)
      .post("/api/driver-auth/request-otp")
      .send({ mobile: { a: 1 } })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-07 student OTP request with a malformed mobile answers (no hang)", async () => {
    const res = await request(app)
      .post("/api/student-auth/request-otp")
      .send({ mobile: { a: 1 } })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-08 admin OTP verify with a malformed mobile answers (no hang)", async () => {
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: { a: 1 }, otp: "0000" })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-09 college registration with an invalid date of birth answers", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "New Owner",
        gender: "male",
        dob: "31-31-1990",
        mobile: "9000000099",
        email: "new@example.com",
      })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-10 add student with an invalid date of birth answers", async () => {
    const res = await request(app)
      .post(`${C}/students`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ ...student, dob: "not a date" })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-11 edit student with an invalid date of birth answers", async () => {
    const res = await request(app)
      .put(`${C}/students/${studentId}`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ ...student, mobile: "9300000001", dob: "not a date" })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-12 add driver with an invalid date of birth answers", async () => {
    const res = await request(app)
      .post(`${C}/drivers`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ ...driverBody, dob: "not a date" })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  it("API-13 add bus with a malformed plate number answers", async () => {
    const res = await request(app)
      .post(`${C}/buses`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ busNumber: "22", plateNumber: { a: 1 }, capacity: 40 })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  // ── Messages people actually see ──────────────────────────────────────
  it("API-14 duplicate student mobile says so in plain English", async () => {
    const res = await request(app)
      .post(`${C}/students`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ ...student, mobile: "9300000001" })
      .timeout(TIMEOUT);
    assertFriendly(res, 409);
  });

  it("API-15 duplicate bus plate number says so in plain English", async () => {
    const res = await request(app)
      .post(`${C}/buses`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ busNumber: "23", plateNumber: "TN01AA0001", capacity: 40 })
      .timeout(TIMEOUT);
    assertFriendly(res, 409);
  });

  it("API-16 bulk driver import: duplicate row message is plain English", async () => {
    const res = await request(app)
      .post(`${C}/drivers/bulk`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ drivers: [{ ...driverBody, mobile: "9200000001" }] })
      .timeout(TIMEOUT);
    assert.equal(res.status, 201);
    const failed = res.body.failed as { error: string }[];
    assert.equal(failed.length, 1);
    assertFriendly({ ...res, status: 400, body: { error: failed[0].error } });
  });

  it("API-17 bulk student import: missing date of birth message is plain English", async () => {
    const { dob: _dob, ...noDob } = student;
    const res = await request(app)
      .post(`${C}/students/bulk`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ students: [noDob] })
      .timeout(TIMEOUT);
    assert.equal(res.status, 201);
    const failed = res.body.failed as { error: string }[];
    assertFriendly({ ...res, status: 400, body: { error: failed[0].error } });
  });

  it("API-18 driver issue with an unknown type does not list internal codes", async () => {
    const res = await request(app)
      .post("/api/driver/trip/issue")
      .set("Authorization", `Bearer ${tDriver}`)
      .send({ type: "volcano" })
      .timeout(TIMEOUT);
    assertFriendly(res, 400);
  });

  // ── Data checks ───────────────────────────────────────────────────────
  it("API-19 add student rejects a mobile number that is not 10 digits", async () => {
    const res = await request(app)
      .post(`${C}/students`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ ...student, rollNumber: "R19", mobile: "12" })
      .timeout(TIMEOUT);
    assert.equal(res.status, 400);
  });

  it("API-20 route stop with an impossible position (lat 200) is not saved", async () => {
    const res = await request(app)
      .put(`${C}/buses/${busId}/route`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .send({ route: "Tambaram", stops: [{ name: "Guindy", lat: 200, lng: 500 }] })
      .timeout(TIMEOUT);
    const saved = res.body?.stops?.[0];
    assert.ok(
      res.status === 400 || (saved && saved.lat === null),
      `saved stop at lat ${saved?.lat}`
    );
  });

  it("API-21 driver location outside the real world (lat 999) is rejected", async () => {
    await request(app)
      .post("/api/driver/trip/start")
      .set("Authorization", `Bearer ${tDriver}`)
      .timeout(TIMEOUT);
    const res = await request(app)
      .post("/api/driver/trip/location")
      .set("Authorization", `Bearer ${tDriver}`)
      .send({ lat: 999, lng: 999 })
      .timeout(TIMEOUT);
    assert.equal(res.status, 400);
  });

  // ── Security ──────────────────────────────────────────────────────────
  it("API-22 a query object instead of a mobile number matches no account", async () => {
    const res = await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: { $gt: "" } })
      .timeout(TIMEOUT);
    assert.equal(res.status, 400);
  });

  it("API-23 driver list never includes a driver's live login code", async () => {
    await request(app)
      .post("/api/driver-auth/request-otp")
      .send({ mobile: "9200000001" })
      .timeout(TIMEOUT);
    const res = await request(app)
      .get(`${C}/drivers`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .timeout(TIMEOUT);
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.doesNotMatch(text, /"otp"\s*:\s*"\d+"/, "driver OTP is exposed");
  });

  it("API-24 student list never includes a student's live login code", async () => {
    await request(app)
      .post("/api/student-auth/request-otp")
      .send({ mobile: "9300000001" })
      .timeout(TIMEOUT);
    const res = await request(app)
      .get(`${C}/students`)
      .set("Authorization", `Bearer ${tAdmin}`)
      .timeout(TIMEOUT);
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.doesNotMatch(text, /"otp"\s*:\s*"\d+"/, "student OTP is exposed");
  });

  // ── Happy paths still work ────────────────────────────────────────────
  it("API-25 normal admin OTP sign-in still works", async () => {
    const r1 = await request(app)
      .post("/api/auth/request-otp")
      .send({ mobile: "9000000011" })
      .timeout(TIMEOUT);
    assert.equal(r1.status, 200);
    const r2 = await request(app)
      .post("/api/auth/verify-otp")
      .send({ mobile: "9000000011", otp: "0000" })
      .timeout(TIMEOUT);
    assert.equal(r2.status, 200);
    assert.equal(typeof r2.body.token, "string");
  });

  // Runs last: every bad request above must have been answered, not dropped.
  it("API-26 no request above left an unhandled error behind (server would crash)", async () => {
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(unhandled, [], `unhandled errors:\n${unhandled.join("\n")}`);
  });
});
