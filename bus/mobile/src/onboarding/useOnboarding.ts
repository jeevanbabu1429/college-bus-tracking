import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

// Device-level flag, not per account: the carousel introduces the app itself,
// so it runs once per install and never again — including for a driver or
// student who signs in later on the same phone.
//
// SecureStore rather than a plain key/value store because that is what the
// rest of the app already uses (see ThemeContext); no extra dependency.
const SEEN_KEY = "bus.onboardingSeen";

export type OnboardingState = {
  /** False until the stored flag has been read — hold the UI until then. */
  ready: boolean;
  seen: boolean;
  markSeen: () => Promise<void>;
};

export function useOnboarding(): OnboardingState {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await SecureStore.getItemAsync(SEEN_KEY);
        if (!cancelled) setSeen(value === "1");
      } catch {
        // Unreadable store — treat as already seen rather than trapping the
        // user in an onboarding they cannot get past.
        if (!cancelled) setSeen(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(async () => {
    // Flip the UI first: a storage failure must not strand the user on the
    // carousel. Worst case it reappears on the next launch.
    setSeen(true);
    try {
      await SecureStore.setItemAsync(SEEN_KEY, "1");
    } catch {
      // best effort
    }
  }, []);

  return { ready, seen, markSeen };
}
