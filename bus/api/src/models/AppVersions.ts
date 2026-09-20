import { Schema, model, type InferSchemaType } from "mongoose";

// Which app versions are still allowed to run, per platform. Singleton by
// convention, like Banner and LoginRoles — the super admin console writes one
// document and every phone reads it when the app opens.
//
// Two versions per platform, because "please update" and "you must update"
// are different messages:
//
//   latest   the version in the store right now. Anyone below it is offered
//            an update they can put off.
//   minimum  the oldest version still fit to use — an old build talking to a
//            changed API, say. Anyone below it is stopped until they update.
//
// Both default to empty, which switches the whole check off. A deployment
// that has never opened this screen behaves exactly as before.
const appVersionsSchema = new Schema(
  {
    androidLatest: { type: String, default: "" },
    androidMinimum: { type: String, default: "" },
    iosLatest: { type: String, default: "" },
    iosMinimum: { type: String, default: "" },
  },
  { timestamps: true }
);

export type AppVersionsDoc = InferSchemaType<typeof appVersionsSchema>;
export const AppVersionsModel = model("AppVersions", appVersionsSchema);

/** The shape the console reads and writes. */
export type AppVersionsPayload = {
  androidLatest: string;
  androidMinimum: string;
  iosLatest: string;
  iosMinimum: string;
};

export const NO_VERSIONS_SET: AppVersionsPayload = {
  androidLatest: "",
  androidMinimum: "",
  iosLatest: "",
  iosMinimum: "",
};

/**
 * Read the singleton, falling back to "nothing set".
 *
 * Never creates the document — a plain GET should not write. The row appears
 * the first time the super admin saves.
 */
export async function readAppVersions(): Promise<AppVersionsPayload> {
  const doc = await AppVersionsModel.findOne().lean();
  if (!doc) return { ...NO_VERSIONS_SET };
  return {
    androidLatest: doc.androidLatest ?? "",
    androidMinimum: doc.androidMinimum ?? "",
    iosLatest: doc.iosLatest ?? "",
    iosMinimum: doc.iosMinimum ?? "",
  };
}
