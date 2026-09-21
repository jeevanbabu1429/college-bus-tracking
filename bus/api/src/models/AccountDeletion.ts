import { Schema, model, Types, type InferSchemaType } from "mongoose";

// Why people leave, kept after the account itself is gone.
//
// Deliberately denormalised: the account is deleted moments later, so a
// reference would point at nothing. Name and mobile are kept because a college
// asking "where did our driver go?" needs an answer, and because a deletion
// dispute has to be traceable to a person. Nothing else about them is kept.
const accountDeletionSchema = new Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["admin", "driver", "student"],
      index: true,
    },
    name: { type: String, default: "" },
    mobile: { type: String, default: "" },
    // Null for an admin, who may own several colleges.
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      default: null,
      index: true,
    },
    collegeName: { type: String, default: "" },
    reason: { type: String, required: true, trim: true },
    // What went with the account, for an admin whose colleges cascaded.
    removed: {
      colleges: { type: Number, default: 0 },
      buses: { type: Number, default: 0 },
      drivers: { type: Number, default: 0 },
      students: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type AccountDeletion = InferSchemaType<typeof accountDeletionSchema> & {
  _id: Types.ObjectId;
};
export const AccountDeletionModel = model(
  "AccountDeletion",
  accountDeletionSchema
);
