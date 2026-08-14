"use client";

import { useEffect, useMemo, useState } from "react";
import type { Gender, Student, StudentInput } from "../lib/api/collegeStudents";
import type { Bus } from "../lib/api/collegeBuses";
import { RequiredMark } from "./RequiredMark";
import { IconBus, IconPhone, IconUsers } from "./icons";

const GENDERS: Gender[] = ["male", "female", "other"];

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

type Field = "name" | "rollNumber" | "dob" | "mobile" | "address";

type Props = {
  initial?: Student | null;
  buses: Bus[];
  submitLabel: string;
  onSubmit: (input: StudentInput) => Promise<void>;
  onCancel?: () => void;
};

export function StudentForm({
  initial,
  buses,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [busId, setBusId] = useState<string>("");
  const [stop, setStop] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>(
    {}
  );

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setRollNumber(initial.rollNumber);
    setGender(initial.gender);
    setDob(isoDate(initial.dob));
    setAddress(initial.address);
    setMobile(initial.mobile);
    setBusId(initial.bus?._id ?? "");
    setStop(initial.stop ?? "");
  }, [initial]);

  // A stop only means anything on the route it belongs to, so it is dropped
  // the moment the chosen bus stops offering it.
  useEffect(() => {
    if (!busId) {
      setStop("");
      return;
    }
    const bus = buses.find((b) => b._id === busId);
    if (!bus || !bus.stops.some((s) => s.name === stop)) {
      setStop("");
    }
  }, [busId, buses, stop]);

  const selectedBus = buses.find((b) => b._id === busId);
  const selectedStop = selectedBus?.stops.find((s) => s.name === stop);

  const dirty = useMemo(() => {
    if (!initial) return true;
    return (
      name !== initial.name ||
      rollNumber !== initial.rollNumber ||
      gender !== initial.gender ||
      dob !== isoDate(initial.dob) ||
      address !== initial.address ||
      mobile !== initial.mobile ||
      busId !== (initial.bus?._id ?? "") ||
      stop !== (initial.stop ?? "")
    );
  }, [initial, name, rollNumber, gender, dob, address, mobile, busId, stop]);

  function clearFieldError(field: Field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // Errors land on the field that caused them rather than in one lump at the
  // bottom, so a long form points straight at the box to fix.
  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!name.trim()) next.name = "Enter a name";
    if (!rollNumber.trim()) next.rollNumber = "Enter a roll number";
    if (!dob) next.dob = "Pick a date of birth";
    if (!mobile.trim()) next.mobile = "Enter a mobile number";
    if (!address.trim()) next.address = "Enter an address";
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) {
      setError("Check the highlighted fields above.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        gender,
        dob,
        address: address.trim(),
        mobile: mobile.trim(),
        busId: busId || null,
        stop: busId && stop ? stop : null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="formstack" onSubmit={handleSubmit} noValidate>
      <section className="formsection">
        <div className="formsection-head">
          <span className="formsection-icon" aria-hidden>
            <IconUsers size={17} />
          </span>
          <div className="formsection-titles">
            <h2 className="formsection-title">Student details</h2>
            <span className="formsection-hint">
              The roll number is what the student signs in with, so it has to
              match the college register.
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-name">
              Name
              <RequiredMark />
            </label>
            <input
              id="student-name"
              className="field-control"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError("name");
              }}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-required
              autoComplete="name"
            />
            {fieldErrors.name && (
              <span className="field-error">{fieldErrors.name}</span>
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-roll">
              Roll number
              <RequiredMark />
            </label>
            <input
              id="student-roll"
              className="field-control"
              value={rollNumber}
              onChange={(e) => {
                setRollNumber(e.target.value);
                clearFieldError("rollNumber");
              }}
              aria-invalid={fieldErrors.rollNumber ? true : undefined}
              aria-required
            />
            {fieldErrors.rollNumber && (
              <span className="field-error">{fieldErrors.rollNumber}</span>
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-dob">
              Date of birth
              <RequiredMark />
            </label>
            <input
              id="student-dob"
              className="field-control"
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                clearFieldError("dob");
              }}
              aria-invalid={fieldErrors.dob ? true : undefined}
              aria-required
            />
            {fieldErrors.dob && (
              <span className="field-error">{fieldErrors.dob}</span>
            )}
          </div>
        </div>

        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <span className="field-label">
            Gender
            <RequiredMark />
          </span>
          <div className="chip-row" role="group" aria-label="Gender">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                aria-pressed={gender === g}
                className={`chip ${gender === g ? "chip-active" : ""}`}
                style={{ textTransform: "capitalize" }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="formsection">
        <div className="formsection-head">
          <span className="formsection-icon" aria-hidden>
            <IconPhone size={17} />
          </span>
          <div className="formsection-titles">
            <h2 className="formsection-title">Contact</h2>
            <span className="formsection-hint">
              Used to reach the student or their family about this bus.
            </span>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label className="field-label" htmlFor="student-mobile">
            Mobile
            <RequiredMark />
          </label>
          <input
            id="student-mobile"
            className="field-control"
            value={mobile}
            onChange={(e) => {
              setMobile(e.target.value);
              clearFieldError("mobile");
            }}
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={fieldErrors.mobile ? true : undefined}
            aria-required
          />
          {fieldErrors.mobile && (
            <span className="field-error">{fieldErrors.mobile}</span>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="student-address">
            Address
            <RequiredMark />
          </label>
          <textarea
            id="student-address"
            className="field-control"
            rows={2}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              clearFieldError("address");
            }}
            aria-invalid={fieldErrors.address ? true : undefined}
            aria-required
          />
          {fieldErrors.address && (
            <span className="field-error">{fieldErrors.address}</span>
          )}
        </div>
      </section>

      <section className="formsection">
        <div className="formsection-head">
          <span className="formsection-icon" aria-hidden>
            <IconBus size={17} />
          </span>
          <div className="formsection-titles">
            <h2 className="formsection-title">Transport</h2>
            <span className="formsection-hint">
              Optional — a student can be enrolled now and put on a bus later
              from Assign students.
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-bus">
              Bus
            </label>
            <select
              id="student-bus"
              className="field-control"
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
            >
              <option value="">— No bus —</option>
              {buses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.busNumber} · {b.plateNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="student-stop">
              Pickup stop
            </label>
            {selectedBus && selectedBus.stops.length > 0 ? (
              <select
                id="student-stop"
                className="field-control"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
              >
                <option value="">— Not set —</option>
                {selectedBus.stops.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                    {s.suspended ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="student-stop"
                className="field-control"
                value=""
                disabled
                readOnly
                placeholder={
                  selectedBus ? "This route has no stops yet" : "Pick a bus first"
                }
              />
            )}
          </div>
        </div>

        {/* What was actually chosen, in words — a bus number alone doesn't tell
            you whether it is the right route for this student. */}
        {selectedBus && (
          <div className="buspreview">
            <span className="buspreview-mark" aria-hidden>
              <IconBus size={18} />
            </span>
            <span className="buspreview-body">
              <span className="buspreview-title">
                Bus {selectedBus.busNumber}
                {selectedBus.route ? ` · ${selectedBus.route}` : ""}
              </span>
              <span className="buspreview-meta">
                {selectedBus.stops.length} stop
                {selectedBus.stops.length === 1 ? "" : "s"} ·{" "}
                {selectedBus.capacity} seats ·{" "}
                {selectedBus.driver
                  ? `Driver ${selectedBus.driver.name}`
                  : "No driver assigned"}
              </span>
            </span>
          </div>
        )}

        {selectedBus && selectedBus.stops.length > 0 && !stop && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            No pickup stop chosen — the student rides this bus but won&rsquo;t
            appear at any stop on the driver&rsquo;s list.
          </div>
        )}

        {selectedStop?.suspended && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            {selectedStop.name} is currently suspended on this route.
          </div>
        )}
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="formbar">
        <span className="formbar-note">
          {!initial ? (
            <>
              Fields marked <span className="required">*</span> are required.
            </>
          ) : dirty ? (
            <>
              <span className="status-dot status-dot-warning" aria-hidden />
              <strong>Unsaved changes</strong>
            </>
          ) : (
            <>No changes yet.</>
          )}
        </span>
        <div className="formbar-actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
