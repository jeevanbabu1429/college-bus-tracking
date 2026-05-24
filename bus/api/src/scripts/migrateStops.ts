/**
 * One-off migration: convert Bus.stops from string[] to the new object shape
 * [{ name, lat, lng, suspended }], and ensure every bus has a `notice` field.
 *
 * Safe to run multiple times (idempotent): buses already in the new shape are
 * skipped. Reads/writes via the raw collection so Mongoose schema casting does
 * not choke on legacy string entries.
 *
 * Run from the api/ directory:  npx tsx src/scripts/migrateStops.ts
 */
import "dotenv/config";
import mongoose from "mongoose";

type LegacyStop = string | { name?: unknown; lat?: unknown; lng?: unknown; suspended?: unknown };

function normalizeStop(stop: LegacyStop) {
  if (typeof stop === "string") {
    return { name: stop.trim(), lat: null, lng: null, suspended: false };
  }
  return {
    name: typeof stop?.name === "string" ? stop.name.trim() : "",
    lat: typeof stop?.lat === "number" ? stop.lat : null,
    lng: typeof stop?.lng === "number" ? stop.lng : null,
    suspended: stop?.suspended === true,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  const buses = mongoose.connection.collection("buses");

  const docs = await buses.find({}).toArray();
  let migrated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const stops: LegacyStop[] = Array.isArray(doc.stops) ? doc.stops : [];
    const hasLegacyStop = stops.some((s) => typeof s === "string");
    const missingNotice = typeof doc.notice !== "string";

    if (!hasLegacyStop && !missingNotice) {
      skipped++;
      continue;
    }

    const normalized = stops
      .map(normalizeStop)
      .filter((s) => s.name.length > 0);

    await buses.updateOne(
      { _id: doc._id },
      {
        $set: {
          stops: normalized,
          ...(missingNotice ? { notice: "" } : {}),
        },
      }
    );
    migrated++;
    console.log(`  migrated bus ${doc.busNumber ?? doc._id} (${normalized.length} stops)`);
  }

  console.log(`\nDone. Migrated ${migrated}, already up-to-date ${skipped}, total ${docs.length}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
