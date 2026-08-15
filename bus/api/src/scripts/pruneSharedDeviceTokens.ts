import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { AdminModel } from "../models/Admin.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";

/**
 * One-off repair for device tokens that ended up on more than one account.
 *
 * register-token used to only add a token to the caller and never take it off
 * whoever held it before, so a phone signed into several accounts accumulated
 * registrations under all of them — including across colleges, which meant one
 * admin's announcement buzzed another college's students. The route now hands
 * the token over on every sign-in, but rows written before that fix still hold
 * the duplicates.
 *
 * Only tokens held by MORE THAN ONE account are removed, and they are removed
 * from everyone: there is no per-token timestamp, so there is no honest way to
 * tell which account the phone actually belongs to now. Guessing risks
 * silencing the rightful owner, whereas clearing an ambiguous token costs
 * nothing — the app re-registers on its next launch, and that write now
 * establishes sole ownership.
 *
 * Tokens held by exactly one account are left completely alone.
 *
 * Run:  npx tsx src/scripts/pruneSharedDeviceTokens.ts [--dry-run]
 * with MONGODB_URI pointing at the database you mean to repair.
 */

// The three models share only the one field this script touches, and calling
// a method on their union is not expressible in TypeScript. Narrowing them to
// that field is both accurate and enough.
type TokenHolder = { _id: unknown; fcmTokens?: string[] };
type TokenModel = mongoose.Model<TokenHolder>;

const MODELS: { name: string; model: TokenModel }[] = [
  { name: "admins", model: AdminModel as unknown as TokenModel },
  { name: "drivers", model: DriverModel as unknown as TokenModel },
  { name: "students", model: StudentModel as unknown as TokenModel },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Refusing to guess a database.");
    process.exit(1);
  }

  await connectDB(uri);
  console.log(`Connected to ${mongoose.connection.name}`);

  // token -> "collection:id" list of everyone currently holding it
  const holders = new Map<string, string[]>();

  for (const { name, model } of MODELS) {
    const docs = await model
      .find({ "fcmTokens.0": { $exists: true } })
      .select("fcmTokens")
      .lean();
    for (const doc of docs) {
      for (const token of doc.fcmTokens ?? []) {
        const list = holders.get(token) ?? [];
        list.push(`${name}:${String(doc._id)}`);
        holders.set(token, list);
      }
    }
  }

  const shared = [...holders.entries()].filter(([, who]) => who.length > 1);

  console.log(`${holders.size} device token(s) registered in total.`);
  if (shared.length === 0) {
    console.log("None are shared between accounts — nothing to repair.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${shared.length} shared across more than one account:`);
  for (const [token, who] of shared) {
    console.log(`  ${token.slice(0, 18)}… held by ${who.length}: ${who.join(", ")}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    await mongoose.disconnect();
    return;
  }

  const values = shared.map(([token]) => token);
  for (const { name, model } of MODELS) {
    const result = await model.updateMany(
      { fcmTokens: { $in: values } },
      { $pull: { fcmTokens: { $in: values } } }
    );
    console.log(`Cleared from ${result.modifiedCount} ${name}.`);
  }

  console.log(
    "\nDone. Each affected phone re-registers on its next app launch, and that " +
      "write now takes sole ownership."
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
