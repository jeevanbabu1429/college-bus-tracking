"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type LiveBusItem,
} from "../../../lib/api/collegeBuses";
import { NoCollege } from "../../../components/NoCollege";
import { IconArrowLeft, IconBus, IconBadge } from "../../../components/icons";

const POLL_MS = 8000;

const DriverTrackingMap = dynamic(
  () =>
    import("../../../components/DriverTrackingMap").then(
      (m) => m.DriverTrackingMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="center" style={{ height: 480 }}>
        <span className="spinner" />
      </div>
    ),
  }
);

export default function TrackDriversPage() {
  const { selected } = useColleges();
  const [items, setItems] = useState<LiveBusItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followAll, setFollowAll] = useState(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!selected) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await collegeBusesApi.live(selected._id);
      setItems(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlightRef.current = false;
    }
  }, [selected]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Only buses with an actual lat/lng can be plotted. Keep the list (left
  // panel) showing all active drivers, but feed the map only the placed ones.
  const placed = useMemo(() => {
    if (!items) return [];
    return items
      .filter(
        (i) =>
          i.driver.currentLocation &&
          typeof i.driver.currentLocation.lat === "number" &&
          typeof i.driver.currentLocation.lng === "number"
      )
      .map((i) => ({
        id: i.bus._id,
        busNumber: i.bus.busNumber,
        driverName: i.driver.name,
        lat: i.driver.currentLocation!.lat,
        lng: i.driver.currentLocation!.lng,
        updatedAt: i.driver.currentLocation!.updatedAt,
        selected: i.bus._id === selectedId,
      }));
  }, [items, selectedId]);

  if (!selected) return <NoCollege />;

  const activeCount = items?.length ?? 0;
  const placedCount = placed.length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Track drivers</h1>
          <p className="page-subtitle">
            Live position of every driver whose trip is active in{" "}
            {selected.name}. Updates every {Math.round(POLL_MS / 1000)} seconds.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/dashboard" className="btn btn-secondary">
            <IconArrowLeft size={14} /> Back to dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ maxWidth: 980 }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 320px) 1fr",
          alignItems: "start",
        }}
      >
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {activeCount} driver{activeCount === 1 ? "" : "s"} on trip
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>
                {placedCount} on the map
                {placedCount < activeCount && (
                  <>
                    {" · "}
                    {activeCount - placedCount} waiting for first location
                  </>
                )}
              </div>
            </div>
            <label
              className="small muted"
              style={{ display: "flex", gap: 6, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={followAll}
                onChange={(e) => setFollowAll(e.target.checked)}
              />
              Follow
            </label>
          </div>

          {items === null ? (
            <div className="center" style={{ padding: 30 }}>
              <span className="spinner" />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24 }}>
              <p className="muted small">
                Nobody is on a trip right now. When a driver taps{" "}
                <strong>Start Trip</strong> on their phone, they&rsquo;ll appear
                here.
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((it) => {
                const placedNow =
                  it.driver.currentLocation &&
                  typeof it.driver.currentLocation.lat === "number";
                const isSelected = selectedId === it.bus._id;
                return (
                  <li
                    key={it.bus._id}
                    onClick={() => {
                      setSelectedId(it.bus._id);
                      setFollowAll(false);
                    }}
                    style={{
                      padding: "12px 16px",
                      borderTop: "1px solid var(--border)",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--accent-soft)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <IconBus size={14} /> {it.bus.busNumber}
                      </div>
                      <span
                        className={
                          placedNow ? "pill pill-success" : "pill pill-warning"
                        }
                      >
                        {placedNow ? "Live" : "No fix"}
                      </span>
                    </div>
                    <div
                      className="muted small"
                      style={{
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <IconBadge size={12} /> {it.driver.name}
                    </div>
                    {it.bus.route && (
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {it.bus.route}
                      </div>
                    )}
                    {placedNow && it.driver.currentLocation && (
                      <div
                        className="muted"
                        style={{ marginTop: 4, fontSize: 11 }}
                      >
                        {it.driver.currentLocation.lat.toFixed(5)},{" "}
                        {it.driver.currentLocation.lng.toFixed(5)} ·{" "}
                        <Ago iso={it.driver.currentLocation.updatedAt} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <DriverTrackingMap
            buses={placed}
            followAll={followAll && selectedId === null}
            onSelect={(id) => {
              setSelectedId(id);
              setFollowAll(false);
            }}
          />
          {selectedId !== null && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setSelectedId(null);
                  setFollowAll(true);
                }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Tiny self-refreshing "Xs ago" label that re-renders once per second without
// triggering a network call. Used inside the live list rows.
function Ago({ iso }: { iso: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return <>{seconds}s ago</>;
  return <>{Math.round(seconds / 60)}m ago</>;
}
