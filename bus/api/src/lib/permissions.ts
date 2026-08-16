/**
 * The permission catalogue: every module of the admin console and what can be
 * done in it.
 *
 * Served to the website from GET /roles/catalogue rather than duplicated
 * there, so the permission matrix an admin ticks boxes in can never drift from
 * the one the API enforces.
 */

export type Action = "create" | "read" | "update" | "delete";

export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  actions: Action[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview tiles, and buses that have reported a problem.",
    actions: ["read"],
  },
  {
    key: "buses",
    label: "Buses",
    description: "The fleet — add, edit and remove vehicles.",
    actions: ["create", "read", "update", "delete"],
  },
  {
    key: "routes",
    label: "Routes & stops",
    description: "A bus's route line, its stops, and suspending a stop.",
    actions: ["read", "update"],
  },
  {
    key: "drivers",
    label: "Drivers",
    description: "Driver records, licences and contact details.",
    actions: ["create", "read", "update", "delete"],
  },
  {
    key: "students",
    label: "Students",
    description: "Student records, roll numbers and contact details.",
    actions: ["create", "read", "update", "delete"],
  },
  {
    key: "assignments",
    label: "Assignments",
    description:
      "Putting drivers on buses and students on routes, including the switch screens.",
    actions: ["read", "update"],
  },
  {
    key: "tracking",
    label: "Live tracking",
    description: "The map of buses currently on a trip.",
    actions: ["read"],
  },
  {
    key: "notifications",
    label: "Send notification",
    description: "Push announcements to students and drivers.",
    actions: ["read", "create"],
  },
  {
    key: "access",
    label: "Roles & access",
    description:
      "Creating roles and adding staff. Grant with care — anyone with this can widen their own access.",
    actions: ["create", "read", "update", "delete"],
  },
];

export const MODULE_KEYS = new Set(MODULES.map((m) => m.key));

const ACTIONS_BY_MODULE = new Map(MODULES.map((m) => [m.key, new Set(m.actions)]));

/** True when `action` is one this module actually offers. */
export function isValidPermission(module: string, action: string): boolean {
  return ACTIONS_BY_MODULE.get(module)?.has(action as Action) ?? false;
}

/** Every action of every module — what the owning admin implicitly holds. */
export function allPermissions(): { module: string; actions: Action[] }[] {
  return MODULES.map((m) => ({ module: m.key, actions: [...m.actions] }));
}

/**
 * Which module and action a request is asking for, worked out from the URL and
 * the HTTP verb.
 *
 * Deriving it centrally rather than tagging each route means a new endpoint is
 * covered the moment it is added, instead of defaulting to wide open because
 * someone forgot the annotation. The overrides below are the paths whose
 * module is not simply the first segment.
 *
 * `path` is everything after /api/colleges/:collegeId, e.g. "/buses/123/route".
 */
export function permissionFor(
  path: string,
  method: string
): { module: string; action: Action } | null {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null; // the college document itself

  const verb = method.toUpperCase();
  const action: Action =
    verb === "POST"
      ? "create"
      : verb === "PUT" || verb === "PATCH"
      ? "update"
      : verb === "DELETE"
      ? "delete"
      : "read";

  const [head, ...rest] = segments;
  const tail = rest.join("/");

  // Route editing is its own module: a supervisor may need to suspend a stop
  // without being able to add or delete buses.
  if (head === "buses") {
    if (rest.at(-1) === "route") return { module: "routes", action: "update" };
    // Pairing a driver with a bus is an assignment, not a change to the bus.
    if (rest.at(-1) === "driver") return { module: "assignments", action: "update" };
    if (tail === "driver-assignments" || tail === "reassign-driver") {
      return { module: "assignments", action: "update" };
    }
    // The live map and the breakdown list are read models, not the fleet list.
    if (tail === "live") return { module: "tracking", action: "read" };
    if (tail === "issues") return { module: "dashboard", action: "read" };
    return { module: "buses", action };
  }

  if (head === "students") {
    if (tail === "reassign-bus" || tail === "bus-assignments") {
      return { module: "assignments", action: "update" };
    }
    return { module: "students", action };
  }

  if (head === "drivers") return { module: "drivers", action };
  if (head === "notifications") {
    // The audience preview is a read; sending is a create.
    return { module: "notifications", action: tail === "audience" ? "read" : action };
  }
  if (head === "roles" || head === "staff") return { module: "access", action };

  // An unrecognised path is refused rather than allowed. A new sub-router
  // mounted without a catalogue entry should fail loudly in development, not
  // silently bypass every role.
  return null;
}
