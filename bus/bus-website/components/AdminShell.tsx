"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, sessionAdmin, sessionName } from "../lib/auth/AuthContext";
import { moduleForPath, usePermissions } from "../lib/auth/permissions";
import { NoAccess } from "./NoAccess";
import { useColleges } from "../lib/college/CollegeContext";
import {
  IconDashboard,
  IconBuilding,
  IconBus,
  IconBadge,
  IconUsers,
  IconLogout,
  IconHelp,
  IconSwap,
  IconBell,
  IconShield,
} from "./icons";
import { SupportModal } from "./SupportButton";
import { PendingApproval } from "./PendingApproval";
import { PendingCollege } from "./PendingCollege";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof IconDashboard;
  /** Catalogue module this page belongs to; `null` means owner-only. */
  module: string | null;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard, module: "dashboard" },
  // Owner-only: staff belong to exactly one college and never switch.
  { href: "/colleges", label: "Colleges", Icon: IconBuilding, module: null },
  { href: "/buses", label: "Buses", Icon: IconBus, module: "buses" },
  { href: "/drivers", label: "Drivers", Icon: IconBadge, module: "drivers" },
  { href: "/switch-drivers", label: "Switch drivers", Icon: IconSwap, module: "assignments" },
  { href: "/switch-students", label: "Switch students", Icon: IconSwap, module: "assignments" },
  { href: "/students", label: "Students", Icon: IconUsers, module: "students" },
  { href: "/send-notification", label: "Send notification", Icon: IconBell, module: "notifications" },
  { href: "/roles-access", label: "Roles & access", Icon: IconShield, module: "access" },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  colleges: "Colleges",
  buses: "Buses",
  drivers: "Drivers",
  "switch-drivers": "Switch drivers",
  "switch-students": "Switch students",
  students: "Students",
  "assign-drivers": "Assign drivers",
  "assign-students": "Assign students",
  "send-notification": "Send notification",
  "roles-access": "Roles & access",
  profile: "Profile",
};

function pageInfo(pathname: string): { title: string; sub: string } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "dashboard";
  const base = PAGE_TITLES[first] ?? first;
  const second = segments[1];
  const third = segments[2];

  if (segments.length <= 1) return { title: base, sub: base };
  if (second === "new") return { title: `New ${base.toLowerCase().replace(/s$/, "")}`, sub: base };
  if (second === "bulk") {
    const lower = base.toLowerCase();
    const title = lower.startsWith("assign ")
      ? `Bulk ${lower}`
      : `Bulk upload ${lower}`;
    return { title, sub: base };
  }
  if (third === "edit") return { title: `Edit ${base.toLowerCase().replace(/s$/, "")}`, sub: base };
  if (third === "route") return { title: "Edit route", sub: base };
  return { title: `${base.replace(/s$/, "")} detail`, sub: base };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
function todayString(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, token, session, logout } = useAuth();
  const { colleges, selected, selectedId, selectCollege } = useColleges();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // Must sit above the early returns below: usePermissions calls useContext
  // and useMemo, and a hook that only runs on some renders changes the hook
  // order between them, which React refuses outright.
  const perms = usePermissions();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  useEffect(() => {
    if (!confirmLogout) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmLogout(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout]);

  if (!ready || !token) {
    return (
      <div className="center" style={{ minHeight: "100vh" }}>
        <span className="spinner" />
      </div>
    );
  }

  // Gate the entire console, not just the dashboard route — otherwise typing
  // /buses straight into the address bar would walk around the notice.
  // `=== false` rather than `!approved`: admins predating the field have no
  // value stored and are already trusted.
  if (sessionAdmin(session)?.approved === false) {
    return <PendingApproval />;
  }

  const who = sessionName(session);
  const initial = (who || "A").trim().charAt(0).toUpperCase();
  const firstName = who.split(/\s+/)[0] || "Admin";

  // Only the pages this user can actually open. The server refuses the rest
  // anyway; leaving them visible would just be a row of dead ends.
  const visibleNav = NAV.filter((item) =>
    item.module === null ? perms.isAdmin : perms.can(item.module, "read")
  );

  // Staff see the role they were given where an admin sees their admin id —
  // it is the only cue explaining why their sidebar is shorter than a
  // colleague's.
  const roleLabel =
    session?.role === "staff" ? session.staff.role?.name ?? "Staff" : null;

  function isActive(item: NavItem) {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  function doLogout() {
    setConfirmLogout(false);
    logout();
    router.replace("/login");
  }

  // A college awaiting verification locks its own pages, but not the ones
  // that are about the account rather than the campus — the admin still needs
  // to reach their college list to correct the details under review, and their
  // profile. Everything else shows the wait notice.
  const COLLEGE_PENDING_EXEMPT = ["/colleges", "/profile"];
  // A staff member who types a URL their role does not cover gets told so,
  // rather than a page that renders and then fills with 403s.
  const needed = moduleForPath(pathname);
  const blocked =
    needed === undefined
      ? false
      : needed === null
      ? !perms.isAdmin
      : !perms.can(needed, "read");

  const collegePending =
    selected?.approved === false &&
    !COLLEGE_PENDING_EXEMPT.some(
      (h) => pathname === h || pathname.startsWith(h + "/")
    );

  const { title } = pageInfo(pathname);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/dashboard" className="sidebar-brand">
          <span className="sidebar-brand-mark">B</span>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-title">Bus Admin</span>
            <span className="sidebar-brand-sub">
              {roleLabel ?? sessionAdmin(session)?.adminId ?? "Console"}
            </span>
          </span>
        </Link>

        <Link href="/buses/new" className="sidebar-create" aria-label="Add a bus">
          <span className="sidebar-create-plus" aria-hidden>+</span>
          <span className="sidebar-create-text">
            Add new
            <br />
            <span style={{ fontWeight: 500, color: "var(--text-muted)", fontSize: 11 }}>
              bus, driver…
            </span>
          </span>
        </Link>

        <div className="sidebar-section-label">
          <span>Workspace</span>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          {visibleNav.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-link"
                data-active={isActive(item)}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-link"
            onClick={() => setSupportOpen(true)}
            title="Contact support"
          >
            <IconHelp />
            <span>Support</span>
          </button>

          {colleges && colleges.length > 0 && (
            <label className="sidebar-college">
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span className="sidebar-college-label">Active college</span>
                <select
                  aria-label="Active college"
                  value={selectedId ?? ""}
                  onChange={(e) => selectCollege(e.target.value)}
                >
                  {colleges.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.approved === false ? " — awaiting verification" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title-block">
            <span className="topbar-title">{title}</span>
            <span className="topbar-date">{todayString()}</span>
          </div>

          <div className="topbar-spacer" />

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setConfirmLogout(true)}
              title="Sign out"
              aria-label="Sign out"
            >
              <IconLogout />
            </button>
            <Link
              href="/profile"
              className="topbar-avatar"
              title={who || "Profile"}
              aria-label="Profile"
            >
              <span className="topbar-avatar-mark">{initial}</span>
              <span className="topbar-avatar-name">{firstName}</span>
            </Link>
          </div>
        </header>

        <main className="page">
          {collegePending ? (
            <PendingCollege />
          ) : blocked ? (
            <NoAccess module={needed} roleName={perms.roleName} />
          ) : (
            children
          )}
        </main>
      </div>

      {confirmLogout && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="logout-title" className="modal-title">
              Sign out?
            </h2>
            <p id="logout-desc" className="modal-text">
              You&apos;ll be returned to the login screen and need to sign in
              again to access the admin console.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={doLogout}
                autoFocus
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </div>
  );
}
