"use client";

import { useEffect, useState } from "react";
import type { College, CollegeInput } from "../lib/api/colleges";

type Props = {
  initial?: College | null;
  submitLabel: string;
  onSubmit: (input: CollegeInput) => Promise<void>;
  onCancel?: () => void;
};

export function CollegeForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [busCount, setBusCount] = useState<string>("0");
  const [driverCount, setDriverCount] = useState<string>("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setAddress(initial.address);
    setCode(initial.code);
    setBusCount(String(initial.busCount));
    setDriverCount(String(initial.driverCount));
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !address.trim() || !code.trim()) {
      setError("Name, address, and code are required");
      return;
    }
    const bc = Number(busCount);
    const dc = Number(driverCount);
    if (!Number.isFinite(bc) || bc < 0) {
      setError("Bus count must be a non-negative number");
      return;
    }
    if (!Number.isFinite(dc) || dc < 0) {
      setError("Driver count must be a non-negative number");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        code: code.trim().toUpperCase(),
        busCount: bc,
        driverCount: dc,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
      <div className="form-grid">
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">College name</label>
          <input
            className="field-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Code</label>
          <input
            className="field-control"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label className="field-label">Address</label>
        <textarea
          className="field-control"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          required
        />
      </div>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Planned bus count</label>
          <input
            className="field-control"
            type="number"
            min={0}
            value={busCount}
            onChange={(e) => setBusCount(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Planned driver count</label>
          <input
            className="field-control"
            type="number"
            min={0}
            value={driverCount}
            onChange={(e) => setDriverCount(e.target.value)}
          />
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
