import * as XLSX from "xlsx";
import type { BusInput, DriverAssignmentInput } from "../api/collegeBuses";
import type { DriverInput } from "../api/collegeDrivers";
import type { BusAssignmentInput, StudentBulkInput } from "../api/collegeStudents";

/**
 * One workbook, the whole college.
 *
 * The four single-purpose bulk pages each read one sheet with their own header
 * aliases. Setting a college up means doing all of them in order, which is four
 * uploads and four chances to do them in the wrong one — buses have to exist
 * before a driver can be put on one. This reads a single file with a sheet per
 * kind and hands the rows to the same endpoints those pages already use.
 *
 * Sheets are matched by name, columns by header, and both are forgiving: the
 * file usually comes from a college office, not from us.
 */

export type SheetKind =
  | "buses"
  | "drivers"
  | "students"
  | "driverAssignments"
  | "studentAssignments";

export const SHEET_ORDER: SheetKind[] = [
  "buses",
  "drivers",
  "students",
  "driverAssignments",
  "studentAssignments",
];

export const SHEET_LABELS: Record<SheetKind, string> = {
  buses: "Buses",
  drivers: "Drivers",
  students: "Students",
  driverAssignments: "Driver assignments",
  studentAssignments: "Student assignments",
};

/** What each sheet needs, and which console module governs it. */
export const SHEET_MODULE: Record<SheetKind, { module: string; action: string }> = {
  buses: { module: "buses", action: "create" },
  drivers: { module: "drivers", action: "create" },
  students: { module: "students", action: "create" },
  driverAssignments: { module: "assignments", action: "update" },
  studentAssignments: { module: "assignments", action: "update" },
};

// Sheet names people actually type. Matched after lowercasing and squashing
// spaces, so "Bus Details" and "bus details" are the same thing.
const SHEET_ALIASES: Record<string, SheetKind> = {
  buses: "buses",
  bus: "buses",
  "bus list": "buses",
  "bus details": "buses",
  vehicles: "buses",
  drivers: "drivers",
  driver: "drivers",
  "driver list": "drivers",
  "driver details": "drivers",
  students: "students",
  student: "students",
  "student list": "students",
  "student details": "students",
  "driver assignments": "driverAssignments",
  "driver assignment": "driverAssignments",
  "assign drivers": "driverAssignments",
  "bus drivers": "driverAssignments",
  "driver to bus": "driverAssignments",
  "student assignments": "studentAssignments",
  "student assignment": "studentAssignments",
  "assign students": "studentAssignments",
  "bus assignments": "studentAssignments",
  "student to bus": "studentAssignments",
};

type Field = string;

const HEADERS: Record<SheetKind, Record<string, Field>> = {
  buses: {
    busnumber: "busNumber",
    "bus number": "busNumber",
    "bus no": "busNumber",
    "bus no.": "busNumber",
    bus: "busNumber",
    platenumber: "plateNumber",
    "plate number": "plateNumber",
    "plate no": "plateNumber",
    "number plate": "plateNumber",
    plate: "plateNumber",
    registration: "plateNumber",
    capacity: "capacity",
    seats: "capacity",
    "seat count": "capacity",
  },
  drivers: {
    name: "name",
    "full name": "name",
    "driver name": "name",
    dob: "dob",
    "date of birth": "dob",
    birthdate: "dob",
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
    contact: "mobile",
    address: "address",
    "home address": "address",
  },
  students: {
    name: "name",
    "full name": "name",
    "student name": "name",
    rollnumber: "rollNumber",
    "roll number": "rollNumber",
    "roll no": "rollNumber",
    roll: "rollNumber",
    "register number": "rollNumber",
    "registration number": "rollNumber",
    "reg no": "rollNumber",
    gender: "gender",
    sex: "gender",
    dob: "dob",
    "date of birth": "dob",
    birthdate: "dob",
    mobile: "mobile",
    phone: "mobile",
    "mobile number": "mobile",
    "phone number": "mobile",
    "mobile no": "mobile",
    contact: "mobile",
    address: "address",
    "home address": "address",
  },
  driverAssignments: {
    busnumber: "busNumber",
    "bus number": "busNumber",
    "bus no": "busNumber",
    bus: "busNumber",
    licence: "licenceNumber",
    license: "licenceNumber",
    licencenumber: "licenceNumber",
    licensenumber: "licenceNumber",
    "licence number": "licenceNumber",
    "license number": "licenceNumber",
    "dl number": "licenceNumber",
    dl: "licenceNumber",
    mobile: "mobile",
    phone: "mobile",
    "mobile number": "mobile",
    "driver mobile": "mobile",
    contact: "mobile",
  },
  studentAssignments: {
    rollnumber: "rollNumber",
    "roll number": "rollNumber",
    "roll no": "rollNumber",
    roll: "rollNumber",
    "register number": "rollNumber",
    mobile: "mobile",
    phone: "mobile",
    "mobile number": "mobile",
    "student mobile": "mobile",
    contact: "mobile",
    busnumber: "busNumber",
    "bus number": "busNumber",
    "bus no": "busNumber",
    bus: "busNumber",
    stop: "stop",
    "stop name": "stop",
    "bus stop": "stop",
    "pickup point": "stop",
    "boarding point": "stop",
  },
};

