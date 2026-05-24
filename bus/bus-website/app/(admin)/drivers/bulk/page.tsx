"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useColleges } from "../../../../lib/college/CollegeContext";
import {
  collegeDriversApi,
  type BulkDriverResult,
  type DriverInput,
  type Gender,
} from "../../../../lib/api/collegeDrivers";
import { NoCollege } from "../../../../components/NoCollege";
import {
  IconUpload,
  IconDownload,
  IconFileSpreadsheet,
  IconArrowLeft,
  IconCheck,
  IconX,
} from "../../../../components/icons";

type DriverField =
  | "name"
  | "dob"
  | "gender"
  | "licenceNumber"
  | "aadharNumber"
  | "mobile"
  | "address";

type ParsedRow = {
  rowNumber: number;
  name: string;
  dob: string;
  gender: string;
  licenceNumber: string;
  aadharNumber: string;
  mobile: string;
  address: string;
  error: string | null;
};

const HEADER_ALIASES: Record<string, DriverField> = {
  name: "name",
  "full name": "name",
  "driver name": "name",
  dob: "dob",
  "date of birth": "dob",
  birthdate: "dob",
  birthday: "dob",
  gender: "gender",
  sex: "gender",
  licence: "licenceNumber",
  license: "licenceNumber",
  licencenumber: "licenceNumber",
  licensenumber: "licenceNumber",
  "licence number": "licenceNumber",
  "license number": "licenceNumber",
  "licence no": "licenceNumber",
  "license no": "licenceNumber",
  "dl number": "licenceNumber",
  "dl no": "licenceNumber",
  dl: "licenceNumber",
  aadhar: "aadharNumber",
  aadhaar: "aadharNumber",
  aadharnumber: "aadharNumber",
  aadhaarnumber: "aadharNumber",
  "aadhar number": "aadharNumber",
  "aadhaar number": "aadharNumber",
  "aadhar no": "aadharNumber",
  "aadhaar no": "aadharNumber",
  uid: "aadharNumber",
  mobile: "mobile",
  phone: "mobile",
  "mobile number": "mobile",
  "phone number": "mobile",
  "mobile no": "mobile",
  "phone no": "mobile",
  contact: "mobile",
  address: "address",
  "home address": "address",
  location: "address",
};

const REQUIRED_FIELDS: DriverField[] = [
  "name",
  "dob",
  "gender",
  "licenceNumber",
  "aadharNumber",
  "mobile",
  "address",
];

const GENDERS: Gender[] = ["male", "female", "other"];

function normaliseHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase();
}

