import { useEffect, useState } from "react";
import { apiFetch } from "./client";

export type AppSettings = {
  accountDeletionEnabled: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  accountDeletionEnabled: true,
};

// Product-wide switches, set by the super admin. Public — read before anyone
// has signed in.
//
// Never rejects. A phone that cannot reach the API keeps the defaults, so a
// dropped connection never hides a screen someone is entitled to; the server
// refuses anything it has switched off anyway.
export const appSettingsApi = {
  async get(): Promise<AppSettings> {
    try {
      const res = await apiFetch<Partial<AppSettings>>("/api/app-settings");
      return {
        accountDeletionEnabled: res?.accountDeletionEnabled !== false,
      };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  },
};

/** Whether to show "Delete account" in the profile screen. */
export function useAccountDeletionEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    let cancelled = false;
    appSettingsApi.get().then((s) => {
      if (!cancelled) setEnabled(s.accountDeletionEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
