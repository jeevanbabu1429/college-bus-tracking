import { Schema, model, Types, type InferSchemaType } from "mongoose";

// A stop on a bus route. `name` is the stable key students reference via
// Student.stop. lat/lng are optional (older routes have none) and power the
// map + nearest-active-stop suggestion. `suspended` marks a stop as
// temporarily closed (e.g. road work) without removing it — so student
// assignments are preserved and restored when it reopens. When suspended,
// the admin can optionally set a `temporaryReplacement` name — a plain string
// shown to affected students in place of the automatic nearest-open-stop
// suggestion. Only meaningful when suspended === true; otherwise ignored.
const stopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    suspended: { type: Boolean, default: false },
    temporaryReplacement: { type: String, default: null, trim: true },
  },
  { _id: false }
);

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
    stops: { type: [stopSchema], default: [] },
    // Free-text disruption banner shown to drivers and students (e.g.
    // "Anna Nagar closed May 24–31 due to road work — board at Main Road").
    notice: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

busSchema.index({ college: 1, busNumber: 1 }, { unique: true });
busSchema.index(
  { driver: 1 },
  { unique: true, partialFilterExpression: { driver: { $type: "objectId" } } }
);

export type BusStop = InferSchemaType<typeof stopSchema>;
export type Bus = InferSchemaType<typeof busSchema> & { _id: Types.ObjectId };
export const BusModel = model("Bus", busSchema);
