"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSuperAuth } from "../lib/super-auth/SuperAuthContext";
import {
  IconDashboard,
  IconBadge,
  IconBuilding,
  IconLogout,
} from "./icons";

// Red accent + darker sidebar-active-bg for the super admin area. Set as
// inline CSS variables on the .app root so existing utility classes
// (.btn-primary, .sidebar-link, etc.) pick them up automatically.
const SUPER_THEME: React.CSSProperties = {
  ["--accent" as never]: "#d13a3a",
  ["--accent-soft" as never]: "#fde8e8",
  ["--sidebar-active-bg" as never]: "#d13a3a",
};

type NavItem = { href: string; label: string; Icon: typeof IconDashboard };

const NAV: NavItem[] = [
  { href: "/super-admin/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/super-admin/admins", label: "Admins", Icon: IconBadge },
  { href: "/super-admin/colleges", label: "Colleges", Icon: IconBuilding },
];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  admins: "Admins",
  colleges: "Colleges",
  "change-password": "Change password",
};

function pageTitle(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const second = seg[1] ?? "dashboard";
  const base = TITLES[second] ?? second;
  if (seg.length <= 2) return base;
  return `${base.replace(/s$/, "")} detail`;
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

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, token, session, logout } = useSuperAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (ready && !token) router.replace("/super-admin/login");
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

  const email = session?.superAdmin.email ?? "";
  const initial = (email || "S").charAt(0).toUpperCase();
  const firstName = "Super";

  function isActive(href: string) {
    if (href === "/super-admin/dashboard") {
      return pathname === "/super-admin/dashboard";
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  function doLogout() {
    setConfirmLogout(false);
    logout();
    router.replace("/super-admin/login");
  }

  return (
    <div className="app" style={SUPER_THEME}>
      <aside className="sidebar">
        <Link href="/super-admin/dashboard" className="sidebar-brand">
          <span className="sidebar-brand-mark">S</span>
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-title">Super Admin</span>
            <span className="sidebar-brand-sub">Product owner</span>
          </span>
        </Link>

        <div className="sidebar-section-label">
          <span>Manage</span>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-link"
                data-active={isActive(item.href)}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-section-label" style={{ marginTop: 12 }}>
          <span>Account</span>
        </div>
        <nav className="sidebar-nav" aria-label="Account">
          <Link
            href="/super-admin/change-password"
            className="sidebar-link"
            data-active={isActive("/super-admin/change-password")}
          >
            <IconBadge />
            <span>Change password</span>
          </Link>
        </nav>

        <div className="sidebar-spacer" />
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title-block">
            <span className="topbar-title">{pageTitle(pathname)}</span>
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
            <div
              className="topbar-avatar"
              title={email}
              aria-label={email}
              style={{ cursor: "default" }}
            >
              <span className="topbar-avatar-mark">{initial}</span>
              <span className="topbar-avatar-name">{firstName}</span>
            </div>
          </div>
        </header>

        <main className="page">{children}</main>
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
            aria-labelledby="super-logout-title"
            aria-describedby="super-logout-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="super-logout-title" className="modal-title">
              Sign out?
            </h2>
            <p id="super-logout-desc" className="modal-text">
              You&apos;ll be returned to the super admin login screen and need
              to sign in again to access this console.
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
    </div>
  );
}
