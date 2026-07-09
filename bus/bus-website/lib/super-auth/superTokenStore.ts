// Parallel to `lib/auth/tokenStore.ts` but with its own localStorage keys and
// module-scope variable. Keeping the two stores independent lets a super admin
// be logged in without evicting an ongoing admin session (useful for testing).

const TOKEN_KEY = "bus.superToken";
const SESSION_KEY = "bus.superSession";

let currentSuperToken: string | null = null;

export function getCurrentSuperToken(): string | null {
  return currentSuperToken;
}

export function setCurrentSuperToken(token: string | null): void {
  currentSuperToken = token;
}

export function loadPersistedSuperToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function loadPersistedSuperSession<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function persistSuperTokenAndSession(
  token: string,
  session: unknown
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function persistSuperSession(session: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearPersistedSuperAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}
