"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useColleges } from "../../../../lib/college/CollegeContext";
import {
  collegeBusesApi,
  type Bus,
} from "../../../../lib/api/collegeBuses";
import {
  collegeStudentsApi,
  type Student,
  type BulkBusAssignmentResult,
  type BusAssignmentInput,
} from "../../../../lib/api/collegeStudents";
import { NoCollege } from "../../../../components/NoCollege";
import {
  IconUpload,
  IconDownload,
  IconFileSpreadsheet,
  IconArrowLeft,
  IconCheck,
  IconX,
} from "../../../../components/icons";

type Field = "rollNumber" | "mobile" | "busNumber" | "stop";

type ParsedRow = {
  rowNumber: number;
  rollNumber: string;
  mobile: string;
  busNumber: string;
  stop: string;
  error: string | null;
};

const HEADER_ALIASES: Record<string, Field> = {
  rollnumber: "rollNumber",
  "roll number": "rollNumber",
  "roll no": "rollNumber",
  "roll no.": "rollNumber",
  roll: "rollNumber",
  "register number": "rollNumber",
  "registration number": "rollNumber",
  reg: "rollNumber",
  "reg no": "rollNumber",
  mobile: "mobile",
  phone: "mobile",
  "mobile number": "mobile",
  "phone number": "mobile",
  "mobile no": "mobile",
  contact: "mobile",
  busnumber: "busNumber",
  "bus number": "busNumber",
  "bus no": "busNumber",
  "bus no.": "busNumber",
  bus: "busNumber",
  stop: "stop",
  "stop name": "stop",
  drop: "stop",
  "drop point": "stop",
  "drop off": "stop",
};

function normaliseHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function validateRow(r: ParsedRow): string | null {
  if (!r.rollNumber.trim() && !r.mobile.trim())
    return "rollNumber or mobile is required";
  if (!r.busNumber.trim() && r.stop.trim())
    return "cannot set a stop without a bus";
  return null;
}

