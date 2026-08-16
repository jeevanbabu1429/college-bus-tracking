import { Schema, model, Types, type InferSchemaType } from "mongoose";

// A named set of permissions inside ONE college. Scoped to the college rather
// than the admin account so a transport officer at one campus can never be
// handed another campus by widening a role.
const roleSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    // Purely cosmetic dot in the role list, so a long list stays scannable.
    color: { type: String, default: "" },
    // Module -> the actions granted on it. A module absent from this array
    // grants nothing, so a role created before a new module existed cannot
    // silently acquire access to it.
    permissions: {
      type: [
        new Schema(
          {
            module: { type: String, required: true, trim: true },
            actions: { type: [String], default: [] },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Where this role lands after signing in. Someone who can only see the
    // fleet should not be dropped on a dashboard they cannot read.
    landingPage: { type: String, default: "/dashboard", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

// Two roles in one college cannot share a name — the name is what an admin
// picks from when adding staff.
roleSchema.index({ college: 1, name: 1 }, { unique: true });

export type Role = InferSchemaType<typeof roleSchema> & { _id: Types.ObjectId };
export const RoleModel = model("Role", roleSchema);
