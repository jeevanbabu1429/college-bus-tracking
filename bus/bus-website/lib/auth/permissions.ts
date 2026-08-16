"use client";

/**
 * Which catalogue module a console page belongs to.
 *
 * `null` means the page is owner-only; `undefined` means it needs no
 * permission at all (your own account). Longest prefix wins, so
 * /buses/x/route resolves to `routes` rather than `buses`.
 */
const PATH_MODULES: { prefix: string; module: string | null }[] = [
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/colleges", module: null },
  { prefix: "/buses", module: "buses" },
  { prefix: "/drivers", module: "drivers" },
  { prefix: "/students", module: "students" },
  { prefix: "/assign-drivers", module: "assignments" },
  { prefix: "/assign-students", module: "assignments" },
  { prefix: "/switch-drivers", module: "assignments" },
  { prefix: "/switch-students", module: "assignments" },
  { prefix: "/track-drivers", module: "tracking" },
  { prefix: "/send-notification", module: "notifications" },
  { prefix: "/roles-access", module: "access" },
];

export function moduleForPath(
  pathname: string
): string | null | undefined {
  // Everyone reaches their own account, whatever their role.
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return undefined;
  // The route editor is its own module and sits underneath /buses.
  if (/^\/buses\/[^/]+\/route/.test(pathname)) return "routes";
  const hit = PATH_MODULES.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/")
  );
  return hit ? hit.module : undefined;
}

import { useMemo } from "react";
import { useAuth } from "./AuthContext";

/**
 * What the signed-in user may do.
 *
 * This shapes the UI only. Every one of these checks is enforced again on the
 * server — hiding a button is a courtesy, not a control, and a staff member
 * who edits the URL still hits a 403.
 */
export function usePermissions() {
  const { session } = useAuth();

  return useMemo(() => {
    if (session?.role === "staff") {
      const granted = new Map<string, Set<string>>();
      for (const grant of session.staff.role?.permissions ?? []) {
        granted.set(grant.module, new Set(grant.actions));
      }
      return {
        isAdmin: false,
        roleName: session.staff.role?.name ?? "Staff",
        landingPage: session.staff.role?.landingPage ?? "/dashboard",
        can: (module: string, action = "read") =>
          granted.get(module)?.has(action) ?? false,
      };
    }
    // The owning admin holds everything; enumerating it would mean widening a
    // list every time a module is added.
    return {
      isAdmin: true,
      roleName: null as string | null,
      landingPage: "/dashboard",
      can: () => true,
    };
  }, [session]);
}
