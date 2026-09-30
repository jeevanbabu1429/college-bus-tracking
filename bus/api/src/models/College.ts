import { Schema, model, type InferSchemaType } from "mongoose";

/** Staff accounts included before a college has to ask for more. */
export const DEFAULT_STAFF_LIMIT = 5;

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
    // How many staff accounts this college may have. Default 5; the super
    // admin raises it per customer, which is the whole point of it being a
    // field rather than a constant.
    staffLimit: { type: Number, default: DEFAULT_STAFF_LIMIT, min: 0 },
    approved: { type: Boolean },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

collegeSchema.index({ admin: 1, code: 1 }, { unique: true });

export type College = InferSchemaType<typeof collegeSchema>;
export const CollegeModel = model("College", collegeSchema);
