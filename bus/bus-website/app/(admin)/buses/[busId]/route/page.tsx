"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
  type BusStop,
} from "../../../../../lib/api/collegeBuses";
import { NoCollege } from "../../../../../components/NoCollege";
import {
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconX,
} from "../../../../../components/icons";

// Leaflet touches `window`, so load the map only on the client.
const StopMap = dynamic(
  () => import("../../../../../components/StopMap").then((m) => m.StopMap),
  {
    ssr: false,
    loading: () => (
      <div className="center" style={{ height: 360 }}>
        <span className="spinner" />
      </div>
    ),
  }
);

export default function SetBusRoutePage({
  params,
}: {
  params: Promise<{ busId: string }>;
}) {
  const { busId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState("");
  const [notice, setNotice] = useState("");
  const [stopInput, setStopInput] = useState("");
  const [stops, setStops] = useState<BusStop[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const all = await collegeBusesApi.list(selected._id);
      const found = all.find((b) => b._id === busId);
      if (!found) {
        setError("Bus not found");
        return;
      }
      setBus(found);
      setRoute(found.route ?? "");
      setNotice(found.notice ?? "");
      setStops(found.stops ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected, busId]);

  useEffect(() => {
    setBus(null);
    load();
  }, [load]);

  function addStop() {
    const v = stopInput.trim();
    if (!v) return;
    if (stops.some((s) => s.name === v)) {
      setStopInput("");
      return;
    }
    setStops((prev) => [
      ...prev,
      { name: v, lat: null, lng: null, suspended: false },
    ]);
    setSelectedIndex(stops.length); // select the new stop so it can be placed
    setStopInput("");
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex(null);
  }

  function moveStop(idx: number, delta: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSelectedIndex(null);
  }

  function toggleSuspend(idx: number) {
    setStops((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, suspended: !s.suspended } : s))
    );
  }

  const placeSelected = useCallback(
    (lat: number, lng: number) => {
      setSelectedIndex((sel) => {
        if (sel === null) return sel;
        setStops((prev) =>
          prev.map((s, i) =>
            i === sel ? { ...s, lat: round(lat), lng: round(lng) } : s
          )
        );
        return sel;
      });
    },
    []
  );

  const moveMarker = useCallback((index: number, lat: number, lng: number) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, lat: round(lat), lng: round(lng) } : s
      )
    );
  }, []);

  async function onSave() {
    if (!selected || !bus) return;
    setError(null);
    setBusy(true);
    try {
      await collegeBusesApi.setRoute(selected._id, bus._id, {
        route: route.trim(),
        stops,
        notice: notice.trim(),
      });
      router.push(`/buses/${bus._id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!selected) return <NoCollege />;
  if (bus === null) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  const placedCount = stops.filter(
    (s) => typeof s.lat === "number" && typeof s.lng === "number"
  ).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Edit route</h1>
          <p className="page-subtitle">
            Bus {bus.busNumber} · {bus.plateNumber}
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 820 }}>
        <div className="field">
          <label className="field-label">Route name</label>
          <input
            className="field-control"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="e.g. Main campus → hostel loop"
          />
        </div>

        <div className="field">
          <label className="field-label">
            Notice (shown to students &amp; drivers)
          </label>
          <textarea
            className="field-control"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            placeholder="e.g. Anna Nagar stop closed May 24–31 (road work) — board at Main Road."
          />
        </div>

        <div className="field">
          <label className="field-label">Add a stop</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="field-control"
              value={stopInput}
              onChange={(e) => setStopInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStop();
                }
              }}
              placeholder="Stop name"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={addStop}>
              <IconPlus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="field-label" style={{ marginTop: 4, marginBottom: 10 }}>
          Stops in order
          {selectedIndex !== null && stops[selectedIndex] && (
            <span className="muted small" style={{ fontWeight: 400 }}>
              {" "}
              — click the map to place “{stops[selectedIndex].name}”
            </span>
          )}
        </div>

        {stops.length === 0 ? (
          <p className="muted small">No stops added yet.</p>
        ) : (
          <ol style={{ listStyle: "none", display: "grid", gap: 6 }}>
            {stops.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                onClick={() => setSelectedIndex(i)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background:
                    i === selectedIndex
                      ? "var(--accent-soft)"
                      : "var(--surface-muted)",
                  border: `1px solid ${
                    i === selectedIndex ? "var(--accent)" : "var(--border)"
                  }`,
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  opacity: s.suspended ? 0.6 : 1,
                }}
              >
                <span className="muted small" style={{ fontWeight: 600 }}>
                  {i + 1}.
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 500,
                      textDecoration: s.suspended ? "line-through" : "none",
                    }}
                  >
                    {s.name}
                  </span>{" "}
                  {s.lat != null && s.lng != null ? (
                    <span className="muted small">· 📍 placed</span>
                  ) : (
                    <span className="muted small">· no location</span>
                  )}
                  {s.suspended && (
                    <span
                      className="pill pill-danger"
                      style={{ marginLeft: 8 }}
                    >
                      Suspended
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-subtle btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSuspend(i);
                    }}
                  >
                    {s.suspended ? "Resume" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStop(i, -1);
                    }}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <IconArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStop(i, 1);
                    }}
                    disabled={i === stops.length - 1}
                    aria-label="Move down"
                  >
                    <IconArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStop(i);
                    }}
                    aria-label="Remove"
                    style={{ color: "var(--danger)" }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Map ({placedCount}/{stops.length} stops placed) — select a stop, then
            click to drop its pin; drag a pin to adjust.
          </div>
          <StopMap
            stops={stops}
            selectedIndex={selectedIndex}
            onPlace={placeSelected}
            onMove={moveMarker}
          />
        </div>

        <p className="small muted" style={{ marginTop: 16 }}>
          Suspending a stop keeps students assigned to it — they’re shown the
          notice and the nearest open stop. Removing a stop entirely un-assigns
          its students.
        </p>

        <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={onSave} disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : "Save route"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
