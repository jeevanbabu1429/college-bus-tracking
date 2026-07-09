import { Schema, model, type InferSchemaType } from "mongoose";

// Product-owner account. Only one row after seeding; email is the natural key.
// Password stored as a bcrypt hash — never as plaintext. No OTP fields — this
// role uses email + password, unlike the three OTP-based roles.
const superAdminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export type SuperAdmin = InferSchemaType<typeof superAdminSchema>;
export const SuperAdminModel = model("SuperAdmin", superAdminSchema);
