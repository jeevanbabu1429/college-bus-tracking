import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiFetch } from "./client";

export type UpdateAction = "none" | "optional" | "required";

export type UpdateCheck = {
  action: UpdateAction;
  latest: string;
  minimum: string;
};

const NO_UPDATE: UpdateCheck = { action: "none", latest: "", minimum: "" };

/** The version of the app this phone is running, from app.json. */
export function installedVersion(): string {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" ? version : "";
}

/**
 * Ask the server whether this app is too old.
 *
 * Never rejects. A phone that cannot reach the API is let through — being
 * stuck behind a "you must update" wall because of a dropped connection would
 * be far worse than running an old version for one more trip.
 */
export const appVersionApi = {
  async check(): Promise<UpdateCheck> {
    const version = installedVersion();
    if (!version) return { ...NO_UPDATE };
    try {
      const query = `platform=${Platform.OS}&version=${encodeURIComponent(version)}`;
      const res = await apiFetch<Partial<UpdateCheck>>(`/api/app-version?${query}`);
      const action = res?.action;
      if (action !== "optional" && action !== "required") return { ...NO_UPDATE };
      return {
        action,
        latest: typeof res?.latest === "string" ? res.latest : "",
        minimum: typeof res?.minimum === "string" ? res.minimum : "",
      };
    } catch {
      return { ...NO_UPDATE };
    }
  },
};

/** Where this phone downloads the update from. */
export function storeUrl(): string {
  return Platform.OS === "ios"
    ? "https://apps.apple.com/app/id6807894092"
    : "https://play.google.com/store/apps/details?id=com.yourcollege.bustracking";
}
