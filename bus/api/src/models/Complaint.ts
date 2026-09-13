import { Schema, model, Types, type InferSchemaType } from "mongoose";

export const COMPLAINT_CATEGORIES = [
  "bug",
  "login",
  "tracking",
  "notifications",
  "data",
  "other",
] as const;

export const COMPLAINT_STATUSES = ["open", "in_progress", "resolved"] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const MAX_COMPLAINT_MESSAGE = 2000;
export const MAX_COMPLAINT_REPLY = 2000;

// A support ticket raised from inside the mobile app and addressed to the
// super admin — the product owner — not to the user's college.
//
// Deliberately separate from the bus issues in routes/driverTrip.ts. Those are
// operational (breakdown, traffic delay), are raised only by a driver mid-trip,
// and go to the students on that bus and the college admin. These are about the
// app itself, can come from any signed-in role, and only the super admin sees
// them.
const complaintSchema = new Schema(
  {
    // Who raised it. `name` and `mobile` are copied in rather than populated:
    // a reporter can be an Admin, Staff, Driver or Student, so a populate would
    // mean a lookup per row across four collections just to render the console
    // list — and the ticket should stay answerable after the account is gone.
    reporter: {
      role: {
        type: String,
        required: true,
        enum: ["admin", "staff", "driver", "student"],
      },
      id: { type: Schema.Types.ObjectId, required: true },
      name: { type: String, default: "" , trim: true },
      mobile: { type: String, default: "", trim: true },
    },

    // Context, where the reporter has one. An admin can own several colleges,
    // so theirs is null.
    college: { type: Schema.Types.ObjectId, ref: "College", default: null },

    category: {
      type: String,
      required: true,
      enum: COMPLAINT_CATEGORIES,
      default: "other",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_COMPLAINT_MESSAGE,
    },

    // Optional, and stored inline as a base64 data URL — same approach as the
    // banner and driver photos, so there is still no blob storage to run. Size
    // is capped by parseImageField (lib/images.ts) on the way in, and the bytes
    // are never returned in a list payload.
    screenshot: { type: String, default: null },
    // Denormalised beside the bytes, for the same reason reporter.name is:
    // every list query strips `screenshot`, and a caller still has to know
    // whether there is an image to go and fetch.
    hasScreenshot: { type: Boolean, default: false },

    // Captured by the app, not typed by the user. This is what turns "the map
    // doesn't work" into something reproducible.
    diagnostics: {
      appVersion: { type: String, default: "" },
      buildNumber: { type: String, default: "" },
      platform: { type: String, default: "" },
      osVersion: { type: String, default: "" },
      deviceModel: { type: String, default: "" },
    },

    status: {
      type: String,
      required: true,
      enum: COMPLAINT_STATUSES,
      default: "open",
      index: true,
    },

    // One-way for now: written by the super admin, read by the reporter in the
    // app. A two-way thread would be an author field on these same entries.
    replies: {
      type: [
        new Schema(
          {
            body: {
              type: String,
              required: true,
              trim: true,
              maxlength: MAX_COMPLAINT_REPLY,
            },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// The console lists one status at a time, newest first.
complaintSchema.index({ status: 1, createdAt: -1 });
// "My complaints" in the app.
complaintSchema.index({ "reporter.id": 1, createdAt: -1 });

export type Complaint = InferSchemaType<typeof complaintSchema> & {
  _id: Types.ObjectId;
};
export const ComplaintModel = model("Complaint", complaintSchema);