export default function BulkAssignStudentsPage() {
  const router = useRouter();
  const { selected } = useColleges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkBusAssignmentResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        const [bs, ss] = await Promise.all([
          collegeBusesApi.list(selected._id),
          collegeStudentsApi.list(selected._id),
        ]);
        if (cancelled) return;
        setBuses(bs);
        setStudents(ss);
      } catch {
        /* helper data only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
    const columnMap: Partial<Record<Field, string>> = {};
    for (const key of Object.keys(firstRow)) {
      const norm = normaliseHeader(key);
      const target = HEADER_ALIASES[norm];
      if (target && !columnMap[target]) columnMap[target] = key;
    }

    if (!columnMap.rollNumber && !columnMap.mobile) {
      setParseError(
        `Need either a rollNumber or mobile column to identify students. Found columns: ${Object.keys(
          firstRow
        ).join(", ")}`
      );
      return;
    }
    if (!columnMap.busNumber) {
      setParseError(
        `Missing required column: busNumber. Leave it blank in a row to unassign that student. Found columns: ${Object.keys(
          firstRow
        ).join(", ")}`
      );
      return;
    }

    const parsed: ParsedRow[] = json.map((entry, idx) => {
      const rollNumber = columnMap.rollNumber
        ? String(entry[columnMap.rollNumber] ?? "").trim()
        : "";
      const mobile = columnMap.mobile
        ? String(entry[columnMap.mobile] ?? "")
            .trim()
            .replace(/\s+/g, "")
        : "";
      const busNumber = String(entry[columnMap.busNumber!] ?? "").trim();
      const stop = columnMap.stop
        ? String(entry[columnMap.stop] ?? "").trim()
        : "";
      const draft: ParsedRow = {
        rowNumber: idx + 2,
        rollNumber,
        mobile,
        busNumber,
        stop,
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
    const sample =
      students.length > 0
        ? students.map((s) => ({
            rollNumber: s.rollNumber,
            name: s.name,
            busNumber: s.bus?.busNumber ?? "",
            stop: s.stop ?? "",
          }))
        : [
            {
              rollNumber: "CS2023001",
              name: "Aarav Sharma",
              busNumber: "B1",
              stop: "MG Road",
            },
            {
              rollNumber: "CS2023002",
              name: "Priya Nair",
              busNumber: "",
              stop: "",
            },
          ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assignments");
    XLSX.writeFile(wb, "student-assignments-template.xlsx");
  }

  async function onImport() {
    if (!selected) return;
    const valid = rows.filter((r) => r.error === null);
    if (valid.length === 0) return;

    setSubmitting(true);
    setResult(null);
    try {
      const payload: BusAssignmentInput[] = valid.map((r) => ({
        ...(r.rollNumber ? { rollNumber: r.rollNumber } : {}),
        ...(r.mobile ? { mobile: r.mobile } : {}),
        busNumber: r.busNumber,
        ...(r.stop ? { stop: r.stop } : {}),
      }));
      const res = await collegeStudentsApi.bulkAssignBus(selected._id, payload);
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
          <h1 className="page-title">Bulk assign students</h1>
          <p className="page-subtitle">
            Upload a spreadsheet to set each student&rsquo;s bus and stop for{" "}
            {selected.name}.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/assign-students" className="btn btn-secondary">
            <IconArrowLeft size={14} /> Back
          </Link>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={downloadTemplate}
          >
            <IconDownload size={14} />{" "}
            {students.length > 0
              ? "Download current sheet"
              : "Download template"}
          </button>
        </div>
      </div>

      {result ? (
        <ResultPanel
          result={result}
          onReset={reset}
          onDone={() => router.push("/assign-students")}
        />
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
              Tip: click <strong>Download current sheet</strong> to grab a
              spreadsheet pre-filled with every student and their existing bus +
              stop. Edit and re-upload.
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
                    <strong>rollNumber</strong>
                  </td>
                  <td>CS2023001</td>
                  <td className="muted">
                    Required (or use <strong>mobile</strong>).
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>mobile</strong>
                  </td>
                  <td>9876501234</td>
                  <td className="muted">
                    Alternative student identifier.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>busNumber</strong>
                  </td>
                  <td>B1</td>
                  <td className="muted">
                    Required column. Leave blank to <em>unassign</em> that
                    student.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>stop</strong>
                  </td>
                  <td>MG Road</td>
                  <td className="muted">
                    Must exactly match a stop on the bus&rsquo;s route. Leave
                    blank to clear the stop.
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted small" style={{ marginTop: 12 }}>
              Bus capacity is checked per row. If a row would overfill a bus
              it&rsquo;ll be skipped — process clears before swaps if you&rsquo;re
              reshuffling.
            </p>
          </div>

          {buses.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>
                Bus &amp; route reference
              </div>
              <p className="muted small" style={{ marginBottom: 12 }}>
                Stops are case-sensitive. Copy them exactly when filling the
                sheet.
              </p>
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Capacity</th>
                    <th>Route &amp; stops</th>
                  </tr>
                </thead>
                <tbody>
                  {buses.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <strong>{b.busNumber}</strong>{" "}
                        <span className="muted small">· {b.plateNumber}</span>
                      </td>
                      <td>{b.capacity}</td>
                      <td>
                        {b.route ? (
                          <div style={{ marginBottom: 4 }}>{b.route}</div>
                        ) : (
                          <span className="muted small">No route set</span>
                        )}
                        {b.stops.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {b.stops.map((st) => (
                              <span
                                key={st.name}
                                className="pill"
                                style={{ fontSize: 11 }}
                              >
                                {st.name}
                                {st.suspended ? " (suspended)" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted small">No stops</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
                  <th>Student</th>
                  <th>Bus</th>
                  <th>Stop</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={r.error ? "row-error" : ""}>
                    <td className="muted">{r.rowNumber}</td>
                    <td>
                      <strong>
                        {r.rollNumber ||
                          r.mobile || <em className="muted">missing</em>}
                      </strong>
                    </td>
                    <td>
                      {r.busNumber || (
                        <span className="muted small">unassign</span>
                      )}
                    </td>
                    <td>{r.stop || <span className="muted">—</span>}</td>
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
                  <IconUpload size={14} /> Apply {validCount} assignment
                  {validCount === 1 ? "" : "s"}
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
                {invalidCount} row{invalidCount === 1 ? "" : "s"} will be skipped.
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
  result: BulkBusAssignmentResult;
  onReset: () => void;
  onDone: () => void;
}) {
  const appliedCount = result.applied.length;
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
              appliedCount > 0 ? "var(--success-soft)" : "var(--warning-soft)",
            color: appliedCount > 0 ? "var(--success)" : "var(--warning)",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCheck size={26} />
        </div>
        <h2 className="page-title" style={{ marginBottom: 6 }}>
          {appliedCount === 0
            ? "Nothing applied"
            : `${appliedCount} assignment${appliedCount === 1 ? "" : "s"} applied`}
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
            Back to assignments
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
                <th>Student</th>
                <th>Bus</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.failed.map((f, idx) => (
                <tr
                  key={`${f.row}-${f.student ?? ""}-${idx}`}
                  className="row-error"
                >
                  <td className="muted">{f.row}</td>
                  <td>
                    <strong>{f.student || "—"}</strong>
                  </td>
                  <td>{f.busNumber || "—"}</td>
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
