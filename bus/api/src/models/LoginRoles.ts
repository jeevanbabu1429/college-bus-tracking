import { Schema, model, type InferSchemaType } from "mongoose";

// Which role cards the mobile app offers on its sign-in screen. Singleton by
// convention, exactly like Banner — the super admin console reads and writes
// one document and the app reads it on open.
//
// Product-wide rather than per-college on purpose: the app picks a role
// *before* anyone has identified themselves, so at the moment the cards
// render there is no college to scope the setting to.
//
// Every flag defaults to true, so a deployment that has never touched this
// screen behaves exactly as it did before the setting existed.
const loginRolesSchema = new Schema(
  {
    student: { type: Boolean, default: true },
    driver: { type: Boolean, default: true },
    admin: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type LoginRoles = InferSchemaType<typeof loginRolesSchema>;
export const LoginRolesModel = model("LoginRoles", loginRolesSchema);

/** The shape both the public and super-admin endpoints return. */
export type LoginRolesPayload = {
  student: boolean;
  driver: boolean;
  admin: boolean;
};

export const ALL_ROLES_ENABLED: LoginRolesPayload = {
  student: true,
  driver: true,
  admin: true,
};

/**
 * Read the singleton, falling back to "everything on".
 *
 * Never creates the document — a plain GET should not write. The row appears
 * the first time the super admin saves.
 */
export async function readLoginRoles(): Promise<LoginRolesPayload> {
  const doc = await LoginRolesModel.findOne().lean();
  if (!doc) return { ...ALL_ROLES_ENABLED };
  return {
    student: doc.student !== false,
    driver: doc.driver !== false,
    admin: doc.admin !== false,
  };
}
