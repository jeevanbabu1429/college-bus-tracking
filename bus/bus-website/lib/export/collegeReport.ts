import type { College } from "../api/colleges";
import { collegeBusesApi, type Bus } from "../api/collegeBuses";
import { collegeDriversApi, type Driver } from "../api/collegeDrivers";
import { collegeStudentsApi, type Student } from "../api/collegeStudents";

// One neutral shape that both the Excel and PDF writers render, so the two
// exports can never drift apart.
export type ReportSection = {
  /** Sheet name in Excel — Excel caps these at 31 chars and bans []:*?/\ */
  key: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export type CollegeReport = {
  college: College;
  /** Goes into the filename: `PDKV-drivers-2026-08-02.xlsx` */
  slug: string;
  generatedAt: Date;
  sections: ReportSection[];
};

function isoDay(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function buildCollegeReport(
  college: College
): Promise<CollegeReport> {
  const [buses, drivers, students] = await Promise.all([
    collegeBusesApi.list(college._id),
    collegeDriversApi.list(college._id),
    collegeStudentsApi.list(college._id),
  ]);

  return {
    college,
    slug: "report",
    generatedAt: new Date(),
    sections: [
      summarySection(college, buses, drivers, students),
      busesSection(buses),
      driversSection(drivers, buses),
      studentsSection(students),
      driverAssignmentsSection(buses, drivers),
      studentAssignmentsSection(buses, students),
    ],
  };
}

/* ------------------------------------------------- per-module reports */

// Buses come with their route stops — that detail isn't exportable anywhere
// else, and it's the part admins most often need to hand over.
export async function buildBusesReport(
  college: College
): Promise<CollegeReport> {
  const buses = await collegeBusesApi.list(college._id);
  return {
    college,
    slug: "buses",
    generatedAt: new Date(),
    sections: [busesSection(buses), busStopsSection(buses)],
  };
}

// Needs buses too, purely to fill in each driver's assigned bus.
export async function buildDriversReport(
  college: College
): Promise<CollegeReport> {
  const [drivers, buses] = await Promise.all([
    collegeDriversApi.list(college._id),
    collegeBusesApi.list(college._id),
  ]);
  return {
    college,
    slug: "drivers",
    generatedAt: new Date(),
    sections: [driversSection(drivers, buses)],
  };
}

export async function buildStudentsReport(
  college: College
): Promise<CollegeReport> {
  const students = await collegeStudentsApi.list(college._id);
  return {
    college,
    slug: "students",
    generatedAt: new Date(),
    sections: [studentsSection(students)],
  };
}

function summarySection(
  college: College,
  buses: Bus[],
  drivers: Driver[],
  students: Student[]
): ReportSection {
  const assignedDrivers = buses.filter((b) => b.driver).length;
  const assignedStudents = students.filter((s) => s.bus).length;
  const withRoute = buses.filter((b) => b.stops.length > 0).length;

  return {
    key: "Summary",
    title: "Summary",
    columns: ["Item", "Value"],
    rows: [
      ["College", college.name],
      ["Code", college.code],
      ["Address", college.address],
      ["Buses", buses.length],
      ["Buses with a route", withRoute],
      ["Drivers", drivers.length],
      ["Drivers assigned to a bus", assignedDrivers],
      ["Drivers unassigned", drivers.length - assignedDrivers],
      ["Students", students.length],
      ["Students assigned to a bus", assignedStudents],
      ["Students unassigned", students.length - assignedStudents],
    ],
  };
}

function busesSection(buses: Bus[]): ReportSection {
  return {
    key: "Buses",
    title: "Buses",
    columns: [
      "Bus number",
      "Plate number",
      "Capacity",
      "Route",
      "Stops",
      "Driver",
      "Driver mobile",
      "Notice",
    ],
    rows: buses.map((b) => [
      b.busNumber,
      b.plateNumber,
      b.capacity,
      b.route || "—",
      b.stops.length,
      b.driver?.name ?? "Unassigned",
      b.driver?.mobile ?? "",
      b.notice || "",
    ]),
  };
}

// Every stop of every route, flattened one row per stop.
function busStopsSection(buses: Bus[]): ReportSection {
  const rows: (string | number)[][] = [];
  for (const b of buses) {
    if (b.stops.length === 0) {
      rows.push([b.busNumber, b.route || "—", "", "— no stops —", "", "", "", ""]);
      continue;
    }
    b.stops.forEach((s, i) => {
      rows.push([
        b.busNumber,
        b.route || "—",
        i + 1,
        s.name,
        s.lat ?? "",
        s.lng ?? "",
        s.suspended ? "Suspended" : "Active",
        s.temporaryReplacement ?? "",
      ]);
    });
  }

  return {
    key: "Bus stops",
    title: "Bus stops",
    columns: [
      "Bus number",
      "Route",
      "Order",
      "Stop",
      "Latitude",
      "Longitude",
      "Status",
      "Temporary replacement",
    ],
    rows,
  };
}

// `image` is deliberately absent — it's a base64 data URL and would bloat the
// file enormously for no benefit in a spreadsheet or table.
function driversSection(drivers: Driver[], buses: Bus[]): ReportSection {
  const busByDriverId = new Map<string, Bus>();
  for (const b of buses) if (b.driver) busByDriverId.set(b.driver._id, b);

  return {
    key: "Drivers",
    title: "Drivers",
    columns: [
      "Name",
      "Gender",
      "Date of birth",
      "Mobile",
      "Licence number",
      "Aadhar number",
      "Address",
      "Assigned bus",
    ],
    rows: drivers.map((d) => [
      d.name,
      d.gender,
      isoDay(d.dob),
      d.mobile,
      d.licenceNumber,
      d.aadharNumber,
      d.address,
      busByDriverId.get(d._id)?.busNumber ?? "Unassigned",
    ]),
  };
}

function studentsSection(students: Student[]): ReportSection {
  return {
    key: "Students",
    title: "Students",
    columns: [
      "Name",
      "Roll number",
      "Gender",
      "Date of birth",
      "Mobile",
      "Address",
      "Bus",
      "Stop",
    ],
    rows: students.map((s) => [
      s.name,
      s.rollNumber,
      s.gender,
      isoDay(s.dob),
      s.mobile,
      s.address,
      s.bus?.busNumber ?? "Unassigned",
      s.stop ?? "",
    ]),
  };
}

// Bus-first view: every bus with its driver, plus drivers left over at the end
// so nobody is missing from the picture.
function driverAssignmentsSection(
  buses: Bus[],
  drivers: Driver[]
): ReportSection {
  const assignedIds = new Set(
    buses.map((b) => b.driver?._id).filter(Boolean) as string[]
  );

  const rows: (string | number)[][] = buses.map((b) => [
    b.busNumber,
    b.plateNumber,
    b.driver?.name ?? "— none —",
    b.driver?.mobile ?? "",
    b.driver?.licenceNumber ?? "",
    b.driver ? "Assigned" : "No driver",
  ]);

  for (const d of drivers) {
    if (assignedIds.has(d._id)) continue;
    rows.push(["— none —", "", d.name, d.mobile, d.licenceNumber, "Unassigned"]);
  }

  return {
    key: "Bus-Driver assignments",
    title: "Bus and driver assignments",
    columns: ["Bus number", "Plate number", "Driver", "Mobile", "Licence", "Status"],
    rows,
  };
}

// Bus-first view of seat allocation, with unassigned students listed after.
function studentAssignmentsSection(
  buses: Bus[],
  students: Student[]
): ReportSection {
  const rows: (string | number)[][] = [];

  for (const b of buses) {
    const onBoard = students.filter((s) => s.bus?._id === b._id);
    if (onBoard.length === 0) {
      rows.push([b.busNumber, b.plateNumber, `0/${b.capacity}`, "— no students —", "", ""]);
      continue;
    }
    for (const s of onBoard) {
      rows.push([
        b.busNumber,
        b.plateNumber,
        `${onBoard.length}/${b.capacity}`,
        s.name,
        s.rollNumber,
        s.stop ?? "No stop",
      ]);
    }
  }

  for (const s of students) {
    if (s.bus) continue;
    rows.push(["— none —", "", "", s.name, s.rollNumber, "Unassigned"]);
  }

  return {
    key: "Bus-Student assignments",
    title: "Bus and student assignments",
    columns: [
      "Bus number",
      "Plate number",
      "Occupancy",
      "Student",
      "Roll number",
      "Stop",
    ],
    rows,
  };
}

/** `PDKV-drivers-2026-08-02` — safe for a filename on every OS. */
export function reportFileBase(report: CollegeReport): string {
  const code = (report.college.code || report.college.name || "college")
    .replace(/[^A-Za-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${code}-${report.slug}-${isoDay(report.generatedAt.toISOString())}`;
}
