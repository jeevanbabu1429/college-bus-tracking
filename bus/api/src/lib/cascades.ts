import type { Types } from "mongoose";
import { AdminModel } from "../models/Admin.js";
import { BusModel } from "../models/Bus.js";
import { CollegeModel } from "../models/College.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";
import { deleteImage } from "./images.js";

// Delete a college and every downstream entity in a safe fixed order.
//
// Order matters because Bus has a partial-unique index on `driver` — if we
// drop drivers before releasing that reference, the index leaves dangling
// entries and future writes fail with duplicate key errors. So we:
//   1. Delete students (leaf, no downstream refs)
//   2. Un-assign drivers from buses (releases the partial-unique index)
//   3. Delete drivers
//   4. Delete buses
//   5. Delete the college
export async function deleteCollegeCascade(
  collegeId: string | Types.ObjectId
): Promise<{
  students: number;
  drivers: number;
  buses: number;
}> {
  const studentsRes = await StudentModel.deleteMany({ college: collegeId });
  await BusModel.updateMany(
    { college: collegeId, driver: { $ne: null } },
    { $set: { driver: null } }
  );
  // Photos are collected before the drivers go, and removed from storage only
  // after — a failed file delete must never block deleting the college.
  const photos = await DriverModel.find({ college: collegeId, image: { $ne: null } })
    .select("image")
    .lean();
  const driversRes = await DriverModel.deleteMany({ college: collegeId });
  await Promise.all(photos.map((d) => deleteImage(d.image)));
  const busesRes = await BusModel.deleteMany({ college: collegeId });
  await CollegeModel.deleteOne({ _id: collegeId });
  return {
    students: studentsRes.deletedCount ?? 0,
    drivers: driversRes.deletedCount ?? 0,
    buses: busesRes.deletedCount ?? 0,
  };
}

// Delete an admin and every college they own (with the full college cascade).
// The admin is deleted last so mid-cascade failures leave a re-runnable state
// rather than orphaning colleges under a missing admin.
export async function deleteAdminCascade(
  adminId: string | Types.ObjectId
): Promise<{
  colleges: number;
  students: number;
  drivers: number;
  buses: number;
}> {
  const colleges = await CollegeModel.find({ admin: adminId }).select("_id");
  const totals = { students: 0, drivers: 0, buses: 0 };
  for (const c of colleges) {
    const n = await deleteCollegeCascade(c._id);
    totals.students += n.students;
    totals.drivers += n.drivers;
    totals.buses += n.buses;
  }
  await AdminModel.deleteOne({ _id: adminId });
  return { colleges: colleges.length, ...totals };
}

// Delete one driver and let go of anything pointing at them: the bus they were
// assigned to keeps its route and students, it just has no driver until one is
// put back. The photo file is removed after the document, so a storage failure
// cannot leave an account half-deleted.
export async function deleteDriverAccount(
  driverId: string | Types.ObjectId
): Promise<void> {
  const driver = await DriverModel.findById(driverId).select("image").lean();
  await BusModel.updateMany({ driver: driverId }, { $set: { driver: null } });
  await DriverModel.deleteOne({ _id: driverId });
  await deleteImage(driver?.image ?? null);
}

// Delete one student. Their seat on the bus goes with them and nothing else
// is affected.
export async function deleteStudentAccount(
  studentId: string | Types.ObjectId
): Promise<void> {
  await StudentModel.deleteOne({ _id: studentId });
}
