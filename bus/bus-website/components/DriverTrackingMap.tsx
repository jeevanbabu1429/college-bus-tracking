"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export type TrackedBus = {
  id: string;
  busNumber: string;
  driverName: string;
  lat: number;
  lng: number;
  updatedAt: string;
  selected: boolean;
};

type Props = {
  buses: TrackedBus[];
  /** When true, refit the map to the buses every time the list changes. */
  followAll: boolean;
  onSelect: (id: string) => void;
};

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

// Render lives in a small registry so we can move existing markers instead of
// re-creating them on every poll — keeps map smooth even at 8s intervals.
export function DriverTrackingMap({ buses, followAll, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const next = new Set(buses.map((b) => b.id));
    // Remove markers for buses that are no longer live.
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const b of buses) {
      const html = buildIconHtml(b);
      const icon = L.divIcon({
        className: "",
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const existing = markersRef.current.get(b.id);
      if (existing) {
        existing.setLatLng([b.lat, b.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltipText(b));
      } else {
        const marker = L.marker([b.lat, b.lng], { icon }).addTo(map);
        marker.bindTooltip(tooltipText(b), { direction: "top", offset: [0, -16] });
        marker.on("click", () => onSelectRef.current(b.id));
        markersRef.current.set(b.id, marker);
      }
    }

    if (followAll && buses.length > 0) {
      if (buses.length === 1) {
        map.setView([buses[0].lat, buses[0].lng], 15);
      } else {
        map.fitBounds(
          buses.map((b) => [b.lat, b.lng] as [number, number]),
          { padding: [60, 60] }
        );
      }
    }
  }, [buses, followAll]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 480,
        width: "100%",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}

function buildIconHtml(b: TrackedBus): string {
  const bg = b.selected ? "#ff8a5b" : "#1a1d29";
  const ring = b.selected ? "#ffd2bc" : "#cdd3df";
  return `
<div style="position:relative;width:44px;height:44px;">
  <div style="position:absolute;inset:0;border-radius:50%;background:${ring};opacity:.4;animation:pulse 2.2s ease-out infinite"></div>
  <div style="position:absolute;inset:6px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font:600 11px/1 system-ui;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">
    ${escapeHtml(b.busNumber).slice(0, 4)}
  </div>
</div>
<style>@keyframes pulse{0%{transform:scale(.8);opacity:.6}100%{transform:scale(1.4);opacity:0}}</style>
`;
}

function tooltipText(b: TrackedBus): string {
  const when = new Date(b.updatedAt);
  const ago = Math.max(0, Math.round((Date.now() - when.getTime()) / 1000));
  return `${escapeHtml(b.busNumber)} · ${escapeHtml(b.driverName)} · ${ago}s ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
      ? "&lt;"
      : c === ">"
      ? "&gt;"
      : c === '"'
      ? "&quot;"
      : "&#39;"
  );
}
