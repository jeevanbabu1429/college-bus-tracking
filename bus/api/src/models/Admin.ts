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
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof adminSchema>;
export const AdminModel = model("Admin", adminSchema);

export function formatAdminId(seq: number): string {
  return `AD${seq.toString().padStart(3, "0")}`;
}
