import type { Metadata } from "next";
import RolesContent from "./RolesContent";

export const metadata: Metadata = {
  title: "Roles",
  description:
    "Admins create dynamic roles with dynamic access — Dispatcher, Driver and more. See what each role can do in BusBee, side by side.",
};

export default function RolesPage() {
  return <RolesContent />;
}
