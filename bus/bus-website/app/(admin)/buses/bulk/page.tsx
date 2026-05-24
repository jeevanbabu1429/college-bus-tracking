"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useColleges } from "../../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type BulkResult,
  type BusInput,
} from "../../../../lib/api/collegeBuses";
import { NoCollege } from "../../../../components/NoCollege";
import {
  IconUpload,
  IconDownload,
  IconFileSpreadsheet,
  IconArrowLeft,
  IconCheck,
  IconX,
} from "../../../../components/icons";

type ParsedRow = {
  rowNumber: number;
  busNumber: string;
  plateNumber: string;
  capacity: string;
  error: string | null;
};

const HEADER_ALIASES: Record<string, "busNumber" | "plateNumber" | "capacity"> = {
  busnumber: "busNumber",
  "bus number": "busNumber",
  "bus no": "busNumber",
  "bus no.": "busNumber",
  "bus #": "busNumber",
  bus: "busNumber",
  platenumber: "plateNumber",
  "plate number": "plateNumber",
  "plate no": "plateNumber",
  "plate no.": "plateNumber",
  "number plate": "plateNumber",
  plate: "plateNumber",
  registration: "plateNumber",
  capacity: "capacity",
  seats: "capacity",
  "seat count": "capacity",
};

function normaliseHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function validateRow(r: ParsedRow): string | null {
  if (!r.busNumber.trim()) return "busNumber is required";
  if (!r.plateNumber.trim()) return "plateNumber is required";
  const cap = Number(r.capacity);
  if (!Number.isFinite(cap) || cap < 1) return "capacity must be ≥ 1";
  return null;
}

