"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useColleges } from "../../../../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
  type BusStop,
} from "../../../../../../lib/api/collegeBuses";
import { NoCollege } from "../../../../../../components/NoCollege";
import {
  IconUpload,
  IconDownload,
  IconArrowLeft,
  IconCheck,
  IconX,
} from "../../../../../../components/icons";

type ParsedRow = {
  rowNumber: number;
  name: string;
  lat: string;
  lng: string;
  suspended: boolean;
  temporaryReplacement: string;
  error: string | null;
};

const HEADER_ALIASES: Record<
  string,
  "name" | "lat" | "lng" | "suspended" | "temporaryReplacement"
> = {
  name: "name",
  stopname: "name",
  "stop name": "name",
  "stop": "name",
  stop_name: "name",
  lat: "lat",
  latitude: "lat",
  lng: "lng",
  long: "lng",
  longitude: "lng",
  lon: "lng",
  suspended: "suspended",
  "is suspended": "suspended",
  closed: "suspended",
  temporaryreplacement: "temporaryReplacement",
  "temporary replacement": "temporaryReplacement",
  "temporary stop": "temporaryReplacement",
  temporarystop: "temporaryReplacement",
  "temp stop": "temporaryReplacement",
};

function normaliseHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function parseSuspendedCell(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

function parseCoord(v: unknown): { value: number | null; error: string | null } {
  if (v === "" || v === null || v === undefined) return { value: null, error: null };
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return { value: null, error: "must be a number" };
  return { value: n, error: null };
}

function validateRow(r: ParsedRow): string | null {
  if (!r.name.trim()) return "stop name is required";
  // lat and lng must come together or not at all
  const hasLat = r.lat.trim() !== "";
  const hasLng = r.lng.trim() !== "";
  if (hasLat !== hasLng) return "lat and lng must be provided together";
  if (hasLat) {
    const la = Number(r.lat);
    const lo = Number(r.lng);
    if (!Number.isFinite(la) || la < -90 || la > 90) return "lat must be between -90 and 90";
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) return "lng must be between -180 and 180";
  }
  return null;
}

