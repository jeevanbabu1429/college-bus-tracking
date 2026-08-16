import { Schema, model, Types, type InferSchemaType } from "mongoose";

// A person the admin has given console access to, under one role in one
// college. Signs in with mobile + OTP exactly like drivers and students.
const staffSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    // Revoking access without deleting the record, so who-did-what stays
    // answerable and the same person can be switched back on later.
    active: { type: Boolean, default: true },
    fcmTokens: { type: [String], default: [], index: true },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

// Unique per college, NOT globally: the same person can be staff at two
// campuses. Sign-in resolves every row for a mobile and asks which college
// when there is more than one.
staffSchema.index({ college: 1, mobile: 1 }, { unique: true });

export type Staff = InferSchemaType<typeof staffSchema> & { _id: Types.ObjectId };
export const StaffModel = model("Staff", staffSchema);
