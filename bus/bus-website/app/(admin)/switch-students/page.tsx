"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import { collegeBusesApi, type Bus } from "../../../lib/api/collegeBuses";
import {
  collegeStudentsApi,
  type Student,
} from "../../../lib/api/collegeStudents";
import { NoCollege } from "../../../components/NoCollege";
import { IconBus, IconUsers, IconX } from "../../../components/icons";

// Bus-to-bus transfer, not student-by-student picking.
//
// The real job is "bus 3 is off the road on Friday — put its students on bus
// 5". So the flow is: choose the bus they are leaving, then choose the bus
// they are joining. The whole roster comes along by default; unticking a few
// is the exception, not the starting point.
const POOL = "unassigned";

export default function SwitchStudentsPage() {
  const { selected: college } = useColleges();
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  // Which bus the set is coming from — a bus id, or POOL for the bench.
  const [fromId, setFromId] = useState<string | null>(null);
  // Members of that roster that will actually travel. Seeded with everyone.
  const [taking, setTaking] = useState<Set<string>>(new Set());
  const [savingBusId, setSavingBusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!college) return;
    setError(null);
    try {
      const [bs, ss] = await Promise.all([
        collegeBusesApi.list(college._id),
        collegeStudentsApi.list(college._id),
      ]);
      setBuses(bs);
      setStudents(ss);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [college]);

  useEffect(() => {
    setBuses(null);
    setFromId(null);
    load();
  }, [load]);

  const byBus = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of students) {
      const key = s.bus ? s.bus._id : POOL;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [students]);

  // Picking a source takes its whole roster; that is the common case.
  const chooseSource = useCallback(
    (id: string) => {
      setFlash(null);
      if (fromId === id) {
        setFromId(null);
        setTaking(new Set());
        return;
      }
      setFromId(id);
      setTaking(new Set((byBus.get(id) ?? []).map((s) => s._id)));
    },
    [fromId, byBus]
  );

  const clearSource = useCallback(() => {
    setFromId(null);
    setTaking(new Set());
  }, []);

  const toggleStudent = useCallback((id: string) => {
    setTaking((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Escape backs out one step at a time: clear a live search first, then the
  // source selection.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (query) {
        setQuery("");
        return;
      }
      if (fromId) clearSource();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, fromId, clearSource]);

  const q = query.trim().toLowerCase();

  const matchesStudent = useCallback(
    (s: Student) =>
      !q ||
      [s.name, s.rollNumber, s.mobile, s.stop]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
    [q]
  );

  // A bus stays visible if it matches itself or if any of its students do —
  // searching a roll number should reveal the bus that student rides. The
  // chosen source always stays on screen, or the move loses its anchor.
  const visibleBuses = useMemo(() => {
    if (!q) return buses ?? [];
    return (buses ?? []).filter((b) => {
      if (b._id === fromId) return true;
      const own = [b.busNumber, b.plateNumber, b.route]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
      return own || (byBus.get(b._id) ?? []).some(matchesStudent);
    });
  }, [buses, q, byBus, matchesStudent, fromId]);

  const pool = useMemo(() => byBus.get(POOL) ?? [], [byBus]);
  const visiblePool = useMemo(
    () => pool.filter(matchesStudent),
    [pool, matchesStudent]
  );

  const fromBus = useMemo(
    () => (buses ?? []).find((b) => b._id === fromId) ?? null,
    [buses, fromId]
  );
  const fromLabel = fromId === POOL ? "Unassigned" : `Bus ${fromBus?.busNumber}`;

  const move = useCallback(
    async (toBusId: string | null) => {
      if (!college || !fromId || taking.size === 0) return;
      setError(null);
      setFlash(null);
      setSavingBusId(toBusId ?? POOL);
      const ids = [...taking];
      const label = fromLabel;
      try {
        const { students: changed } = await collegeStudentsApi.reassignBus(
          college._id,
          ids,
          toBusId
        );
        setStudents((prev) => {
          const byId = new Map(changed.map((s) => [s._id, s]));
          return prev.map((s) => byId.get(s._id) ?? s);
        });
        const to = toBusId
          ? `bus ${(buses ?? []).find((b) => b._id === toBusId)?.busNumber}`
          : "the unassigned list";
        setFlash(
          `${ids.length} student${
            ids.length === 1 ? "" : "s"
          } moved from ${label} to ${to}.`
        );
        clearSource();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSavingBusId(null);
      }
    },
    [college, fromId, taking, fromLabel, buses, clearSource]
  );

  if (!college) return <NoCollege />;

  const totalSeated = students.filter((s) => s.bus).length;

  // The roster panel that replaces a source card's normal body.
  function renderRoster(list: Student[]) {
    const shown = q ? list.filter(matchesStudent) : list;
    return (
      <>
        <div className="switch-roster-tools">
          <span>
            {taking.size} of {list.length} coming
          </span>
          <button
            type="button"
            className="switch-roster-all"
            onClick={() =>
              setTaking(
                taking.size === list.length
                  ? new Set()
                  : new Set(list.map((s) => s._id))
              )
            }
          >
            {taking.size === list.length ? "None" : "All"}
          </button>
        </div>
        <div className="switch-rider-list">
          {shown.map((s) => (
            <button
              key={s._id}
              type="button"
              className="switch-rider"
              data-picked={taking.has(s._id)}
              onClick={() => toggleStudent(s._id)}
              title={`${s.rollNumber} · ${s.mobile}`}
            >
              <span className="switch-rider-check" aria-hidden>
                {taking.has(s._id) ? "✓" : ""}
              </span>
              <span className="switch-chip-body">
                <span className="switch-rider-name">{s.name}</span>
                <span className="switch-rider-meta">
                  {s.rollNumber}
                  {s.stop ? ` · ${s.stop}` : ""}
                </span>
              </span>
            </button>
          ))}
          {q && shown.length < list.length && (
            <span className="switch-rider-more">
              +{list.length - shown.length} not matching
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Switch students</h1>
          <p className="page-subtitle">
            Move a bus&rsquo;s students to another bus in one go. {totalSeated}{" "}
            of {students.length} students seated · {pool.length} unassigned.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {flash && !error && <div className="alert alert-success">{flash}</div>}

      <div className="toolbar">
        <input
          className="field-control toolbar-search"
          placeholder="Search buses or students — number, plate, route, name, roll, mobile…"
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
              } · ${visiblePool.length} unassigned`
            : `${(buses ?? []).length} buses · ${pool.length} unassigned`}
        </span>
      </div>

      {fromId ? (
        <div className="switch-banner">
          <span className="switch-banner-avatar">{taking.size}</span>
          <div className="switch-banner-text">
            <strong>
              Moving {taking.size} student{taking.size === 1 ? "" : "s"} from{" "}
              {fromLabel}
            </strong>
            <span>
              {taking.size === 0
                ? "Tick at least one student in the highlighted card."
                : "Now choose the bus they are joining — every bus with room shows a Move button."}
            </span>
          </div>
          <button type="button" className="btn btn-quiet" onClick={clearSource}>
            <IconX size={14} /> Cancel
          </button>
        </div>
      ) : (
        <div className="switch-hint">
          Step 1 — click <strong>Move students</strong> on the bus they are
          leaving. The whole roster is taken by default; untick anyone staying
          behind.
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
              <div className="switch-bus-grid switch-bus-grid-wide">
                {visibleBuses.map((bus) => {
                  const riders = byBus.get(bus._id) ?? [];
                  const isSource = fromId === bus._id;
                  const isSaving = savingBusId === bus._id;

                  // Nobody on a destination bus is leaving it, so its own
                  // riders always count against capacity.
                  const free = bus.capacity - riders.length;
                  const overflows = taking.size > free;
                  const targetable = !!fromId && !isSource && taking.size > 0;

                  return (
                    <div
                      key={bus._id}
                      className="switch-bus"
                      data-source={isSource}
                      data-targetable={targetable && !overflows}
                      data-full={targetable && overflows}
                    >
                      <div className="switch-bus-head">
                        <span className="switch-bus-number">
                          Bus {bus.busNumber}
                        </span>
                        <span className="switch-bus-plate">
                          {bus.plateNumber}
                        </span>
                      </div>
                      <div className="switch-bus-meta">
                        <span className="switch-bus-route">
                          {bus.route || "No route set"}
                        </span>
                        <span
                          className="switch-seats"
                          data-tight={riders.length >= bus.capacity}
                        >
                          {riders.length} / {bus.capacity}
                        </span>
                      </div>

                      {isSource ? (
                        renderRoster(riders)
                      ) : riders.length === 0 ? (
                        <div className="switch-driver-empty">
                          <IconUsers size={13} /> No students
                        </div>
                      ) : (
                        <div className="switch-roster-summary">
                          <IconUsers size={13} /> {riders.length} student
                          {riders.length === 1 ? "" : "s"}
                          {q &&
                            riders.some(matchesStudent) &&
                            ` · ${
                              riders.filter(matchesStudent).length
                            } matching`}
                        </div>
                      )}

                      {targetable ? (
                        <button
                          type="button"
                          className="switch-drop"
                          onClick={() => move(bus._id)}
                          disabled={isSaving || overflows}
                          title={
                            overflows
                              ? `Only ${Math.max(0, free)} seat(s) free`
                              : undefined
                          }
                        >
                          {isSaving ? (
                            <span className="spinner" />
                          ) : overflows ? (
                            <>
                              Only {Math.max(0, free)} seat
                              {free === 1 ? "" : "s"} free
                            </>
                          ) : (
                            <>Move {taking.size} here</>
                          )}
                        </button>
                      ) : (
                        !fromId &&
                        riders.length > 0 && (
                          <button
                            type="button"
                            className="switch-source-btn"
                            onClick={() => chooseSource(bus._id)}
                          >
                            Move students
                          </button>
                        )
                      )}

                      {isSource && (
                        <button
                          type="button"
                          className="switch-source-btn"
                          onClick={clearSource}
                        >
                          <IconX size={13} /> Cancel
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
              <IconUsers size={15} />
              <h2>Unassigned students</h2>
              <span className="switch-count">
                {q ? `${visiblePool.length} of ${pool.length}` : pool.length}
              </span>
            </header>

            {/* The bench is both a source and a destination. */}
            {fromId && fromId !== POOL && taking.size > 0 && (
              <button
                type="button"
                className="switch-drop switch-drop-block"
                onClick={() => move(null)}
                disabled={savingBusId === POOL}
              >
                {savingBusId === POOL ? (
                  <span className="spinner" />
                ) : (
                  <>Move {taking.size} here</>
                )}
              </button>
            )}

            {!fromId && pool.length > 0 && (
              <button
                type="button"
                className="switch-source-btn switch-source-block"
                onClick={() => chooseSource(POOL)}
              >
                Move students onto a bus
              </button>
            )}

            {fromId === POOL ? (
              <div className="switch-pool-source">{renderRoster(pool)}</div>
            ) : pool.length === 0 ? (
              <p className="switch-empty">Every student is on a bus.</p>
            ) : visiblePool.length === 0 ? (
              <p className="switch-empty">
                No unassigned student matches &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="switch-pool-list">
                {visiblePool.map((s) => (
                  <div key={s._id} className="switch-driver-chip switch-chip-pool switch-chip-static">
                    <span className="switch-chip-avatar">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="switch-chip-body">
                      <span className="switch-chip-name">{s.name}</span>
                      <span className="switch-chip-meta">
                        {s.rollNumber} · {s.mobile}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
