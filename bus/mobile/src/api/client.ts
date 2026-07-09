import { getCurrentToken } from "../auth/tokenStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Module-level handler set by AuthProvider on mount. When apiFetch sees a
// suspension 403 it calls this to clear the session so the RootNavigator
// swaps back to the auth stack. Kept as a plain callback to avoid pulling
// React state into a non-component module.
type SuspendedHandler = (message: string) => void;
let onSuspendedHandler: SuspendedHandler | null = null;

export function setOnSuspended(fn: SuspendedHandler | null): void {
  onSuspendedHandler = fn;
}

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
    }

    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
