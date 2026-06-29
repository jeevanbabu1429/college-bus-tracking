import { Schema, model, Types, type InferSchemaType } from "mongoose";

const studentSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
    },
    dob: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    bus: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      default: null,
      index: true,
    },
    stop: { type: String, default: null, trim: true },
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    fcmTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

studentSchema.index({ college: 1, rollNumber: 1 }, { unique: true });

export type Student = InferSchemaType<typeof studentSchema> & {
  _id: Types.ObjectId;
};
export const StudentModel = model("Student", studentSchema);
