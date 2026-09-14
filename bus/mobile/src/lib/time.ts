import { useEffect, useState } from "react";

// How old a bus position may be before the app stops calling it live. The
// driver's phone reports every 5 s while moving, but a bus parked at a stop
// sends nothing until it has moved 10 m, so this is generous on purpose.
export const STALE_AFTER_MS = 2 * 60 * 1000;

/** "just now", "40s ago", "3 min ago", "2 h ago" — never "1800s ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "a while ago";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** True when a position updated at `iso` is too old to show as live. */
export function isStale(iso: string, now: number = Date.now()): boolean {
  const at = new Date(iso).getTime();
  return !Number.isFinite(at) || now - at > STALE_AFTER_MS;
}

/**
 * The current time, refreshed every `intervalMs`. Keeps "3 min ago" and the
 * live/stale label moving even when polling has stopped — which is exactly
 * when the phone is offline and the label matters most.
 */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
