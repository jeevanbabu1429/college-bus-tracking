import { getCurrentToken } from "../auth/tokenStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Module-level handlers set by AuthProvider on mount. Both are called by
// apiFetch to clear the session so the RootNavigator swaps back to the auth
// stack. Kept as plain callbacks to avoid pulling React state into a
// non-component module.
type MessageHandler = (message: string) => void;
let onSuspendedHandler: MessageHandler | null = null;
let onUnauthorizedHandler: MessageHandler | null = null;

export function setOnSuspended(fn: MessageHandler | null): void {
  onSuspendedHandler = fn;
}

export function setOnUnauthorized(fn: MessageHandler | null): void {
  onUnauthorizedHandler = fn;
}

const EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getCurrentToken();
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

    if (res.status === 403 && body?.suspended === true && onSuspendedHandler) {
      onSuspendedHandler(message);
    } else if (res.status === 401 && token && onUnauthorizedHandler) {
      // 401 while we sent a bearer token means the token was rejected —
      // expired, JWT_SECRET rotated, or otherwise invalid.
      onUnauthorizedHandler(EXPIRED_MESSAGE);
    }

    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
