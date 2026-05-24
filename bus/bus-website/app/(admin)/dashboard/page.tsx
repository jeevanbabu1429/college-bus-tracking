"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useColleges } from "../../../lib/college/CollegeContext";
import { NoCollege } from "../../../components/NoCollege";
import {
  IconBus,
  IconBadge,
  IconUsers,
  IconPlus,
  IconRoute,
  IconBuilding,
} from "../../../components/icons";

const QUICK_ACTIONS = [
  {
    href: "/buses/new",
    label: "Add a bus",
    caption: "Register a new vehicle",
    Icon: IconBus,
  },
  {
    href: "/drivers/new",
    label: "Onboard a driver",
    caption: "Record licence and Aadhar",
    Icon: IconBadge,
  },
  {
    href: "/students/new",
    label: "Enrol a student",
    caption: "Issue a roll and assign a seat",
    Icon: IconUsers,
  },
  {
    href: "/assign-drivers",
    label: "Assign drivers",
    caption: "Pair vehicles with drivers",
    Icon: IconPlus,
  },
  {
    href: "/assign-students",
    label: "Assign students",
    caption: "Place students on routes",
    Icon: IconPlus,
  },
  {
    href: "/buses",
    label: "Routes & stops",
    caption: "Manage routes and capacity",
    Icon: IconRoute,
  },
];

export default function DashboardPage() {
  const { session } = useAuth();
  const { selected, refresh } = useColleges();

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!selected) return <NoCollege />;

  const firstName = (session?.admin?.name ?? "").split(/\s+/)[0] || "there";
  const busPlanned = Math.max(selected.busCount, 1);
  const driverPlanned = Math.max(selected.driverCount, 1);
  const busPct = Math.min(100, Math.round((selected.actualBusCount / busPlanned) * 100));
  const driverPct = Math.min(100, Math.round((selected.actualDriverCount / driverPlanned) * 100));

  return (
    <>
      <div className="hero-card">
        <div className="hero-text">
          <div className="hero-greeting">Hi, {firstName}</div>
          <div className="hero-subtitle">
            Here&rsquo;s how <strong>{selected.name}</strong> is rolling today.
          </div>
        </div>
        <div className="hero-decoration" aria-hidden>
          <span className="blob-a" />
          <span className="blob-b" />
          <span className="blob-c" />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="section-title">Overview</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {selected.code} &middot; {selected.address}
          </div>
        </div>
        <div className="page-actions">
          <Link href="/colleges" className="btn btn-secondary">
            <IconBuilding size={14} /> Change college
          </Link>
          <Link href="/buses/new" className="btn btn-primary">
            <IconPlus size={14} /> Add bus
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-tile stat-tile-yellow">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Buses on route</span>
            <span className="stat-tile-icon">
              <IconBus size={18} />
            </span>
          </div>
          <div>
            <div className="stat-tile-value">{selected.actualBusCount}</div>
            <div className="stat-tile-label" style={{ marginTop: 4 }}>
              {busPct}% of {selected.busCount} planned
            </div>
          </div>
        </div>

        <div className="stat-tile stat-tile-purple">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Drivers active</span>
            <span className="stat-tile-icon">
              <IconBadge size={18} />
            </span>
          </div>
          <div>
            <div className="stat-tile-value">{selected.actualDriverCount}</div>
            <div className="stat-tile-label" style={{ marginTop: 4 }}>
              {driverPct}% of {selected.driverCount} planned
            </div>
          </div>
        </div>

        <div className="stat-tile stat-tile-pink">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Students enrolled</span>
            <span className="stat-tile-icon">
              <IconUsers size={18} />
            </span>
          </div>
          <div>
            <div className="stat-tile-value">{selected.actualStudentCount}</div>
            <div className="stat-tile-label" style={{ marginTop: 4 }}>
              currently on the roll
            </div>
          </div>
        </div>

        <div className="stat-tile stat-tile-blue">
          <div className="stat-tile-head">
            <span className="stat-tile-label">Fleet capacity</span>
            <span className="stat-tile-icon">
              <IconRoute size={18} />
            </span>
          </div>
          <div>
            <div className="stat-tile-value">{busPlanned + driverPlanned}</div>
            <div className="stat-tile-label" style={{ marginTop: 4 }}>
              planned buses + drivers
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="section-title" style={{ marginBottom: 12 }}>
          Quick actions
        </h2>
        <div className="action-grid">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.Icon;
            return (
              <Link key={a.href} href={a.href} className="action-tile">
                <span className="action-tile-icon">
                  <Icon size={18} />
                </span>
                <span className="action-tile-body">
                  <span className="action-tile-label">{a.label}</span>
                  <span className="action-tile-caption">{a.caption}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
