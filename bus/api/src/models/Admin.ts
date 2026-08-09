import { Schema, model, type InferSchemaType } from "mongoose";

const adminSchema = new Schema(
  {
    adminId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
    },
    dob: { type: Date, required: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    fcmTokens: { type: [String], default: [] },
    // The super admin can suspend an admin (and their whole customer tree)
    // via /api/super/admins/:id/suspended. When true, the admin can't log in
    // and neither can any driver/student under any of their colleges.
    suspended: { type: Boolean, default: false },
    // New signups land unapproved and can sign in but do nothing until the
    // super admin verifies them (PATCH /api/super/admins/:id/approved).
    //
    // Read the check as `approved === false`, never `!approved`: admins that
    // existed before this field was introduced have no value at all, and a
    // missing value means "legacy, already trusted". That keeps every current
    // customer working without a migration, while every new registration
    // writes an explicit false. scripts/backfillAdminApproval.ts normalises
    // the old rows when you want them tidy.
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof adminSchema>;
export const AdminModel = model("Admin", adminSchema);

export function formatAdminId(seq: number): string {
  return `AD${seq.toString().padStart(3, "0")}`;
}
