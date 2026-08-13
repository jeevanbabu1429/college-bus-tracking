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
    // Every college after an admin's first has to be verified by the super
    // admin before it can be operated.
    //
    // No schema default on purpose: colleges created before this field
    // existed have no value stored, and those must keep working. Only an
    // explicit `false` blocks, so reads are `approved === false`, never
    // `!approved`. The create route always writes an explicit value.
    approved: { type: Boolean },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

collegeSchema.index({ admin: 1, code: 1 }, { unique: true });

export type College = InferSchemaType<typeof collegeSchema>;
export const CollegeModel = model("College", collegeSchema);
