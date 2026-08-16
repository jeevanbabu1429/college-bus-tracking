"use client";

import { useMemo, useState } from "react";
import type { ModuleDef, Role } from "../lib/api/collegeAccess";
import type { Grant } from "../lib/api/staffAuth";
import { IconCheck, IconTrash } from "./icons";

const LANDING_PAGES: { value: string; label: string; module: string }[] = [
  { value: "/dashboard", label: "Dashboard", module: "dashboard" },
  { value: "/buses", label: "Buses", module: "buses" },
  { value: "/drivers", label: "Drivers", module: "drivers" },
  { value: "/students", label: "Students", module: "students" },
  { value: "/send-notification", label: "Send notification", module: "notifications" },
];

type Draft = Record<string, Set<string>>;

function toDraft(permissions: Grant[]): Draft {
  const draft: Draft = {};
  for (const grant of permissions) draft[grant.module] = new Set(grant.actions);
  return draft;
}

function toGrants(draft: Draft): Grant[] {
  return Object.entries(draft)
    .filter(([, actions]) => actions.size > 0)
    .map(([module, actions]) => ({ module, actions: [...actions] }));
}

function sameGrants(a: Grant[], b: Grant[]): boolean {
  const norm = (g: Grant[]) =>
    JSON.stringify(
      [...g]
        .map((x) => ({ module: x.module, actions: [...x.actions].sort() }))
        .sort((x, y) => x.module.localeCompare(y.module))
    );
  return norm(a) === norm(b);
}

/**
 * The permission matrix for one role.
 *
 * Every module offers None / View only / Full as one-click presets, with the
 * individual actions underneath for anything in between. The presets exist
 * because that is what almost every role actually is, and ticking four boxes
 * across nine modules to express "can see everything" is a chore that invites
 * mistakes.
 */
export function RolePermissions({
  role,
  modules,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: {
  role: Role;
  modules: ModuleDef[];
  canEdit: boolean;
  canDelete: boolean;
  onSave: (patch: {
    permissions?: Grant[];
    landingPage?: string;
    name?: string;
    description?: string;
  }) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(role.permissions));
  const [landing, setLanding] = useState(role.landingPage || "/dashboard");
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grants = useMemo(() => toGrants(draft), [draft]);
  const dirty =
    !sameGrants(grants, role.permissions) ||
    landing !== (role.landingPage || "/dashboard") ||
    name.trim() !== role.name ||
    description !== (role.description ?? "");

  function setModule(module: string, actions: string[]) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [module]: new Set(actions) }));
  }

  function toggleAction(module: string, action: string) {
    setSaved(false);
    setDraft((prev) => {
      const next = new Set(prev[module] ?? []);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return { ...prev, [module]: next };
    });
  }

  function levelOf(mod: ModuleDef): "none" | "view" | "full" | "custom" {
    const actions = draft[mod.key] ?? new Set<string>();
    if (actions.size === 0) return "none";
    if (actions.size === mod.actions.length) return "full";
    if (actions.size === 1 && actions.has("read")) return "view";
    return "custom";
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        permissions: grants,
        landingPage: landing,
        name: name.trim(),
        description,
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="access-detail">
      <div className="access-detail-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {canEdit ? (
            <input
              className="access-title-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              aria-label="Role name"
            />
          ) : (
            <h2 className="access-title">{role.name}</h2>
          )}
          {canEdit ? (
            <input
              className="access-desc-input"
              value={description}
              placeholder="What is this role for?"
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              aria-label="Role description"
            />
          ) : (
            role.description && <p className="access-desc">{role.description}</p>
          )}
        </div>
        {canDelete && (
          <button
            type="button"
            className="link-action link-action-danger"
            onClick={onDelete}
            title={
              role.staffCount > 0
                ? "Move this role's people elsewhere first"
                : "Delete this role"
            }
          >
            <IconTrash size={13} /> Delete
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="access-landing">
        <div>
          <div className="access-landing-label">Landing page</div>
          <div className="access-landing-help">
            Where this role arrives after signing in.
          </div>
        </div>
        <select
          className="field-control"
          value={landing}
          disabled={!canEdit}
          onChange={(e) => {
            setLanding(e.target.value);
            setSaved(false);
          }}
        >
          {LANDING_PAGES.map((p) => {
            // Landing somewhere the role cannot read would greet them with a
            // permission error on every sign-in.
            const reachable = (draft[p.module]?.size ?? 0) > 0;
            return (
              <option key={p.value} value={p.value} disabled={!reachable}>
                {p.label}
                {reachable ? "" : " — no access"}
              </option>
            );
          })}
        </select>
      </div>

      <div className="access-modules">
        {modules.map((mod) => {
          const level = levelOf(mod);
          const actions = draft[mod.key] ?? new Set<string>();
          return (
            <div className="access-module" key={mod.key} data-level={level}>
              <div className="access-module-head">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="access-module-title">
                    {mod.label}
                    <span className={`access-badge access-badge-${level}`}>
                      {level === "none"
                        ? "No access"
                        : level === "full"
                        ? "Full access"
                        : level === "view"
                        ? "View only"
                        : "Custom"}
                    </span>
                  </div>
                  <div className="access-module-desc">{mod.description}</div>
                </div>
                <div className="access-levels" role="group" aria-label={mod.label}>
                  <button
                    type="button"
                    className="access-level"
                    data-on={level === "none"}
                    disabled={!canEdit}
                    onClick={() => setModule(mod.key, [])}
                  >
                    None
                  </button>
                  {mod.actions.includes("read") && (
                    <button
                      type="button"
                      className="access-level"
                      data-on={level === "view"}
                      disabled={!canEdit}
                      onClick={() => setModule(mod.key, ["read"])}
                    >
                      View only
                    </button>
                  )}
                  <button
                    type="button"
                    className="access-level"
                    data-on={level === "full"}
                    disabled={!canEdit}
                    onClick={() => setModule(mod.key, [...mod.actions])}
                  >
                    Full
                  </button>
                </div>
              </div>

              <div className="access-actions">
                {mod.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="access-chip"
                    data-on={actions.has(action)}
                    disabled={!canEdit}
                    onClick={() => toggleAction(mod.key, action)}
                  >
                    {actions.has(action) && <IconCheck size={11} />}
                    {action}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="formbar">
          <span className="formbar-note">
            {saving ? (
              "Saving…"
            ) : dirty ? (
              <>
                <span className="status-dot status-dot-warning" aria-hidden />
                <strong>Unsaved changes</strong>
              </>
            ) : saved ? (
              <>
                <span className="status-dot status-dot-success" aria-hidden />
                Saved
              </>
            ) : (
              <>
                {role.staffCount} {role.staffCount === 1 ? "person has" : "people have"}{" "}
                this role. Changes apply to them straight away.
              </>
            )}
          </span>
          <div className="formbar-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!dirty || saving || !name.trim()}
              onClick={save}
            >
              {saving ? <span className="spinner spinner-light" /> : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
