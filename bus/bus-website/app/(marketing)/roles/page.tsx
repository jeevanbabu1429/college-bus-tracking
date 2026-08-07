import type { Metadata } from "next";
import RolesContent from "./RolesContent";

export const metadata: Metadata = {
  title: "Roles",
  description:
    "Super Admin, Admin, Dispatcher and Driver — what each role can do in BusTrack, side by side.",
};

export default function RolesPage() {
  return <RolesContent />;
}