/** A row the way it will be sent, plus what is wrong with it. */
export type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
  error: string | null;
};

export type ParsedSheet = {
  kind: SheetKind;
  sheetName: string;
  rows: ParsedRow[];
  /** Columns the sheet is missing altogether — nothing can be imported. */
  missingColumns: string[];
};

const GENDERS = ["male", "female", "other"];

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toIsoDate(value);
  return String(value).trim();
}

/** Excel dates arrive as Date objects (cellDates) or as text people typed. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  // dd/mm/yyyy and dd-mm-yyyy, the way an Indian office writes a date.
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : toIsoDate(parsed);
}

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function validate(kind: SheetKind, v: Record<string, string>): string | null {
  switch (kind) {
    case "buses": {
      if (!v.busNumber) return "Bus number is missing";
      if (!v.plateNumber) return "Plate number is missing";
      const cap = Number(v.capacity);
      if (!Number.isFinite(cap) || cap < 1) return "Capacity must be 1 or more";
      return null;
    }
    case "drivers": {
      if (!v.name) return "Name is missing";
      if (!GENDERS.includes(v.gender)) return "Gender must be male, female or other";
      if (!v.dob || Number.isNaN(new Date(v.dob).getTime())) return "Date of birth is not a valid date";
      if (!v.licenceNumber) return "Licence number is missing";
      if (v.aadharNumber.length !== 12) return "Aadhaar number must be 12 digits";
      if (v.mobile.length !== 10) return "Mobile number must be 10 digits";
      if (!v.address) return "Address is missing";
      return null;
    }
    case "students": {
      if (!v.name) return "Name is missing";
      if (!v.rollNumber) return "Roll number is missing";
      if (!GENDERS.includes(v.gender)) return "Gender must be male, female or other";
      if (!v.dob || Number.isNaN(new Date(v.dob).getTime())) return "Date of birth is not a valid date";
      if (v.mobile.length !== 10) return "Mobile number must be 10 digits";
      if (!v.address) return "Address is missing";
      return null;
    }
    case "driverAssignments": {
      if (!v.busNumber) return "Bus number is missing";
      if (!v.licenceNumber && !v.mobile) return "Give the driver's licence number or mobile";
      return null;
    }
    case "studentAssignments": {
      if (!v.rollNumber && !v.mobile) return "Give the student's roll number or mobile";
      if (!v.busNumber) return "Bus number is missing — leave the sheet out to skip assigning";
      return null;
    }
  }
}

const REQUIRED_COLUMNS: Record<SheetKind, string[]> = {
  buses: ["busNumber", "plateNumber", "capacity"],
  drivers: ["name", "dob", "gender", "licenceNumber", "aadharNumber", "mobile", "address"],
  students: ["name", "rollNumber", "gender", "dob", "mobile", "address"],
  driverAssignments: ["busNumber"],
  studentAssignments: ["busNumber"],
};

const COLUMN_LABELS: Record<string, string> = {
  busNumber: "bus number",
  plateNumber: "plate number",
  capacity: "capacity",
  name: "name",
  dob: "date of birth",
  gender: "gender",
  licenceNumber: "licence number",
  aadharNumber: "Aadhaar number",
  mobile: "mobile",
  address: "address",
  rollNumber: "roll number",
  stop: "stop",
};

export function columnLabel(field: string): string {
  return COLUMN_LABELS[field] ?? field;
}

/** Read every sheet we recognise out of an uploaded workbook. */
export function readWorkbook(buffer: ArrayBuffer): ParsedSheet[] {
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of book.SheetNames) {
    const kind = SHEET_ALIASES[norm(sheetName)];
    if (!kind) continue;
    if (sheets.some((s) => s.kind === kind)) continue; // first one wins

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      book.Sheets[sheetName],
      { defval: "" }
    );

    // Map this sheet's headers onto our field names.
    const columnMap: Record<string, string> = {};
    for (const key of Object.keys(raw[0] ?? {})) {
      const field = HEADERS[kind][norm(key)];
      if (field && !columnMap[field]) columnMap[field] = key;
    }

    const missingColumns = REQUIRED_COLUMNS[kind].filter((f) => !columnMap[f]);
    const rows: ParsedRow[] = [];

    if (missingColumns.length === 0) {
      raw.forEach((entry, i) => {
        const values: Record<string, string> = {};
        for (const [field, column] of Object.entries(columnMap)) {
          const cell = entry[column];
          if (field === "dob") values[field] = toIsoDate(cell);
          else if (field === "mobile" || field === "aadharNumber") values[field] = digits(cell);
          else if (field === "gender") values[field] = text(cell).toLowerCase();
          else if (field === "licenceNumber") values[field] = text(cell).toUpperCase();
          else values[field] = text(cell);
        }
        // A trailing blank row is Excel, not an error.
        if (Object.values(values).every((v) => !v)) return;
        rows.push({ rowNumber: i + 2, values, error: validate(kind, values) });
      });
    }

    sheets.push({ kind, sheetName, rows, missingColumns });
  }

  return sheets.sort(
    (a, b) => SHEET_ORDER.indexOf(a.kind) - SHEET_ORDER.indexOf(b.kind)
  );
}