export default function BulkRouteUploadPage({
  params,
}: {
  params: Promise<{ busId: string }>;
}) {
  const { busId } = use(params);
  const router = useRouter();
  const { selected } = useColleges();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bus, setBus] = useState<Bus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [notice, setNotice] = useState("");

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ stopsCount: number } | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await collegeBusesApi.list(selected._id);
        if (cancelled) return;
        const found = all.find((b) => b._id === busId);
        if (!found) {
          setLoadError("Bus not found");
          return;
        }
        setBus(found);
        setRouteName(found.route ?? "");
        setNotice(found.notice ?? "");
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, busId]);

  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setSubmitError(null);
    setDone(null);
    setRows([]);
    setFileName(file.name);

    let workbook: XLSX.WorkBook;
    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: "array" });
    } catch (err) {
      setParseError(`Could not read the file: ${(err as Error).message}`);
      return;
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      setParseError("The file has no sheets.");
      return;
    }
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });

    if (json.length === 0) {
      setParseError("The first sheet is empty.");
      return;
    }

    const firstRow = json[0];
    const columnMap: Record<string, string> = {};
    for (const key of Object.keys(firstRow)) {
      const norm = normaliseHeader(key);
      const target = HEADER_ALIASES[norm];
      if (target && !columnMap[target]) columnMap[target] = key;
    }

    if (!columnMap.name) {
      setParseError(
        `Missing required column: stopName (alias "name" or "stop"). Found columns: ${Object.keys(
          firstRow
        ).join(", ")}`
      );
      return;
    }

    const seen = new Set<string>();
    const parsed: ParsedRow[] = json.map((entry, idx) => {
      const name = String(entry[columnMap.name] ?? "").trim();
      const lat = columnMap.lat
        ? String(entry[columnMap.lat] ?? "").trim()
        : "";
      const lng = columnMap.lng
        ? String(entry[columnMap.lng] ?? "").trim()
        : "";
      const suspended = columnMap.suspended
        ? parseSuspendedCell(entry[columnMap.suspended])
        : false;
      const temporaryReplacement = columnMap.temporaryReplacement
        ? String(entry[columnMap.temporaryReplacement] ?? "").trim()
        : "";
      const draft: ParsedRow = {
        rowNumber: idx + 2,
        name,
        lat,
        lng,
        suspended,
        temporaryReplacement,
        error: null,
      };
      draft.error = validateRow(draft);
      if (!draft.error) {
        const key = name.toLowerCase();
        if (seen.has(key)) draft.error = "duplicate stop name in file";
        else seen.add(key);
      }
      return draft;
    });

    setRows(parsed);
  }, []);

  function reset() {
    setRows([]);
    setFileName(null);
    setParseError(null);
    setSubmitError(null);
    setDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPick() {
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { stopName: "Main Gate", lat: 13.0827, lng: 80.2707, suspended: false, temporaryStop: "" },
      { stopName: "Library", lat: 13.0832, lng: 80.272, suspended: false, temporaryStop: "" },
      { stopName: "Anna Nagar", lat: "", lng: "", suspended: false, temporaryStop: "" },
      { stopName: "Old Hostel", lat: 13.0901, lng: 80.275, suspended: true, temporaryStop: "Corner of Main & 5th" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stops");
    XLSX.writeFile(wb, "route-stops-template.xlsx");
  }

  async function onImport() {
    if (!selected || !bus) return;
    const valid = rows.filter((r) => r.error === null);
    if (valid.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const stops: BusStop[] = valid.map((r) => {
        const hasCoords = r.lat !== "" && r.lng !== "";
        const temp = r.temporaryReplacement.trim();
        return {
          name: r.name.trim(),
          lat: hasCoords ? round(Number(r.lat)) : null,
          lng: hasCoords ? round(Number(r.lng)) : null,
          suspended: r.suspended,
          // Only meaningful when suspended — server also enforces this, but
          // filtering here keeps the payload tidy.
          temporaryReplacement: r.suspended && temp ? temp : null,
        };
      });
      await collegeBusesApi.setRoute(selected._id, bus._id, {
        route: routeName.trim(),
        stops,
        notice: notice.trim(),
      });
      setDone({ stopsCount: stops.length });
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!selected) return <NoCollege />;
  if (loadError) return <div className="alert alert-error">{loadError}</div>;
  if (bus === null) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  const validCount = rows.filter((r) => r.error === null).length;
  const invalidCount = rows.length - validCount;
  const placedInValid = rows.filter(
    (r) => r.error === null && r.lat !== "" && r.lng !== ""
  ).length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Bulk upload route</h1>
          <p className="page-subtitle">
            Bus {bus.busNumber} · {bus.plateNumber}
          </p>
        </div>
        <div className="page-actions">
          <Link href={`/buses/${bus._id}/route`} className="btn btn-secondary">
            <IconArrowLeft size={14} /> Back to editor
          </Link>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={downloadTemplate}
          >
            <IconDownload size={14} /> Download template
          </button>
        </div>
      </div>

      {done ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>
            <IconCheck size={16} /> Route uploaded
          </div>
          <p className="muted small" style={{ marginBottom: 16 }}>
            {done.stopsCount} stop{done.stopsCount === 1 ? "" : "s"} saved for
            bus {bus.busNumber}. Existing stops that were removed have
            un-assigned their students.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push(`/buses/${bus._id}`)}
            >
              View bus
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push(`/buses/${bus._id}/route`)}
            >
              Open route editor
            </button>
            <button type="button" className="btn btn-quiet" onClick={reset}>
              Upload another file
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="alert alert-warning" style={{ maxWidth: 820 }}>
            Importing a file <strong>replaces</strong> this bus&rsquo;s current
            stops. Students whose stop is no longer in the new list will be
            un-assigned. Stops that you mark as suspended keep their students.
          </div>

          <div className="card" style={{ maxWidth: 820, marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>
              Route name &amp; notice
            </div>
            <div className="field">
              <label className="field-label">Route name</label>
              <input
                className="field-control"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
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
                placeholder="Optional"
              />
            </div>
            <p className="small muted">
              These two fields are saved along with the stops you upload below.
              Leave them as they are to keep the bus&rsquo;s current values.
            </p>
          </div>

          {rows.length === 0 ? (
            <>
              <label
                className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
                onClick={onPick}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <span className="dropzone-icon">
                  <IconUpload size={26} />
                </span>
                <div>
                  <div className="dropzone-title">
                    Drop your Excel or CSV file here
                  </div>
                  <div className="dropzone-sub">
                    or click to browse · .xlsx, .xls, .csv
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={onFileSelected}
                />
              </label>

              {parseError && (
                <div className="alert alert-error" style={{ maxWidth: 820 }}>
                  {parseError}
                </div>
              )}

              <div className="card" style={{ maxWidth: 820 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>
                  File format
                </div>
                <p className="muted small" style={{ marginBottom: 14 }}>
                  Your spreadsheet&rsquo;s first row should contain these column
                  headers (case-insensitive). The row order in the file is the
                  order of stops on the route.
                </p>
                <table className="table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Required</th>
                      <th>Example</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>stopName</strong>
                      </td>
                      <td>Yes</td>
                      <td>Main Gate</td>
                      <td className="muted">
                        Unique within this route. Aliases: name, stop.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>lat</strong>
                      </td>
                      <td>No</td>
                      <td>13.0827</td>
                      <td className="muted">
                        Between −90 and 90. Must be paired with lng.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>lng</strong>
                      </td>
                      <td>No</td>
                      <td>80.2707</td>
                      <td className="muted">
                        Between −180 and 180. Aliases: long, longitude, lon.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>suspended</strong>
                      </td>
                      <td>No</td>
                      <td>false</td>
                      <td className="muted">
                        true / false (also yes / no / 1 / 0).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div
                className="card"
                style={{ maxWidth: 820, marginBottom: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="card-title">{fileName}</div>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
                      <span style={{ color: "var(--success)" }}>
                        {validCount} valid
                      </span>
                      {invalidCount > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--danger)" }}>
                            {invalidCount} skipped
                          </span>
                        </>
                      )}
                      {" · "}
                      {placedInValid}/{validCount} with coordinates
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={reset}
                  >
                    Pick a different file
                  </button>
                </div>

                <div style={{ marginTop: 14, overflowX: "auto" }}>
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>Row</th>
                        <th>Stop name</th>
                        <th>Lat</th>
                        <th>Lng</th>
                        <th>Suspended</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="muted">{r.rowNumber}</td>
                          <td>{r.name || <span className="muted">—</span>}</td>
                          <td>
                            {r.lat || <span className="muted small">—</span>}
                          </td>
                          <td>
                            {r.lng || <span className="muted small">—</span>}
                          </td>
                          <td>
                            {r.suspended ? (
                              <span className="pill pill-warning">Yes</span>
                            ) : (
                              <span className="muted small">No</span>
                            )}
                          </td>
                          <td>
                            {r.error ? (
                              <span
                                className="pill pill-danger"
                                title={r.error}
                              >
                                {r.error}
                              </span>
                            ) : (
                              <span className="pill pill-success">
                                <IconCheck size={12} /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invalidCount > 0 && (
                  <p
                    className="alert alert-warning"
                    style={{ marginTop: 14 }}
                  >
                    <IconX size={14} /> {invalidCount} row
                    {invalidCount === 1 ? "" : "s"} will be skipped. Fix the
                    file and re-upload, or proceed with the {validCount} valid
                    row{validCount === 1 ? "" : "s"}.
                  </p>
                )}

                {submitError && (
                  <div
                    className="alert alert-error"
                    style={{ marginTop: 14 }}
                  >
                    {submitError}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onImport}
                    disabled={submitting || validCount === 0}
                  >
                    {submitting ? (
                      <span className="spinner spinner-light" />
                    ) : (
                      <>
                        Save {validCount} stop
                        {validCount === 1 ? "" : "s"} as the route
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={reset}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
