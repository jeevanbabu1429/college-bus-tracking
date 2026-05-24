import { Schema, model, Types, type InferSchemaType } from "mongoose";

const busSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    busNumber: { type: String, required: true, trim: true },
    plateNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    capacity: { type: Number, required: true, min: 1 },
    driver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    route: { type: String, default: "", trim: true },
    stops: { type: [{ type: String, trim: true }], default: [] },
  },
  { timestamps: true }
);

busSchema.index({ college: 1, busNumber: 1 }, { unique: true });
busSchema.index(
  { driver: 1 },
  { unique: true, partialFilterExpression: { driver: { $type: "objectId" } } }
);

export type Bus = InferSchemaType<typeof busSchema> & { _id: Types.ObjectId };
export const BusModel = model("Bus", busSchema);
