"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useColleges } from "../../../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
} from "../../../../../lib/api/collegeBuses";
import { NoCollege } from "../../../../../components/NoCollege";
import {
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconX,
} from "../../../../../components/icons";

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
  const [stopInput, setStopInput] = useState("");
  const [stops, setStops] = useState<string[]>([]);
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
    if (stops.includes(v)) {
      setStopInput("");
      return;
    }
    setStops((prev) => [...prev, v]);
    setStopInput("");
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveStop(idx: number, delta: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function onSave() {
    if (!selected || !bus) return;
    setError(null);
    setBusy(true);
    try {
      await collegeBusesApi.setRoute(selected._id, bus._id, {
        route: route.trim(),
        stops,
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

      <div className="card" style={{ maxWidth: 760 }}>
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
        </div>

        {stops.length === 0 ? (
          <p className="muted small">No stops added yet.</p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              display: "grid",
              gap: 6,
            }}
          >
            {stops.map((s, i) => (
              <li
                key={`${s}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--surface-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <span
                  className="muted small"
                  style={{ fontWeight: 600 }}
                >
                  {i + 1}.
                </span>
                <span style={{ fontWeight: 500 }}>{s}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveStop(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <IconArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveStop(i, 1)}
                    disabled={i === stops.length - 1}
                    aria-label="Move down"
                  >
                    <IconArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeStop(i)}
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

        <p className="small muted" style={{ marginTop: 16 }}>
          Students whose stop is removed from the route will lose their stop
          automatically.
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