export default function BulkBusUploadPage() {
  const router = useRouter();
  const { selected } = useColleges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setResult(null);
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

    const missing: string[] = [];
    if (!columnMap.busNumber) missing.push("busNumber");
    if (!columnMap.plateNumber) missing.push("plateNumber");
    if (!columnMap.capacity) missing.push("capacity");
    if (missing.length > 0) {
      setParseError(
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(
          ", "
        )}. Found columns: ${Object.keys(firstRow).join(", ")}`
      );
      return;
    }

    const parsed: ParsedRow[] = json.map((entry, idx) => {
      const busNumber = String(entry[columnMap.busNumber] ?? "").trim();
      const plateNumber = String(entry[columnMap.plateNumber] ?? "")
        .trim()
        .toUpperCase();
      const capacity = String(entry[columnMap.capacity] ?? "").trim();
      const draft: ParsedRow = {
        rowNumber: idx + 2,
        busNumber,
        plateNumber,
        capacity,
        error: null,
      };
      draft.error = validateRow(draft);
      return draft;
    });

    setRows(parsed);
  }, []);

  function reset() {
    setRows([]);
    setFileName(null);
    setParseError(null);
    setResult(null);
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
      { busNumber: "B1", plateNumber: "KA01AB1234", capacity: 40 },
      { busNumber: "B2", plateNumber: "KA01AB5678", capacity: 36 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buses");
    XLSX.writeFile(wb, "buses-template.xlsx");
  }

  async function onImport() {
    if (!selected) return;
    const valid = rows.filter((r) => r.error === null);
    if (valid.length === 0) return;

    setSubmitting(true);
    setResult(null);
    try {
      const payload: BusInput[] = valid.map((r) => ({
        busNumber: r.busNumber.trim(),
        plateNumber: r.plateNumber.trim(),
        capacity: Number(r.capacity),
      }));
      const res = await collegeBusesApi.bulkCreate(selected._id, payload);
      setResult(res);
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!selected) return <NoCollege />;

  const validCount = rows.filter((r) => r.error === null).length;
  const invalidCount = rows.length - validCount;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Bulk upload buses</h1>
          <p className="page-subtitle">
            Import multiple buses into {selected.name} from a spreadsheet.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/buses" className="btn btn-secondary">
            <IconArrowLeft size={14} /> Back to buses
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

      {result ? (
        <ResultPanel result={result} onReset={reset} onDone={() => router.push("/buses")} />
      ) : rows.length === 0 ? (
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

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>
              File format
            </div>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Your spreadsheet&rsquo;s first row should contain these column
              headers (case-insensitive). Header aliases like &ldquo;Bus
              Number&rdquo;, &ldquo;Plate No&rdquo;, &ldquo;Seats&rdquo; are also accepted.
            </p>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Example</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>busNumber</strong>
                  </td>
                  <td>B1</td>
                  <td className="muted">
                    Unique within this college.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>plateNumber</strong>
                  </td>
                  <td>KA01AB1234</td>
                  <td className="muted">
                    Globally unique. Will be uppercased.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>capacity</strong>
                  </td>
                  <td>40</td>
                  <td className="muted">Number ≥ 1.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {parseError && <div className="alert alert-error">{parseError}</div>}
        </>
      ) : (
        <>
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--accent-soft)",
                  color: "var(--accent-hover)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconFileSpreadsheet size={20} />
              </span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text)" }}>
                  {fileName}
                </div>
                <div className="muted small">
                  {rows.length} row{rows.length === 1 ? "" : "s"} ·{" "}
                  <span style={{ color: "var(--success)", fontWeight: 600 }}>
                    {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <>
                      {" "}·{" "}
                      <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                        {invalidCount} invalid
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button type="button" className="btn btn-quiet" onClick={reset}>
              <IconX size={14} /> Replace file
            </button>
          </div>

          {parseError && <div className="alert alert-error">{parseError}</div>}

          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Row</th>
                  <th>Bus number</th>
                  <th>Plate number</th>
                  <th style={{ textAlign: "right" }}>Capacity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={r.error ? "row-error" : ""}>
                    <td className="muted">{r.rowNumber}</td>
                    <td>
                      <strong>{r.busNumber || <em className="muted">missing</em>}</strong>
                    </td>
                    <td>{r.plateNumber || <em className="muted">missing</em>}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.capacity || <em className="muted">missing</em>}
                    </td>
                    <td>
                      {r.error ? (
                        <span className="pill pill-danger">{r.error}</span>
                      ) : (
                        <span className="pill pill-success">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn btn-primary"
              onClick={onImport}
              disabled={submitting || validCount === 0}
            >
              {submitting ? (
                <span className="spinner spinner-light" />
              ) : (
                <>
                  <IconUpload size={14} /> Import {validCount} bus
                  {validCount === 1 ? "" : "es"}
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={reset}
              disabled={submitting}
            >
              Cancel
            </button>
            {invalidCount > 0 && (
              <span className="small muted" style={{ marginLeft: 4 }}>
                {invalidCount} row{invalidCount === 1 ? "" : "s"} will be
                skipped.
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

function ResultPanel({
  result,
  onReset,
  onDone,
}: {
  result: BulkResult;
  onReset: () => void;
  onDone: () => void;
}) {
  const createdCount = result.created.length;
  const failedCount = result.failed.length;

  return (
    <>
      <div className="card text-center" style={{ padding: 36 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background:
              createdCount > 0 ? "var(--success-soft)" : "var(--warning-soft)",
            color: createdCount > 0 ? "var(--success)" : "var(--warning)",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCheck size={26} />
        </div>
        <h2 className="page-title" style={{ marginBottom: 6 }}>
          {createdCount === 0
            ? "Nothing imported"
            : `${createdCount} bus${createdCount === 1 ? "" : "es"} imported`}
        </h2>
        <p className="muted">
          {failedCount === 0
            ? "All rows succeeded."
            : `${failedCount} row${failedCount === 1 ? "" : "s"} were skipped — see below.`}
        </p>
        <div
          style={{
            marginTop: 22,
            display: "flex",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <button className="btn btn-primary" onClick={onDone}>
            Go to buses
          </button>
          <button className="btn btn-quiet" onClick={onReset}>
            Upload another file
          </button>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="table-card">
          <div className="card-header">
            <div className="card-title">Skipped rows</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Row</th>
                <th>Bus number</th>
                <th>Plate number</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.failed.map((f) => (
                <tr key={`${f.row}-${f.plateNumber ?? ""}`} className="row-error">
                  <td className="muted">{f.row}</td>
                  <td>
                    <strong>{f.busNumber || "—"}</strong>
                  </td>
                  <td>{f.plateNumber || "—"}</td>
                  <td>
                    <span className="pill pill-danger">{f.error}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
