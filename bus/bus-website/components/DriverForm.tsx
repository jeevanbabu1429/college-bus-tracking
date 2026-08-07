"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Driver,
  DriverInput,
  Gender,
} from "../lib/api/collegeDrivers";
import { RequiredLegend, RequiredMark } from "./RequiredMark";
import { fileToSquareDataUrl } from "../lib/images";
import { IconUpload, IconX } from "./icons";

const GENDERS: Gender[] = ["male", "female", "other"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isoDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

type Props = {
  initial?: Driver | null;
  submitLabel: string;
  onSubmit: (input: DriverInput) => Promise<void>;
  onCancel?: () => void;
};

export function DriverForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setDob(isoDate(initial.dob));
    setGender(initial.gender);
    setLicenceNumber(initial.licenceNumber);
    setAadharNumber(initial.aadharNumber);
    setMobile(initial.mobile);
    setAddress(initial.address);
    setImage(initial.image ?? null);
  }, [initial]);

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset straight away so re-picking the same file still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setError(null);
    try {
      setImage(await fileToSquareDataUrl(file));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !name.trim() ||
      !dob ||
      !licenceNumber.trim() ||
      !aadharNumber.trim() ||
      !mobile.trim() ||
      !address.trim()
    ) {
      setError("All fields are required");
      return;
    }
    if (!/^\d{12}$/.test(aadharNumber.trim())) {
      setError("Aadhar must be exactly 12 digits");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        dob,
        gender,
        licenceNumber: licenceNumber.trim().toUpperCase(),
        aadharNumber: aadharNumber.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        image,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 780 }}>
      <RequiredLegend />

      <div className="field" style={{ marginBottom: 20 }}>
        <label className="field-label">Photo</label>
        <div className="photo-field">
          <span className="photo-preview">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" />
            ) : (
              <span className="photo-preview-empty">
                {initialsOf(name) || "—"}
              </span>
            )}
          </span>
          <div className="photo-field-body">
            <div className="photo-field-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconUpload size={13} /> {image ? "Change photo" : "Upload photo"}
              </button>
              {image && (
                <button
                  type="button"
                  className="link-action link-action-danger"
                  onClick={() => setImage(null)}
                >
                  <IconX size={12} /> Remove
                </button>
              )}
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              Optional. JPG, PNG or WebP — cropped to a square and shrunk
              automatically.
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPhotoPicked}
            hidden
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">
            Name
            <RequiredMark />
          </label>
          <input
            className="field-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">
            Date of birth
            <RequiredMark />
          </label>
          <input
            className="field-control"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">
            Mobile
            <RequiredMark />
          </label>
          <input
            className="field-control"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="tel"
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">
            Licence number
            <RequiredMark />
          </label>
          <input
            className="field-control"
            value={licenceNumber}
            onChange={(e) => setLicenceNumber(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">
            Aadhar number
            <RequiredMark />
          </label>
          <input
            className="field-control"
            value={aadharNumber}
            onChange={(e) => setAadharNumber(e.target.value)}
            inputMode="numeric"
            maxLength={12}
            required
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
        <label className="field-label">
          Gender
          <RequiredMark />
        </label>
        <div className="chip-row" aria-required="true">
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
        <label className="field-label">
          Address
          <RequiredMark />
        </label>
        <textarea
          className="field-control"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
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