function cellToDobString(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Excel serial date — let SheetJS convert.
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return "";
    const yyyy = String(parsed.y).padStart(4, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  if (!s) return "";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function validateRow(r: ParsedRow): string | null {
  if (!r.name.trim()) return "name is required";
  if (!r.dob.trim()) return "dob is required";
  if (Number.isNaN(new Date(r.dob).getTime())) return "dob must be a valid date";
  if (!GENDERS.includes(r.gender as Gender))
    return "gender must be male, female or other";
  if (!r.licenceNumber.trim()) return "licenceNumber is required";
  if (!/^\d{12}$/.test(r.aadharNumber)) return "aadhar must be 12 digits";
  if (!r.mobile.trim()) return "mobile is required";
  if (!r.address.trim()) return "address is required";
  return null;
}

export default function BulkDriverUploadPage() {
  const router = useRouter();
  const { selected } = useColleges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkDriverResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setResult(null);
    setRows([]);
    setFileName(file.name);

    let workbook: XLSX.WorkBook;
    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: "array", cellDates: true });
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
    const columnMap: Partial<Record<DriverField, string>> = {};
    for (const key of Object.keys(firstRow)) {
      const norm = normaliseHeader(key);
      const target = HEADER_ALIASES[norm];
      if (target && !columnMap[target]) columnMap[target] = key;
    }

    const missing = REQUIRED_FIELDS.filter((f) => !columnMap[f]);
    if (missing.length > 0) {
      setParseError(
        `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(
          ", "
        )}. Found columns: ${Object.keys(firstRow).join(", ")}`
      );
      return;
    }

    const parsed: ParsedRow[] = json.map((entry, idx) => {
      const name = String(entry[columnMap.name!] ?? "").trim();
      const dob = cellToDobString(entry[columnMap.dob!]);
      const gender = String(entry[columnMap.gender!] ?? "")
        .trim()
        .toLowerCase();
      const licenceNumber = String(entry[columnMap.licenceNumber!] ?? "")
        .trim()
        .toUpperCase();
      const aadharNumber = String(entry[columnMap.aadharNumber!] ?? "")
        .trim()
        .replace(/\s+/g, "");
      const mobile = String(entry[columnMap.mobile!] ?? "")
        .trim()
        .replace(/\s+/g, "");
      const address = String(entry[columnMap.address!] ?? "").trim();
      const draft: ParsedRow = {
        rowNumber: idx + 2,
        name,
        dob,
        gender,
        licenceNumber,
        aadharNumber,
        mobile,
        address,
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
      {
        name: "Ravi Kumar",
        dob: "1985-04-12",
        gender: "male",
        licenceNumber: "KA0120230001234",
        aadharNumber: "123456789012",
        mobile: "9876543210",
        address: "12, MG Road, Bengaluru",
      },
      {
        name: "Sita Devi",
        dob: "1990-09-23",
        gender: "female",
        licenceNumber: "KA0120230005678",
        aadharNumber: "234567890123",
        mobile: "9988776655",
        address: "45, Brigade Road, Bengaluru",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Drivers");
    XLSX.writeFile(wb, "drivers-template.xlsx");
  }

  async function onImport() {
    if (!selected) return;
    const valid = rows.filter((r) => r.error === null);
    if (valid.length === 0) return;

    setSubmitting(true);
    setResult(null);
    try {
      const payload: DriverInput[] = valid.map((r) => ({
        name: r.name,
        dob: r.dob,
        gender: r.gender as Gender,
        licenceNumber: r.licenceNumber,
        aadharNumber: r.aadharNumber,
        mobile: r.mobile,
        address: r.address,
      }));
      const res = await collegeDriversApi.bulkCreate(selected._id, payload);
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
          <h1 className="page-title">Bulk upload drivers</h1>
          <p className="page-subtitle">
            Import multiple drivers into {selected.name} from a spreadsheet.
          </p>
        </div>
        <div className="page-actions">
          <Link href="/drivers" className="btn btn-secondary">
            <IconArrowLeft size={14} /> Back to drivers
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
        <ResultPanel
          result={result}
          onReset={reset}
          onDone={() => router.push("/drivers")}
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
              Your spreadsheet&rsquo;s first row should contain these column
              headers (case-insensitive). Aliases like &ldquo;Date of Birth&rdquo;,
              &ldquo;DL Number&rdquo;, &ldquo;Phone&rdquo; are accepted.
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
                    <strong>name</strong>
                  </td>
                  <td>Ravi Kumar</td>
                  <td className="muted">Driver&rsquo;s full name.</td>
                </tr>
                <tr>
                  <td>
                    <strong>dob</strong>
                  </td>
                  <td>1985-04-12</td>
                  <td className="muted">
                    YYYY-MM-DD or an Excel date cell.
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>gender</strong>
                  </td>
                  <td>male</td>
                  <td className="muted">male / female / other.</td>
                </tr>
                <tr>
                  <td>
                    <strong>licenceNumber</strong>
                  </td>
                  <td>KA0120230001234</td>
                  <td className="muted">Globally unique. Will be uppercased.</td>
                </tr>
                <tr>
                  <td>
                    <strong>aadharNumber</strong>
                  </td>
                  <td>123456789012</td>
                  <td className="muted">Exactly 12 digits. Globally unique.</td>
                </tr>
                <tr>
                  <td>
                    <strong>mobile</strong>
                  </td>
                  <td>9876543210</td>
                  <td className="muted">Globally unique.</td>
                </tr>
                <tr>
                  <td>
                    <strong>address</strong>
                  </td>
                  <td>12, MG Road, Bengaluru</td>
                  <td className="muted">Free text.</td>
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
                  <th>Name</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Licence</th>
                  <th>Aadhar</th>
                  <th>Mobile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={r.error ? "row-error" : ""}>
                    <td className="muted">{r.rowNumber}</td>
                    <td>
                      <strong>
                        {r.name || <em className="muted">missing</em>}
                      </strong>
                    </td>
                    <td>{r.dob || <em className="muted">missing</em>}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {r.gender || <em className="muted">missing</em>}
                    </td>
                    <td>{r.licenceNumber || <em className="muted">missing</em>}</td>
                    <td>{r.aadharNumber || <em className="muted">missing</em>}</td>
                    <td>{r.mobile || <em className="muted">missing</em>}</td>
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
                  <IconUpload size={14} /> Import {validCount} driver
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
  result: BulkDriverResult;
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
            : `${createdCount} driver${createdCount === 1 ? "" : "s"} imported`}
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
            Go to drivers
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
                <th>Name</th>
                <th>Mobile</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.failed.map((f, idx) => (
                <tr
                  key={`${f.row}-${f.mobile ?? ""}-${idx}`}
                  className="row-error"
                >
                  <td className="muted">{f.row}</td>
                  <td>
                    <strong>{f.name || "—"}</strong>
                  </td>
                  <td>{f.mobile || "—"}</td>
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
