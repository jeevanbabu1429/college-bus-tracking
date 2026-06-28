"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export type MapStop = {
  name: string;
  lat: number | null;
  lng: number | null;
  suspended: boolean;
};

type Props = {
  stops: MapStop[];
  /** Index of the stop currently being placed/edited (highlighted). */
  selectedIndex: number | null;
  /** Map clicked — caller decides what to do (usually place the selected stop). */
  onPlace: (lat: number, lng: number) => void;
  /** A marker was dragged to a new position. */
  onMove: (index: number, lat: number, lng: number) => void;
};

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export function StopMap({ stops, selectedIndex, onPlace, onMove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  // Keep latest callbacks so the persistent click handler isn't stale.
  const onPlaceRef = useRef(onPlace);
  const onMoveRef = useRef(onMove);
  onPlaceRef.current = onPlace;
  onMoveRef.current = onMove;

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      onPlaceRef.current(e.latlng.lat, e.latlng.lng);
    });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Leaflet sometimes mis-measures inside flex/grid until a resize tick.
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers + the route polyline whenever stops/selection change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const placed = stops.filter(
      (s) => typeof s.lat === "number" && typeof s.lng === "number"
    ) as { name: string; lat: number; lng: number; suspended: boolean }[];

    if (placed.length >= 2) {
      L.polyline(
        placed.map((s) => [s.lat, s.lng] as [number, number]),
        { color: "#ff8a5b", weight: 3, opacity: 0.7 }
      ).addTo(layer);
    }

    stops.forEach((s, i) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      const bg = s.suspended
        ? "#9ca3af"
        : i === selectedIndex
        ? "#ff8a5b"
        : "#1a1d29";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([s.lat, s.lng], { icon, draggable: true }).addTo(
        layer
      );
      marker.bindTooltip(s.name + (s.suspended ? " (suspended)" : ""));
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onMoveRef.current(i, ll.lat, ll.lng);
      });
    });

    // Fit to the placed stops once, on first load.
    if (!fittedRef.current && placed.length > 0) {
      fittedRef.current = true;
      if (placed.length === 1) {
        map.setView([placed[0].lat, placed[0].lng], 15);
      } else {
        map.fitBounds(
          placed.map((s) => [s.lat, s.lng] as [number, number]),
          { padding: [40, 40] }
        );
      }
    }
  }, [stops, selectedIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 360,
        width: "100%",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}
