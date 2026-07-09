import { getCurrentToken } from "../auth/tokenStore";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Session key used to pass the suspension message to the login page. Read
// once by the login page then cleared so it doesn't linger for future sessions.
export const SUSPENDED_MESSAGE_KEY = "bus.suspendedMessage";

// The default `tokenGetter` reads the admin token from tokenStore so every
// existing caller keeps working. The super admin console overrides this with
// its own getter so it never touches the admin tokenStore.
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  tokenGetter: () => string | null = getCurrentToken
): Promise<T> {
  const token = tokenGetter();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: { error?: string; suspended?: boolean } | null = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const message = body?.error ?? res.statusText;

    // Suspension is fatal to the session — clear it, stash the message, and
    // hard-navigate to /login so the whole in-memory admin state is
    // discarded. Skips super-admin tokens (they never come with suspended).
    if (
      res.status === 403 &&
      body?.suspended === true &&
      typeof window !== "undefined" &&
      tokenGetter === getCurrentToken
    ) {
      try {
        sessionStorage.setItem(SUSPENDED_MESSAGE_KEY, message);
      } catch {
        // sessionStorage disabled — proceed anyway
      }
      window.localStorage.removeItem("bus.authToken");
      window.localStorage.removeItem("bus.authSession");
      window.location.href = "/login";
    }

    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
