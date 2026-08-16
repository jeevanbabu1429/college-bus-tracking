import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { RoleModel } from "../models/Role.js";
import { StaffModel } from "../models/Staff.js";
import { MODULES, isValidPermission } from "../lib/permissions.js";
import { getCaller } from "../lib/consoleAuth.js";

// Both routers are mounted under /api/colleges/:collegeId, so they inherit
// requireConsoleUser, the ownership check and the `access` permission from
// colleges.ts by fall-through. Nothing in here re-checks who is calling.

export const collegeRolesRouter = Router({ mergeParams: true });
export const collegeStaffRouter = Router({ mergeParams: true });

const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

type PermissionInput = { module: string; actions: string[] };

/**
 * Keeps only permissions the catalogue actually defines.
 *
 * Silently dropping unknown modules rather than erroring means a role saved by
 * an older client does not fail outright, while a typo can never grant access
 * to something that does not exist — and, more importantly, a module removed
 * from the catalogue stops being granted the moment it goes.
 */
function cleanPermissions(raw: unknown): PermissionInput[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: PermissionInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { module, actions } = entry as { module?: unknown; actions?: unknown };
    if (typeof module !== "string" || !Array.isArray(actions)) continue;
    const kept = [...new Set(actions)].filter(
      (a): a is string => typeof a === "string" && isValidPermission(module, a)
    );
    if (kept.length > 0) out.push({ module, actions: kept });
  }
  return out;
}

// The permission matrix the website renders. Served rather than duplicated on
// the client so what an admin ticks can never drift from what is enforced.
collegeRolesRouter.get("/catalogue", (_req, res) => {
  res.json({ modules: MODULES });
});

collegeRolesRouter.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  const roles = await RoleModel.find({ college: collegeId })
    .sort({ createdAt: 1 })
    .lean();
  // Staff counts come along because "delete this role" is only safe to offer
  // when the admin can see nobody is using it.
  const counts = await Promise.all(
    roles.map((r) => StaffModel.countDocuments({ role: r._id }))
  );
  res.json(roles.map((r, i) => ({ ...r, staffCount: counts[i] })));
});

