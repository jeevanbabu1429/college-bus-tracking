import type { ReactNode } from "react";
import { SuperAuthProvider } from "../../lib/super-auth/SuperAuthContext";

// Every /super-admin/* route sits under this provider so both the login page
// and the shell-wrapped pages can read/write super auth state.
export default function SuperAdminAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SuperAuthProvider>{children}</SuperAuthProvider>;
}
