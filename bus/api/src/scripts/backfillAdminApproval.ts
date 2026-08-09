/**
 * One-off migration: give every pre-existing admin an explicit
 * `approved: true`.
 *
 * The approval gate reads `approved === false`, so admins created before the
 * field existed (no stored value) already keep working untouched — this script
 * is about tidiness, not rescue. Running it means every row states its status
 * explicitly instead of relying on absence, which makes the super admin list
 * and any future query straightforward.
 *
 * Only rows where the field is genuinely missing are touched. An admin the
 * super admin has deliberately left unapproved has a stored `false` and is
 * skipped, so this can never silently approve a pending signup.
 *
 * Idempotent — a second run reports 0 updated.
 *
 * Run from the api/ directory:  npx tsx src/scripts/backfillAdminApproval.ts
 */
import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const admins = mongoose.connection.collection("admins");

  const missing = await admins.countDocuments({ approved: { $exists: false } });
  const pending = await admins.countDocuments({ approved: false });
  const approved = await admins.countDocuments({ approved: true });
  console.log(
    `Before: ${missing} without the field, ${pending} pending, ${approved} approved`
  );

  if (missing === 0) {
    console.log("Nothing to backfill.");
    await mongoose.disconnect();
    return;
  }

  const result = await admins.updateMany(
    { approved: { $exists: false } },
    { $set: { approved: true, approvedAt: new Date() } }
  );
  console.log(`Updated ${result.modifiedCount} legacy admin(s) to approved.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
