import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters } from "../../src/lib/geo.js";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    assert.equal(haversineMeters(13.0, 80.0, 13.0, 80.0), 0);
  });

  it("is symmetric", () => {
    const a = haversineMeters(13.0827, 80.2707, 12.9716, 77.5946);
    const b = haversineMeters(12.9716, 77.5946, 13.0827, 80.2707);
    assert.ok(Math.abs(a - b) < 1e-6);
  });

  it("matches known distance Chennai↔Bengaluru within 1%", () => {
    // Straight-line ~290 km between the two city centres.
    const d = haversineMeters(13.0827, 80.2707, 12.9716, 77.5946);
    const km = d / 1000;
    assert.ok(km > 285 && km < 295, `expected ~290km got ${km}`);
  });

  it("under 300m for a stop ~200m from the bus", () => {
    // Two lat/lng ~200m apart at 13°N. 0.0018° lat ≈ 200m.
    const d = haversineMeters(13.0, 80.0, 13.0018, 80.0);
    assert.ok(d > 190 && d < 210, `expected ~200m got ${d}`);
  });
});
