import type { ReactNode } from "react";
import { SuperAdminShell } from "../../../components/SuperAdminShell";

// Guarded shell layout — the shell itself redirects to /super-admin/login
// when there's no token. Every page nested inside this group renders inside
// the sidebar+topbar chrome.
export default function SuperAdminAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
