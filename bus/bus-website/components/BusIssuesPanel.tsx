"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useColleges } from "../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type BusIssueItem,
  type IssueType,
} from "../lib/api/collegeBuses";
import { IconBus, IconCheck, IconPhone } from "./icons";

// Matches the driver dashboard's own wording so the admin and the driver are
// looking at the same label for the same thing.
const ISSUE_META: Record<IssueType, { label: string; emoji: string }> = {
  breakdown: { label: "Breakdown", emoji: "🛠️" },
  flat_tyre: { label: "Flat tyre", emoji: "🛞" },
  refuelling: { label: "Refuelling", emoji: "⛽" },
  traffic: { label: "Traffic delay", emoji: "🚦" },
  mechanical: { label: "Mechanical issue", emoji: "🔧" },
  weather: { label: "Weather delay", emoji: "🌧️" },
  other: { label: "Issue reported", emoji: "❗" },
};

// A breakdown reported five minutes ago and one reported two hours ago need
// different reactions, and only the elapsed time says which is which.
const POLL_MS = 30_000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function since(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Live list of buses their drivers have flagged as having a problem.
 *
 * Resolving is deliberately not offered here: only the driver can see whether
 * the bus is actually moving again, and the API only accepts the all-clear
 * from them. The admin's job on this panel is to find out and phone someone.
 */
export function BusIssuesPanel() {
  const { selected } = useColleges();
  const [items, setItems] = useState<BusIssueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    try {
      setItems(await collegeBusesApi.issues(selected._id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
    }
  }, [selected]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Nothing at all until the first response lands. A card that flashes "all
  // clear" before the data arrives is worse than a beat of silence.
  if (items === null && !error) return null;

  if (error) {
    return (
      <div className="alert alert-error">
        Couldn&rsquo;t check bus issues — {error}
      </div>
    );
  }

  if (items !== null && items.length === 0) {
    return (
      <div className="issues-clear">
        <span className="issues-clear-icon" aria-hidden>
          <IconCheck size={14} />
        </span>
        <span>No bus has reported a problem.</span>
      </div>
    );
  }

  const list = items ?? [];

  return (
    <div className="issues-panel">
      <div className="issues-head">
        <span className="issues-head-dot" aria-hidden />
        <h2 className="issues-head-title">
          {list.length} bus{list.length === 1 ? "" : "es"} need
          {list.length === 1 ? "s" : ""} attention
        </h2>
        <span className="issues-head-meta">Updates every 30s</span>
      </div>

      <div className="issues-list">
        {list.map((item) => {
          const meta = ISSUE_META[item.issue.type] ?? ISSUE_META.other;
          return (
            <div key={item.bus._id} className="issue-row">
              <span className="issue-emoji" aria-hidden>
                {meta.emoji}
              </span>

              <div className="issue-main">
                <div className="issue-titleline">
                  <span className="issue-label">{meta.label}</span>
                  <span className="issue-age">{since(item.issue.reportedAt)}</span>
                  {item.driver.tripActive ? (
                    <span className="pill pill-accent">On trip</span>
                  ) : (
                    <span className="pill pill-danger">Off the road</span>
                  )}
                </div>

                <div className="issue-bus">
                  <IconBus size={14} />
                  <Link href={`/buses/${item.bus._id}`} className="issue-buslink">
                    Bus {item.bus.busNumber}
                  </Link>
                  <span className="muted">
                    {item.bus.plateNumber}
                    {item.bus.route ? ` · ${item.bus.route}` : ""}
                  </span>
                  <span className="issue-riders">
                    {item.studentCount} student
                    {item.studentCount === 1 ? "" : "s"} affected
                  </span>
                </div>

                {item.issue.message && (
                  <p className="issue-message">&ldquo;{item.issue.message}&rdquo;</p>
                )}
              </div>

              <div className="issue-driver">
                <span className="issue-driver-avatar" aria-hidden>
                  {initialsOf(item.driver.name)}
                </span>
                <span className="issue-driver-body">
                  <span className="issue-driver-name">{item.driver.name}</span>
                  <span className="issue-driver-meta">
                    Licence {item.driver.licenceNumber}
                  </span>
                </span>
                <a
                  href={`tel:${item.driver.mobile.replace(/\D/g, "")}`}
                  className="btn btn-secondary btn-sm"
                  title={`Call ${item.driver.name} on ${item.driver.mobile}`}
                >
                  <IconPhone size={13} /> {item.driver.mobile}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
