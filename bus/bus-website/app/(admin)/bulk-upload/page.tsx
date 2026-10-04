"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useColleges } from "../../../lib/college/CollegeContext";
import { usePermissions } from "../../../lib/auth/permissions";
import { collegeBusesApi } from "../../../lib/api/collegeBuses";
import { collegeDriversApi } from "../../../lib/api/collegeDrivers";
import { collegeStudentsApi } from "../../../lib/api/collegeStudents";
import {
  SHEET_LABELS,
  SHEET_MODULE,
  SHEET_ORDER,
  buildTemplate,
  columnLabel,
  readWorkbook,
  toBuses,
  toDriverAssignments,
  toDrivers,
  toStudentAssignments,
  toStudents,
  type ParsedRow,
  type ParsedSheet,
  type SheetKind,
} from "../../../lib/bulk/workbook";
import { IconDownload, IconUpload } from "../../../components/icons";

/**
 * One spreadsheet, the whole college.
 *
 * Setting a college up means buses, then drivers, then students, then who
 * drives what and who rides where — four uploads on four pages, in an order
 * that is not obvious. This page takes one workbook with a sheet per kind and
 * sends each sheet to the endpoint its own page already uses, in the order the
 * data depends on. Those pages stay: they are the right thing for adding a
 * handful of people later.
 */

/**
 * Rows per request. Every bulk endpoint refuses more than 500 at once, and a
 * college with two thousand students would hit that on its first upload.
 */
const BATCH = 400;

type ParsedRowList = ParsedRow[];

type SheetOutcome = {
  kind: SheetKind;
  created: number;
  failed: { row: number; what: string; error: string }[];
  skipped?: string;
};

