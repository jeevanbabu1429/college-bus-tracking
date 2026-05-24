"use client";

import { useEffect, useState } from "react";
import type {
  Gender,
  Student,
  StudentInput,
} from "../lib/api/collegeStudents";
import type { Bus } from "../lib/api/collegeBuses";

const GENDERS: Gender[] = ["male", "female", "other"];

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

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

  // If the chosen bus has no current stop, clear stop
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !name.trim() ||
      !rollNumber.trim() ||
      !dob ||
      !address.trim() ||
      !mobile.trim()
    ) {
      setError("All fields are required");
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
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 780 }}>
      <div className="form-grid">
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Name</label>
          <input
            className="field-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Roll number</label>
          <input
            className="field-control"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Date of birth</label>
          <input
            className="field-control"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Mobile</label>
          <input
            className="field-control"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="tel"
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label className="field-label">Gender</label>
        <div className="chip-row">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`chip ${gender === g ? "chip-active" : ""}`}
              style={{ textTransform: "capitalize" }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label className="field-label">Address</label>
        <textarea
          className="field-control"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </div>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Bus (optional)</label>
          <select
            className="field-control"
            value={busId}
            onChange={(e) => setBusId(e.target.value)}
          >
            <option value="">— None —</option>
            {buses.map((b) => (
              <option key={b._id} value={b._id}>
                {b.busNumber} · {b.plateNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Stop</label>
          {selectedBus && selectedBus.stops.length > 0 ? (
            <select
              className="field-control"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
            >
              <option value="">— None —</option>
              {selectedBus.stops.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                  {s.suspended ? " (suspended)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="field-control"
              value=""
              disabled
              placeholder={
                selectedBus ? "No stops on this route" : "Pick a bus first"
              }
            />
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner spinner-light" /> : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