// ─── payloads for the endpoints the single-purpose pages already use ────────

export function toBuses(rows: ParsedRow[]): BusInput[] {
  return rows.map((r) => ({
    busNumber: r.values.busNumber,
    plateNumber: r.values.plateNumber,
    capacity: Number(r.values.capacity),
  }));
}

export function toDrivers(rows: ParsedRow[]): DriverInput[] {
  return rows.map((r) => ({
    name: r.values.name,
    dob: r.values.dob,
    gender: r.values.gender as DriverInput["gender"],
    licenceNumber: r.values.licenceNumber,
    aadharNumber: r.values.aadharNumber,
    mobile: r.values.mobile,
    address: r.values.address,
  }));
}

export function toStudents(rows: ParsedRow[]): StudentBulkInput[] {
  return rows.map((r) => ({
    name: r.values.name,
    rollNumber: r.values.rollNumber,
    gender: r.values.gender as StudentBulkInput["gender"],
    dob: r.values.dob,
    mobile: r.values.mobile,
    address: r.values.address,
  }));
}

export function toDriverAssignments(rows: ParsedRow[]): DriverAssignmentInput[] {
  return rows.map((r) => ({
    busNumber: r.values.busNumber,
    licenceNumber: r.values.licenceNumber || undefined,
    mobile: r.values.mobile || undefined,
  }));
}

export function toStudentAssignments(rows: ParsedRow[]): BusAssignmentInput[] {
  return rows.map((r) => ({
    rollNumber: r.values.rollNumber || undefined,
    mobile: r.values.mobile || undefined,
    busNumber: r.values.busNumber,
    stop: r.values.stop || undefined,
  }));
}

/** A workbook with one sheet per kind, headers and one example row each. */
export function buildTemplate(): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  const sheets: Record<SheetKind, Record<string, string | number>[]> = {
    buses: [{ "Bus number": "21", "Plate number": "TN01AB1234", Capacity: 45 }],
    drivers: [
      {
        Name: "Ravi Kumar",
        "Date of birth": "1985-06-14",
        Gender: "male",
        "Licence number": "TN1420110001234",
        "Aadhaar number": "123412341234",
        Mobile: "9876543210",
        Address: "12 Anna Nagar, Chennai",
      },
    ],
    students: [
      {
        Name: "Ananya S",
        "Roll number": "22CS1041",
        Gender: "female",
        "Date of birth": "2004-02-09",
        Mobile: "9876500011",
        Address: "4 Guindy, Chennai",
      },
    ],
    driverAssignments: [
      { "Bus number": "21", "Licence number": "TN1420110001234", Mobile: "9876543210" },
    ],
    studentAssignments: [
      { "Roll number": "22CS1041", Mobile: "9876500011", "Bus number": "21", Stop: "Guindy" },
    ],
  };

  for (const kind of SHEET_ORDER) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(sheets[kind]),
      SHEET_LABELS[kind]
    );
  }
  return book;
}