collegeRolesRouter.post("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  const caller = getCaller(req);
  const { name, description, color, permissions, landingPage } = req.body ?? {};

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    res.status(400).json({ error: "A role name is required" });
    return;
  }
  if (trimmed.length > NAME_MAX) {
    res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer` });
    return;
  }
  const cleaned = cleanPermissions(permissions);
  if (cleaned === null) {
    res.status(400).json({ error: "permissions must be an array" });
    return;
  }

  try {
    const role = await RoleModel.create({
      college: collegeId,
      name: trimmed,
      description:
        typeof description === "string" ? description.trim().slice(0, DESCRIPTION_MAX) : "",
      color: typeof color === "string" ? color.slice(0, 16) : "",
      permissions: cleaned,
      landingPage:
        typeof landingPage === "string" && landingPage.startsWith("/")
          ? landingPage.slice(0, 64)
          : "/dashboard",
      createdBy: caller.kind === "admin" ? caller.adminId : null,
    });
    res.status(201).json({ ...role.toObject(), staffCount: 0 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "A role with that name already exists" });
      return;
    }
    throw err;
  }
});

collegeRolesRouter.put("/:roleId", async (req, res) => {
  const { collegeId, roleId } = req.params as {
    collegeId: string;
    roleId: string;
  };
  if (!isValidObjectId(roleId)) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }
  const role = await RoleModel.findOne({ _id: roleId, college: collegeId });
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const { name, description, color, permissions, landingPage } = req.body ?? {};
  if (name !== undefined) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      res.status(400).json({ error: "A role name is required" });
      return;
    }
    role.name = trimmed.slice(0, NAME_MAX);
  }
  if (description !== undefined) {
    role.description =
      typeof description === "string" ? description.trim().slice(0, DESCRIPTION_MAX) : "";
  }
  if (color !== undefined) role.color = typeof color === "string" ? color.slice(0, 16) : "";
  if (landingPage !== undefined && typeof landingPage === "string" && landingPage.startsWith("/")) {
    role.landingPage = landingPage.slice(0, 64);
  }
  if (permissions !== undefined) {
    const cleaned = cleanPermissions(permissions);
    if (cleaned === null) {
      res.status(400).json({ error: "permissions must be an array" });
      return;
    }
    role.set("permissions", cleaned);
  }

  try {
    await role.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "A role with that name already exists" });
      return;
    }
    throw err;
  }
  const staffCount = await StaffModel.countDocuments({ role: role._id });
  res.json({ ...role.toObject(), staffCount });
});

collegeRolesRouter.delete("/:roleId", async (req, res) => {
  const { collegeId, roleId } = req.params as {
    collegeId: string;
    roleId: string;
  };
  if (!isValidObjectId(roleId)) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }
  // Refused rather than cascaded: deleting a role out from under its people
  // would silently lock them out, and the admin is better placed to decide
  // where they should go instead.
  const inUse = await StaffModel.countDocuments({ role: roleId });
  if (inUse > 0) {
    res.status(409).json({
      error: `${inUse} ${inUse === 1 ? "person is" : "people are"} using this role. Move them to another role first.`,
    });
    return;
  }
  const deleted = await RoleModel.findOneAndDelete({
    _id: roleId,
    college: collegeId,
  });
  if (!deleted) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- staff ----

function normaliseMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

collegeStaffRouter.get("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  const staff = await StaffModel.find({ college: collegeId })
    .select("name mobile active role lastLoginAt createdAt")
    .populate("role", "name color")
    .sort({ createdAt: -1 })
    .lean();
  res.json(staff);
});

collegeStaffRouter.post("/", async (req, res) => {
  const { collegeId } = req.params as { collegeId: string };
  const caller = getCaller(req);
  const { name, mobile, roleId } = req.body ?? {};

  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    res.status(400).json({ error: "A name is required" });
    return;
  }
  const digits = normaliseMobile(mobile);
  if (!digits) {
    res.status(400).json({ error: "A 10-digit mobile number is required" });
    return;
  }
  if (!isValidObjectId(roleId)) {
    res.status(400).json({ error: "Pick a role" });
    return;
  }
  // The role has to be one of this college's own — otherwise an id copied from
  // elsewhere would import another college's permission set wholesale.
  const role = await RoleModel.findOne({ _id: roleId, college: collegeId })
    .select("_id")
    .lean();
  if (!role) {
    res.status(400).json({ error: "That role does not belong to this college" });
    return;
  }

  try {
    const staff = await StaffModel.create({
      college: collegeId,
      role: roleId,
      name: trimmed.slice(0, NAME_MAX),
      mobile: digits,
      createdBy: caller.kind === "admin" ? caller.adminId : null,
    });
    const populated = await staff.populate("role", "name color");
    res.status(201).json(populated);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "Someone with that mobile is already on this college" });
      return;
    }
    throw err;
  }
});

collegeStaffRouter.put("/:staffId", async (req, res) => {
  const { collegeId, staffId } = req.params as {
    collegeId: string;
    staffId: string;
  };
  if (!isValidObjectId(staffId)) {
    res.status(400).json({ error: "Invalid staff id" });
    return;
  }
  const staff = await StaffModel.findOne({ _id: staffId, college: collegeId });
  if (!staff) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }

  const { name, roleId, active } = req.body ?? {};
  if (name !== undefined) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
      res.status(400).json({ error: "A name is required" });
      return;
    }
    staff.name = trimmed.slice(0, NAME_MAX);
  }
  if (roleId !== undefined) {
    if (!isValidObjectId(roleId)) {
      res.status(400).json({ error: "Pick a role" });
      return;
    }
    const role = await RoleModel.findOne({ _id: roleId, college: collegeId })
      .select("_id")
      .lean();
    if (!role) {
      res.status(400).json({ error: "That role does not belong to this college" });
      return;
    }
    staff.role = role._id;
  }
  if (typeof active === "boolean") staff.active = active;

  await staff.save();
  const populated = await staff.populate("role", "name color");
  res.json(populated);
});

collegeStaffRouter.delete("/:staffId", async (req, res) => {
  const { collegeId, staffId } = req.params as {
    collegeId: string;
    staffId: string;
  };
  if (!isValidObjectId(staffId)) {
    res.status(400).json({ error: "Invalid staff id" });
    return;
  }
  const deleted = await StaffModel.findOneAndDelete({
    _id: staffId,
    college: collegeId,
  });
  if (!deleted) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json({ ok: true });
});
