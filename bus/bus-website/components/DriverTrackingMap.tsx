"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { IconPhone, IconTarget, IconX } from "./icons";

export type TrackedStop = {
  name: string;
  lat: number;
  lng: number;
  suspended: boolean;
};

export type TrackedBus = {
  id: string;
  busNumber: string;
  plateNumber: string;
  driverName: string;
  driverMobile: string;
  route: string;
  lat: number;
  lng: number;
  updatedAt: string;
  selected: boolean;
  /** Placed stops of this bus's route, in order. Drawn for the selected bus. */
  stops: TrackedStop[];
};

type Props = {
  buses: TrackedBus[];
  /** When true, refit the map to the buses every time the list changes. */
  followAll: boolean;
  onSelect: (id: string) => void;
  /** Dismiss the driver card and go back to following everyone. */
  onClear: () => void;
};

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const FOCUS_ZOOM = 15;

// Markers live in a small registry so we can move existing ones instead of
// re-creating them on every poll — keeps the map smooth even at 8s intervals.
export function DriverTrackingMap({
  buses,
  followAll,
  onSelect,
  onClear,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const prevSelectedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const selected = buses.find((b) => b.selected) ?? null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Own zoom control so we can place and restyle it (see .leaflet-control-zoom
    // in globals.css).
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      INDIA_CENTER,
      5
    );
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Vehicle markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const next = new Set(buses.map((b) => b.id));
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const b of buses) {
      const icon = L.divIcon({
        className: "",
        html: busMarkerHtml(b),
        iconSize: [76, 62],
        iconAnchor: [38, 46],
      });
      const existing = markersRef.current.get(b.id);
      if (existing) {
        existing.setLatLng([b.lat, b.lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltipHtml(b));
      } else {
        const marker = L.marker([b.lat, b.lng], {
          icon,
          zIndexOffset: 400,
        }).addTo(map);
        marker.bindTooltip(tooltipHtml(b), {
          direction: "top",
          offset: [0, -44],
          className: "tracker-tooltip",
        });
        marker.on("click", () => onSelectRef.current(b.id));
        markersRef.current.set(b.id, marker);
      }
    }

    if (followAll && buses.length > 0) {
      if (buses.length === 1) {
        map.setView([buses[0].lat, buses[0].lng], FOCUS_ZOOM);
      } else {
        map.fitBounds(
          buses.map((b) => [b.lat, b.lng] as [number, number]),
          { padding: [70, 70] }
        );
      }
    }
  }, [buses, followAll]);

  // Route of the selected bus: a thin line through its placed stops, small dots
  // on the way, and a flag on the last one.
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!selected) return;

    const path = selected.stops.map((s) => [s.lat, s.lng] as [number, number]);
    if (path.length >= 2) {
      // Halo underneath keeps the line readable over busy map tiles.
      L.polyline(path, {
        color: "#ffffff",
        weight: 6,
        opacity: 0.85,
      }).addTo(layer);
      L.polyline(path, {
        color: "#1a1d29",
        weight: 2.5,
        opacity: 0.9,
      }).addTo(layer);
    }

    selected.stops.forEach((s, i) => {
      const isLast = i === selected.stops.length - 1;
      if (isLast) {
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "",
            html: flagMarkerHtml(),
            iconSize: [26, 30],
            iconAnchor: [4, 29],
          }),
          zIndexOffset: 200,
        })
          .addTo(layer)
          .bindTooltip(`Last stop · ${escapeHtml(s.name)}`, {
            direction: "top",
            className: "tracker-tooltip",
          });
        return;
      }
      L.circleMarker([s.lat, s.lng], {
        radius: 4,
        color: "#ffffff",
        weight: 2,
        fillColor: s.suspended ? "#9ca3af" : "#1a1d29",
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindTooltip(
          escapeHtml(s.name) + (s.suspended ? " (suspended)" : ""),
          { direction: "top", className: "tracker-tooltip" }
        );
    });
  }, [selected]);

  // Fly to a bus the moment it becomes the selected one — but never on the
  // 8-second refresh, otherwise the map would yank itself back while panning.
  useEffect(() => {
    const map = mapRef.current;
    const id = selected?.id ?? null;
    if (map && selected && id !== prevSelectedRef.current) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 14), {
        duration: 0.6,
      });
    }
    prevSelectedRef.current = id;
  }, [selected]);

  function recenter() {
    const map = mapRef.current;
    if (map && selected) map.flyTo([selected.lat, selected.lng], FOCUS_ZOOM);
  }

  return (
    <div className="tracker-map-wrap">
      <div ref={containerRef} className="tracker-map" />

      {selected && (
        <div className="tracker-card">
          <button
            type="button"
            className="tracker-card-close"
            onClick={onClear}
            aria-label="Close driver details"
          >
            <IconX size={14} />
          </button>

          <span className="tracker-card-avatar" aria-hidden>
            {initials(selected.driverName)}
          </span>
          <div className="tracker-card-name">{selected.driverName}</div>
          <div className="tracker-card-meta">
            {selected.busNumber} · {selected.plateNumber}
          </div>
          {selected.route && (
            <div className="tracker-card-route">{selected.route}</div>
          )}

          <div className="tracker-card-actions">
            {selected.driverMobile ? (
              <a
                href={`tel:${selected.driverMobile}`}
                className="tracker-action tracker-action-call"
                title={`Call ${selected.driverMobile}`}
                aria-label={`Call ${selected.driverName}`}
              >
                <IconPhone size={17} />
              </a>
            ) : (
              <span
                className="tracker-action tracker-action-call is-disabled"
                title="No mobile number on file"
                aria-hidden
              >
                <IconPhone size={17} />
              </span>
            )}
            <button
              type="button"
              className="tracker-action tracker-action-focus"
              onClick={recenter}
              title="Centre the map on this bus"
              aria-label="Centre the map on this bus"
            >
              <IconTarget size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function busMarkerHtml(b: TrackedBus): string {
  return `
<div class="tracker-marker${b.selected ? " is-selected" : ""}">
  <span class="tracker-marker-label">${escapeHtml(b.busNumber)}</span>
  <span class="tracker-marker-vehicle">
    <svg viewBox="0 0 40 24" width="42" height="26" aria-hidden="true">
      <rect x="2" y="3" width="34" height="14" rx="3.5" fill="currentColor"/>
      <rect x="5" y="6" width="7" height="5" rx="1.2" fill="#cfe1ff"/>
      <rect x="14" y="6" width="7" height="5" rx="1.2" fill="#cfe1ff"/>
      <rect x="23" y="6" width="7" height="5" rx="1.2" fill="#cfe1ff"/>
      <rect x="32.5" y="7" width="2.5" height="3.5" rx="1" fill="#ffd27a"/>
      <circle cx="11" cy="17.5" r="3.4" fill="#12141c"/>
      <circle cx="11" cy="17.5" r="1.4" fill="#b8bec9"/>
      <circle cx="28" cy="17.5" r="3.4" fill="#12141c"/>
      <circle cx="28" cy="17.5" r="1.4" fill="#b8bec9"/>
    </svg>
  </span>
</div>`;
}

function flagMarkerHtml(): string {
  return `
<div class="tracker-flag">
  <svg viewBox="0 0 26 30" width="26" height="30" aria-hidden="true">
    <path d="M4 29V1" stroke="#1a1d29" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M5.5 2.5h16l-4 5.5 4 5.5h-16z" fill="#ef4444"/>
  </svg>
</div>`;
}

function tooltipHtml(b: TrackedBus): string {
  const ago = Math.max(
    0,
    Math.round((Date.now() - new Date(b.updatedAt).getTime()) / 1000)
  );
  const when = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
  return `<strong>${escapeHtml(b.busNumber)}</strong> · ${escapeHtml(
    b.driverName
  )}<br><span class="tracker-tooltip-sub">${when}</span>`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
