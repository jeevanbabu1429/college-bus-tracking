import bcrypt from "bcryptjs";
import { SuperAdminModel } from "./models/SuperAdmin.js";

const DEFAULT_EMAIL = "superadmin@gmail.com";
const DEFAULT_PASSWORD = "superadmin@123";
const BCRYPT_ROUNDS = 10;

// Idempotent boot-time seeder for the single super admin account. Reads env
// overrides so the credentials can be customised per deployment without
// touching source. Safe to call every boot — no-ops if the row already exists.
export async function seedSuperAdmin(): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_EMAIL).toLowerCase();
  const password =
    process.env.SUPER_ADMIN_DEFAULT_PASSWORD ?? DEFAULT_PASSWORD;

  const existing = await SuperAdminModel.findOne({ email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await SuperAdminModel.create({ email, passwordHash });
  console.log(`[seed] SuperAdmin seeded with email ${email}`);
}
