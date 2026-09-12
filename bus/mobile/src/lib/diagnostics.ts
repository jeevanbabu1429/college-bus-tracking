import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

export type Diagnostics = {
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
};

/**
 * What the device can say about itself, attached to every complaint.
 *
 * This is the difference between "the map doesn't work" and a report you can
 * act on: it answers, without asking the user, whether a bug is confined to one
 * app version or one OS. Nothing here is personal — no location, no identifiers
 * beyond the account the request is already authenticated as.
 *
 * Everything is best-effort. A missing field must never stop a complaint being
 * sent, so each lookup falls back to an empty string rather than throwing.
 */
export function collectDiagnostics(): Diagnostics {
  return {
    appVersion: str(Constants.expoConfig?.version),
    buildNumber: str(
      Platform.OS === "ios"
        ? Constants.expoConfig?.ios?.buildNumber
        : Constants.expoConfig?.android?.versionCode
    ),
    platform: Platform.OS,
    osVersion: str(Device.osVersion ?? Platform.Version),
    // `modelName` is null on a simulator and on web; the fallback keeps the
    // field present so the console does not render an empty row.
    deviceModel: str(Device.modelName) || "unknown",
  };
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
