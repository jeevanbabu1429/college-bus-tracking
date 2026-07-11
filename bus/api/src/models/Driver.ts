import { Schema, model, Types, type InferSchemaType } from "mongoose";

const driverSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
    },
    licenceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    aadharNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{12}$/,
    },
    mobile: { type: String, required: true, unique: true, trim: true },
    address: { type: String, required: true, trim: true },
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    tripActive: { type: Boolean, default: false },
    fcmTokens: { type: [String], default: [] },
    currentLocation: {
      type: new Schema(
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          updatedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    // Driver-reported bus condition. Cleared explicitly by the driver via
    // DELETE /api/driver/trip/issue. Not auto-cleared on trip stop — the
    // driver decides when the situation is resolved.
    currentIssue: {
      type: new Schema(
        {
          type: {
            type: String,
            required: true,
            enum: [
              "breakdown",
              "flat_tyre",
              "refuelling",
              "traffic",
              "mechanical",
              "weather",
              "other",
            ],
          },
          message: { type: String, default: "", trim: true },
          reportedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

export type Driver = InferSchemaType<typeof driverSchema> & {
  _id: Types.ObjectId;
};
export const DriverModel = model("Driver", driverSchema);
