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
import { seedSuperAdmin } from "../../src/seed.js";
import { SuperAdminModel } from "../../src/models/SuperAdmin.js";
import { updateAction, compareVersions } from "../../src/lib/appVersion.js";

describe("app version gate", () => {
  let app: Express;
  let token: string;

  before(async () => {
    await startTestDb();
    app = await buildApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    await seedSuperAdmin();
    // Signed directly rather than through /login: the login route rate-limits
    // by IP, and every test in this file would share one.
    const superAdmin = await SuperAdminModel.findOne();
    token = jwt.sign(
      { role: "super", sub: String(superAdmin?._id) },
      process.env.JWT_SECRET as string
    );
  });

  const save = (body: Record<string, string>) =>
    request(app)
      .put("/api/super/app-versions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const check = (platform: string, version: string) =>
    request(app).get(
      `/api/app-version?platform=${platform}&version=${version}`
    );

  it("compares versions part by part", () => {
    assert.equal(compareVersions("1.0.10", "1.0.9"), 1);
    assert.equal(compareVersions("1.2", "1.2.0"), 0);
    assert.equal(compareVersions("1.0.4", "1.1"), -1);
  });

  it("decides what the app should do", () => {
    assert.equal(updateAction("1.0.5", "1.0.5", "1.0.3"), "none");
    assert.equal(updateAction("1.0.6", "1.0.5", "1.0.3"), "none");
    assert.equal(updateAction("1.0.4", "1.0.5", "1.0.3"), "optional");
    assert.equal(updateAction("1.0.2", "1.0.5", "1.0.3"), "required");
    // Nothing configured, or a version the phone could not report.
    assert.equal(updateAction("1.0.2", "", ""), "none");
    assert.equal(updateAction("", "1.0.5", "1.0.3"), "none");
  });

  it("asks nothing of the app until versions are saved", async () => {
    const res = await check("android", "1.0.0");
    assert.equal(res.status, 200);
    assert.equal(res.body.action, "none");
  });

  it("offers a skippable update below the latest version", async () => {
    await save({ androidLatest: "1.0.5", androidMinimum: "1.0.3" });
    const res = await check("android", "1.0.4");
    assert.equal(res.body.action, "optional");
    assert.equal(res.body.latest, "1.0.5");
  });

  it("forces an update below the minimum version", async () => {
    await save({ androidLatest: "1.0.5", androidMinimum: "1.0.3" });
    const res = await check("android", "1.0.2");
    assert.equal(res.body.action, "required");
  });

  it("keeps the two platforms apart", async () => {
    await save({ androidLatest: "2.0.0", iosLatest: "1.0.5" });
    assert.equal((await check("ios", "1.0.5")).body.action, "none");
    assert.equal((await check("android", "1.0.5")).body.action, "optional");
  });

  it("says nothing for a platform it does not know", async () => {
    await save({ androidLatest: "2.0.0", androidMinimum: "2.0.0" });
    const res = await check("windows", "1.0.0");
    assert.equal(res.body.action, "none");
  });

  it("refuses a version that is not a version", async () => {
    const res = await save({ androidLatest: "latest" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /1\.0\.5/);
  });

  it("refuses a minimum newer than the latest version", async () => {
    const res = await save({ androidLatest: "1.0.5", androidMinimum: "1.1.0" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /locked out/i);
  });

  it("switches the check off again when a box is cleared", async () => {
    await save({ androidLatest: "1.0.5", androidMinimum: "1.0.5" });
    assert.equal((await check("android", "1.0.4")).body.action, "required");
    await save({ androidLatest: "", androidMinimum: "" });
    assert.equal((await check("android", "1.0.4")).body.action, "none");
  });

  it("keeps the settings to the super admin", async () => {
    assert.equal((await request(app).get("/api/super/app-versions")).status, 401);
    assert.equal(
      (await request(app).put("/api/super/app-versions").send({ iosLatest: "9.9.9" }))
        .status,
      401
    );
  });

  it("reads back what was saved", async () => {
    await save({
      androidLatest: "1.0.5",
      androidMinimum: "1.0.3",
      iosLatest: "1.0.6",
      iosMinimum: "1.0.2",
    });
    const res = await request(app)
      .get("/api/super/app-versions")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      {
        androidLatest: res.body.androidLatest,
        androidMinimum: res.body.androidMinimum,
        iosLatest: res.body.iosLatest,
        iosMinimum: res.body.iosMinimum,
      },
      {
        androidLatest: "1.0.5",
        androidMinimum: "1.0.3",
        iosLatest: "1.0.6",
        iosMinimum: "1.0.2",
      }
    );
  });
});
