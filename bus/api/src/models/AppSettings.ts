import { Schema, model, type InferSchemaType } from "mongoose";

// Product-wide switches for the mobile app. Singleton by convention, like
// Banner, LoginRoles and AppVersions — the super admin console writes one
// document and the app reads it when it opens.
const appSettingsSchema = new Schema(
  {
    // Whether the app offers "Delete account" in the profile screens.
    //
    // On by default, and meant to stay on: the App Store requires an app that
    // lets people create an account to let them delete it in the app
    // (guideline 5.1.1(v)). The switch exists so it can be closed off in an
    // emergency — a bug in the deletion flow, say — not as a normal setting.
    accountDeletionEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type AppSettingsDoc = InferSchemaType<typeof appSettingsSchema>;
export const AppSettingsModel = model("AppSettings", appSettingsSchema);

export type AppSettingsPayload = {
  accountDeletionEnabled: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettingsPayload = {
  accountDeletionEnabled: true,
};

/**
 * Read the singleton, falling back to the defaults. Never creates the
 * document — the row appears the first time the super admin saves.
 */
export async function readAppSettings(): Promise<AppSettingsPayload> {
  const doc = await AppSettingsModel.findOne().lean();
  if (!doc) return { ...DEFAULT_APP_SETTINGS };
  return { accountDeletionEnabled: doc.accountDeletionEnabled !== false };
}
