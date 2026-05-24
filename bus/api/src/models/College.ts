import { Schema, model, type InferSchemaType } from "mongoose";

const collegeSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    busCount: { type: Number, required: true, min: 0 },
    driverCount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

collegeSchema.index({ admin: 1, code: 1 }, { unique: true });

export type College = InferSchemaType<typeof collegeSchema>;
export const CollegeModel = model("College", collegeSchema);
