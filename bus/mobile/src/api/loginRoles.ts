import { apiFetch } from "./client";

/** Which role cards the sign-in screen should offer. Product-wide. */
export type LoginRoles = {
  student: boolean;
  driver: boolean;
  admin: boolean;
};

export const ALL_ROLES_ENABLED: LoginRoles = {
  student: true,
  driver: true,
  admin: true,
};

// Public — no auth, and necessarily so: this is read to draw the sign-in
// screen, which is the screen you see before you have any credentials.
//
// Never rejects. A user who cannot reach the API must still be offered every
// way in — showing a card the super admin had hidden is a far smaller problem
// than showing none at all and stranding them on a dead screen.
export const loginRolesApi = {
  async get(): Promise<LoginRoles> {
    try {
      const roles = await apiFetch<Partial<LoginRoles>>("/api/login-roles");
      const resolved: LoginRoles = {
        student: roles?.student !== false,
        driver: roles?.driver !== false,
        admin: roles?.admin !== false,
      };
      // A response that disables everything would be unusable. The server
      // refuses to save that state, so treat it as a bad payload rather than
      // an instruction.
      if (!resolved.student && !resolved.driver && !resolved.admin) {
        return { ...ALL_ROLES_ENABLED };
      }
      return resolved;
    } catch {
      return { ...ALL_ROLES_ENABLED };
    }
  },
};
