"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import { collegeBusesApi, type Bus } from "../../../lib/api/collegeBuses";
import {
  collegeDriversApi,
  type Driver,
} from "../../../lib/api/collegeDrivers";
import { NoCollege } from "../../../components/NoCollege";
import { IconBadge, IconBus, IconSwap, IconX } from "../../../components/icons";

// Two-step board: pick a driver, then pick where they go.
//
// Drag and drop would read nicer but needs a pointer, and this console gets
// used on laptops and tablets alike — select-then-place works with a mouse,
// a finger and a keyboard, and it makes the pending action reviewable before
// it commits (each bus spells out whether it is a placement or a swap).
export default function SwitchDriversPage() {
  const { selected } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [savingBusId, setSavingBusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      const [bs, ds] = await Promise.all([
        collegeBusesApi.list(selected._id),
        collegeDriversApi.list(selected._id),
      ]);
      setBuses(bs);
      setDrivers(ds);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setBuses(null);
    setPicked(null);
    load();
  }, [load]);

  // Escape backs out one step at a time: clear a live search first, then
  // cancel a pending move. Handled globally so it works wherever focus sits,
  // including inside the search box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (query) {
        setQuery("");
        return;
      }
      if (picked) setPicked(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, picked]);

  const driverById = useMemo(
    () => new Map(drivers.map((d) => [d._id, d])),
    [drivers]
  );

  const busByDriverId = useMemo(() => {
    const map = new Map<string, Bus>();
    for (const b of buses ?? []) if (b.driver) map.set(b.driver._id, b);
    return map;
  }, [buses]);

  const unassigned = useMemo(
    () => drivers.filter((d) => !busByDriverId.has(d._id)),
    [drivers, busByDriverId]
  );

  const q = query.trim().toLowerCase();

  // Buses match on their own identifiers *and* on their driver, so typing a
  // name surfaces the bus that driver is currently on.
  const visibleBuses = useMemo(() => {
    if (!q) return buses ?? [];
    return (buses ?? []).filter((b) =>
      [
        b.busNumber,
        b.plateNumber,
        b.route,
        b.driver?.name,
        b.driver?.mobile,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [buses, q]);

  const visibleUnassigned = useMemo(() => {
    if (!q) return unassigned;
    return unassigned.filter((d) =>
      [d.name, d.mobile, d.licenceNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [unassigned, q]);

  const pickedDriver = picked ? driverById.get(picked) ?? null : null;
  const pickedFromBus = picked ? busByDriverId.get(picked) ?? null : null;

  const move = useCallback(
    async (toBusId: string | null) => {
      if (!selected || !picked) return;
      setError(null);
      setFlash(null);
      setSavingBusId(toBusId ?? "unassigned");
      try {
        const { buses: changed } = await collegeBusesApi.reassignDriver(
          selected._id,
          picked,
          toBusId
        );
        // The endpoint returns only the buses it touched; patch those in
        // place rather than refetching the whole fleet.
        setBuses((prev) => {
          if (!prev) return prev;
          const byId = new Map(changed.map((b) => [b._id, b]));
          return prev.map((b) => byId.get(b._id) ?? b);
        });
        const name = pickedDriver?.name ?? "Driver";
        setFlash(
          toBusId
            ? `${name} moved.`
            : `${name} is now unassigned.`
        );
        setPicked(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSavingBusId(null);
      }
    },
    [selected, picked, pickedDriver]
  );

  if (!selected) return <NoCollege />;

  const assignedCount = (buses ?? []).filter((b) => b.driver).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Switch drivers</h1>
          <p className="page-subtitle">
            Pick a driver, then pick their bus. {assignedCount} of{" "}
            {(buses ?? []).length} buses have a driver · {unassigned.length}{" "}
            driver{unassigned.length === 1 ? "" : "s"} unassigned.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {flash && !error && <div className="alert alert-success">{flash}</div>}

      <div className="toolbar">
        <input
          className="field-control toolbar-search"
          placeholder="Search buses or drivers — number, plate, route, name, mobile…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setQuery("")}
          >
            <IconX size={13} /> Clear
          </button>
        )}
        <span className="toolbar-meta">
          {q
            ? `${visibleBuses.length} bus${
                visibleBuses.length === 1 ? "" : "es"
              } · ${visibleUnassigned.length} unassigned`
            : `${(buses ?? []).length} buses · ${unassigned.length} unassigned`}
        </span>
      </div>

      {picked && pickedDriver ? (
        <div className="switch-banner">
          <span className="switch-banner-avatar">
            {pickedDriver.name.charAt(0).toUpperCase()}
          </span>
          <div className="switch-banner-text">
            <strong>
              Moving {pickedDriver.name}
              {pickedDriver.mobile ? ` · ${pickedDriver.mobile}` : ""}
            </strong>
            <span>
              {pickedFromBus
                ? `Currently on bus ${pickedFromBus.busNumber}. Choose a destination — an occupied bus will swap the two drivers.`
                : "Currently unassigned. Choose a bus to place them on."}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setPicked(null)}
          >
            <IconX size={14} /> Cancel
          </button>
        </div>
      ) : (
        <div className="switch-hint">
          Click any driver — on a bus in the middle, or in the unassigned list
          on the right — to start a move.
        </div>
      )}

      {buses === null ? (
        <div className="center" style={{ padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : (
        <div className="switch-board">
          {/* ── Centre: the fleet ─────────────────────────────────────── */}
          <section className="switch-col switch-col-buses">
            <header className="switch-col-head">
              <IconBus size={15} />
              <h2>Buses</h2>
              <span className="switch-count">
                {q ? `${visibleBuses.length} of ${buses.length}` : buses.length}
              </span>
            </header>

            {buses.length === 0 ? (
              <p className="switch-empty">No buses in this college yet.</p>
            ) : visibleBuses.length === 0 ? (
              <p className="switch-empty">
                No buses match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="switch-bus-grid">
                {visibleBuses.map((bus) => {
                  const sitting = bus.driver;
                  const isOrigin = pickedFromBus?._id === bus._id;
                  const isSaving = savingBusId === bus._id;
                  const targetable = !!picked && !isOrigin;

                  return (
                    <div
                      key={bus._id}
                      className="switch-bus"
                      data-targetable={targetable}
                      data-origin={isOrigin}
                    >
                      <div className="switch-bus-head">
                        <span className="switch-bus-number">
                          Bus {bus.busNumber}
                        </span>
                        <span className="switch-bus-plate">
                          {bus.plateNumber}
                        </span>
                      </div>
                      {bus.route ? (
                        <span className="switch-bus-route">{bus.route}</span>
                      ) : (
                        <span className="switch-bus-route muted">
                          No route set
                        </span>
                      )}

                      {sitting ? (
                        <button
                          type="button"
                          className="switch-driver-chip"
                          data-picked={picked === sitting._id}
                          onClick={() =>
                            setPicked((p) =>
                              p === sitting._id ? null : sitting._id
                            )
                          }
                          title="Click to move this driver"
                        >
                          <span className="switch-chip-avatar">
                            {sitting.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="switch-chip-body">
                            <span className="switch-chip-name">
                              {sitting.name}
                            </span>
                            <span className="switch-chip-meta">
                              {sitting.mobile}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <div className="switch-driver-empty">
                          <IconBadge size={13} /> No driver
                        </div>
                      )}

                      {targetable && (
                        <button
                          type="button"
                          className="switch-drop"
                          onClick={() => move(bus._id)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <span className="spinner" />
                          ) : sitting ? (
                            <>
                              <IconSwap size={13} /> Swap with {sitting.name}
                            </>
                          ) : (
                            <>Place here</>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Right: the bench ──────────────────────────────────────── */}
          <aside className="switch-col switch-col-pool">
            <header className="switch-col-head">
              <IconBadge size={15} />
              <h2>Unassigned drivers</h2>
              <span className="switch-count">
                {q
                  ? `${visibleUnassigned.length} of ${unassigned.length}`
                  : unassigned.length}
              </span>
            </header>

            {picked && pickedFromBus && (
              <button
                type="button"
                className="switch-drop switch-drop-block"
                onClick={() => move(null)}
                disabled={savingBusId === "unassigned"}
              >
                {savingBusId === "unassigned" ? (
                  <span className="spinner" />
                ) : (
                  <>Move {pickedDriver?.name} here</>
                )}
              </button>
            )}

            {unassigned.length === 0 ? (
              <p className="switch-empty">Every driver is on a bus.</p>
            ) : visibleUnassigned.length === 0 ? (
              <p className="switch-empty">
                No unassigned driver matches &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="switch-pool-list">
                {visibleUnassigned.map((d) => (
                  <button
                    key={d._id}
                    type="button"
                    className="switch-driver-chip switch-chip-pool"
                    data-picked={picked === d._id}
                    onClick={() =>
                      setPicked((p) => (p === d._id ? null : d._id))
                    }
                    title="Click to place this driver on a bus"
                  >
                    <span className="switch-chip-avatar">
                      {d.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="switch-chip-body">
                      <span className="switch-chip-name">{d.name}</span>
                      <span className="switch-chip-meta">{d.mobile}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
