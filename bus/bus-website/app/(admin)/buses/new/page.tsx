"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useColleges } from "../../../../lib/college/CollegeContext";
import { collegeBusesApi } from "../../../../lib/api/collegeBuses";
import { NoCollege } from "../../../../components/NoCollege";

export default function NewBusPage() {
  const router = useRouter();
  const { selected } = useColleges();
  const [busNumber, setBusNumber] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selected) return <NoCollege />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    if (!busNumber.trim() || !plateNumber.trim()) {
      setError("Bus number and plate number are required");
      return;
    }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap < 1) {
      setError("Capacity must be a positive number");
      return;
    }
    setBusy(true);
    try {
      await collegeBusesApi.create(selected._id, {
        busNumber: busNumber.trim(),
        plateNumber: plateNumber.trim().toUpperCase(),
        capacity: cap,
      });
      router.push("/buses");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Add bus</h1>
          <p className="page-subtitle">Register a new vehicle for {selected.name}.</p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Bus number</label>
            <input
              className="field-control"
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              placeholder="e.g. B1"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Plate number</label>
            <input
              className="field-control"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g. KA01AB1234"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Capacity</label>
            <input
              className="field-control"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? <span className="spinner spinner-light" /> : "Create bus"}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