export default function BulkUploadPage() {
  const { selected } = useColleges();
  const perms = usePermissions();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState<SheetKind | null>(null);
  const [outcomes, setOutcomes] = useState<SheetOutcome[] | null>(null);

  function reset() {
    setFileName("");
    setSheets(null);
    setParseError(null);
    setOutcomes(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File) {
    setParseError(null);
    setOutcomes(null);
    setFileName(file.name);
    try {
      const found = readWorkbook(await file.arrayBuffer());
      if (found.length === 0) {
        setSheets(null);
        setParseError(
          "No sheets we recognise. Name them Buses, Drivers, Students, " +
            "Driver assignments and Student assignments — or start from the template."
        );
        return;
      }
      setSheets(found);
    } catch {
      setSheets(null);
      setParseError(
        "This file could not be read. Please upload an Excel (.xlsx, .xls) or CSV file."
      );
    }
  }

  function downloadTemplate() {
    XLSX.writeFile(buildTemplate(), "busszo-setup-template.xlsx");
  }

  function allowed(kind: SheetKind): boolean {
    const { module, action } = SHEET_MODULE[kind];
    return perms.can(module, action);
  }

  /**
   * Send one sheet in batches and gather the results.
   *
   * Failed rows come back numbered within their own batch, so they are mapped
   * back to the row number in the spreadsheet — which is the only number the
   * person looking at the error can act on.
   */
  async function runBatched<Payload, Row extends { row: number; error: string }>(
    rows: ParsedRowList,
    toPayload: (rows: ParsedRowList) => Payload[],
    send: (payload: Payload[]) => Promise<{ done: number; failed: Row[] }>,
    describe: (failed: Row) => string
  ): Promise<{ created: number; failed: SheetOutcome["failed"] }> {
    let created = 0;
    const failed: SheetOutcome["failed"] = [];
    for (let start = 0; start < rows.length; start += BATCH) {
      const slice = rows.slice(start, start + BATCH);
      const res = await send(toPayload(slice));
      created += res.done;
      for (const f of res.failed) {
        const source = slice[f.row - 1];
        failed.push({
          row: source?.rowNumber ?? 0,
          what: describe(f),
          error: f.error,
        });
      }
    }
    return { created, failed };
  }

  async function importAll() {
    if (!selected || !sheets) return;
    setParseError(null);
    const results: SheetOutcome[] = [];

    // Order matters: a driver cannot be put on a bus that does not exist yet,
    // and a student cannot be given a seat before either of them is there.
    for (const kind of SHEET_ORDER) {
      const sheet = sheets.find((s) => s.kind === kind);
      if (!sheet) continue;
      if (!allowed(kind)) {
        results.push({
          kind,
          created: 0,
          failed: [],
          skipped: "Your role does not allow this",
        });
        continue;
      }
      const rows = sheet.rows.filter((r) => r.error === null);
      if (rows.length === 0) {
        results.push({ kind, created: 0, failed: [], skipped: "Nothing to import" });
        continue;
      }

      setImporting(kind);
      try {
        const outcome =
          kind === "buses"
            ? await runBatched(
                rows,
                toBuses,
                async (payload) => {
                  const res = await collegeBusesApi.bulkCreate(selected._id, payload);
                  return { done: res.created.length, failed: res.failed };
                },
                (f) => f.busNumber ?? ""
              )
            : kind === "drivers"
            ? await runBatched(
                rows,
                toDrivers,
                async (payload) => {
                  const res = await collegeDriversApi.bulkCreate(selected._id, payload);
                  return { done: res.created.length, failed: res.failed };
                },
                (f) => f.name ?? ""
              )
            : kind === "students"
            ? await runBatched(
                rows,
                toStudents,
                async (payload) => {
                  const res = await collegeStudentsApi.bulkCreate(selected._id, payload);
                  return { done: res.created.length, failed: res.failed };
                },
                (f) => f.name ?? f.rollNumber ?? ""
              )
            : kind === "driverAssignments"
            ? await runBatched(
                rows,
                toDriverAssignments,
                async (payload) => {
                  const res = await collegeBusesApi.bulkAssignDrivers(selected._id, payload);
                  return { done: res.applied.length, failed: res.failed };
                },
                (f) => f.busNumber ?? ""
              )
            : await runBatched(
                rows,
                toStudentAssignments,
                async (payload) => {
                  const res = await collegeStudentsApi.bulkAssignBus(selected._id, payload);
                  return { done: res.applied.length, failed: res.failed };
                },
                (f) => f.student ?? ""
              );
        results.push({ kind, created: outcome.created, failed: outcome.failed });
      } catch (e) {
        // One sheet failing outright should not throw away what already went
        // in, so record it and carry on with the next.
        results.push({
          kind,
          created: 0,
          failed: [{ row: 0, what: "", error: (e as Error).message }],
        });
      }
    }

    setImporting(null);
    setOutcomes(results);
  }

  if (!selected) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="muted" style={{ margin: 0 }}>
          Pick a college first — the upload goes into whichever one is selected.
        </p>
      </div>
    );
  }

  const readyCount =
    sheets?.reduce((n, s) => n + s.rows.filter((r) => r.error === null).length, 0) ?? 0;
  const problemCount =
    sheets?.reduce((n, s) => n + s.rows.filter((r) => r.error !== null).length, 0) ?? 0;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Upload everything</h1>
          <p className="page-subtitle">
            Set {selected.name} up from one spreadsheet — buses, drivers,
            students, and who drives or rides which bus. Each kind goes on its
            own sheet, and they are imported in that order.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-quiet" onClick={downloadTemplate}>
            <IconDownload size={14} /> Download template
          </button>
        </div>
      </div>

      {parseError && (
        <div className="alert alert-error" style={{ maxWidth: 820 }}>
          {parseError}
        </div>
      )}

      {outcomes ? (
        <div className="card" style={{ maxWidth: 820 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>
            Import finished
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.kind} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 0", fontWeight: 600 }}>
                    {SHEET_LABELS[o.kind]}
                  </td>
                  <td style={{ padding: "10px 0" }}>
                    {o.skipped ? (
                      <span className="muted small">{o.skipped}</span>
                    ) : (
                      <>
                        <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                          {o.created} added
                        </span>
                        {o.failed.length > 0 && (
                          <span style={{ color: "var(--danger, #c0392b)", marginLeft: 12 }}>
                            {o.failed.length} failed
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {outcomes.some((o) => o.failed.length > 0) && (
            <div style={{ marginTop: 20 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>
                Rows that did not go in
              </div>
              {outcomes
                .filter((o) => o.failed.length > 0)
                .map((o) => (
                  <div key={o.kind} style={{ marginBottom: 14 }}>
                    <div className="muted small" style={{ marginBottom: 6 }}>
                      {SHEET_LABELS[o.kind]}
                    </div>
                    <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                      {o.failed.slice(0, 20).map((f, i) => (
                        <li key={`${o.kind}-${i}`}>
                          {f.row > 0 ? `Row ${f.row}` : "Sheet"}
                          {f.what ? ` (${f.what})` : ""} — {f.error}
                        </li>
                      ))}
                      {o.failed.length > 20 && <li>…and {o.failed.length - 20} more</li>}
                    </ul>
                  </div>
                ))}
              <p className="muted small" style={{ marginTop: 10 }}>
                Fix those rows in the spreadsheet and upload it again — rows
                that already went in will be reported as duplicates rather than
                added twice.
              </p>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Upload another file
            </button>
          </div>
        </div>
      ) : sheets ? (
        <>
          <div className="card" style={{ maxWidth: 820 }}>
            <div className="card-titlerow" style={{ marginBottom: 14 }}>
              <div className="card-title">{fileName}</div>
              <button type="button" className="btn btn-quiet" onClick={reset}>
                Choose another file
              </button>
            </div>

            {SHEET_ORDER.map((kind) => {
              const sheet = sheets.find((s) => s.kind === kind);
              const can = allowed(kind);
              const ready = sheet?.rows.filter((r) => r.error === null).length ?? 0;
              const problems = sheet?.rows.filter((r) => r.error !== null) ?? [];
              return (
                <div
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "12px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{SHEET_LABELS[kind]}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {!sheet
                        ? "Not in this file — skipped"
                        : sheet.missingColumns.length > 0
                        ? `Missing column${sheet.missingColumns.length > 1 ? "s" : ""}: ${sheet.missingColumns
                            .map(columnLabel)
                            .join(", ")}`
                        : !can
                        ? "Your role does not allow this — skipped"
                        : `${ready} ready${problems.length ? `, ${problems.length} with problems` : ""}`}
                    </div>
                    {problems.length > 0 && (
                      <ul
                        className="muted small"
                        style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6 }}
                      >
                        {problems.slice(0, 5).map((p) => (
                          <li key={p.rowNumber}>
                            Row {p.rowNumber} — {p.error}
                          </li>
                        ))}
                        {problems.length > 5 && <li>…and {problems.length - 5} more</li>}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="card"
            style={{ maxWidth: 820, marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {readyCount} row{readyCount === 1 ? "" : "s"} ready to import
              </div>
              {problemCount > 0 && (
                <div className="muted small" style={{ marginTop: 2 }}>
                  {problemCount} row{problemCount === 1 ? "" : "s"} with problems will be left out.
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={readyCount === 0 || importing !== null}
              onClick={importAll}
            >
              {importing
                ? `Importing ${SHEET_LABELS[importing].toLowerCase()}…`
                : "Import everything"}
            </button>
          </div>
        </>
      ) : (
        <>
          <label
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
            style={{ maxWidth: 820 }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onFile(file);
            }}
          >
            <IconUpload size={22} />
            <div style={{ fontWeight: 600, marginTop: 10 }}>
              Drop your spreadsheet here, or click to choose
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Excel (.xlsx, .xls) with a sheet for each kind
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </label>

          <div className="card" style={{ maxWidth: 820, marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              What goes in the file
            </div>
            <ul
              className="muted small"
              style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.55 }}
            >
              <li>
                <strong>Buses</strong> — bus number, plate number, capacity.
              </li>
              <li>
                <strong>Drivers</strong> — name, date of birth, gender, licence
                number, Aadhaar number, mobile, address.
              </li>
              <li>
                <strong>Students</strong> — name, roll number, gender, date of
                birth, mobile, address.
              </li>
              <li>
                <strong>Driver assignments</strong> — bus number, and the
                driver&rsquo;s licence number or mobile.
              </li>
              <li>
                <strong>Student assignments</strong> — the student&rsquo;s roll
                number or mobile, bus number, and the stop.
              </li>
              <li>
                Leave out any sheet you do not need. Column names are matched
                loosely, so &ldquo;Bus No&rdquo; and &ldquo;bus number&rdquo; both work, and
                dates may be written as 14/06/1985 or 1985-06-14.
              </li>
            </ul>
            <div style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>
                <IconDownload size={14} /> Download template
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
