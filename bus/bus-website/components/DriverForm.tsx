"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Driver, DriverInput, Gender } from "../lib/api/collegeDrivers";
import { RequiredMark } from "./RequiredMark";
import { fileToSquareDataUrl } from "../lib/images";
import { IconBadge, IconPhone, IconUpload, IconUsers, IconX } from "./icons";

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

type Field =
  | "name"
  | "dob"
  | "licenceNumber"
  | "aadharNumber"
  | "mobile"
  | "address";

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>(
    {}
  );
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

  // What the action bar reports on an edit. Compared against the record as it
  // was loaded, not against a blank form, so retyping the same value correctly
  // counts as no change.
  const dirty = useMemo(() => {
    if (!initial) return true;
    return (
      name !== initial.name ||
      dob !== isoDate(initial.dob) ||
      gender !== initial.gender ||
      licenceNumber !== initial.licenceNumber ||
      aadharNumber !== initial.aadharNumber ||
      mobile !== initial.mobile ||
      address !== initial.address ||
      image !== (initial.image ?? null)
    );
  }, [
    initial,
    name,
    dob,
    gender,
    licenceNumber,
    aadharNumber,
    mobile,
    address,
    image,
  ]);

  function clearFieldError(field: Field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

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

  // Errors land on the field that caused them rather than in one lump at the
  // bottom, so a long form points straight at the box to fix.
  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!name.trim()) next.name = "Enter a name";
    if (!dob) next.dob = "Pick a date of birth";
    if (!mobile.trim()) next.mobile = "Enter a mobile number";
    if (!licenceNumber.trim()) next.licenceNumber = "Enter the licence number";
    if (!aadharNumber.trim()) {
      next.aadharNumber = "Enter the Aadhar number";
    } else if (!/^\d{12}$/.test(aadharNumber.trim())) {
      next.aadharNumber = "Aadhar must be exactly 12 digits";
    }
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
    <form className="formstack" onSubmit={handleSubmit} noValidate>
      <section className="formsection">
        <div className="formsection-head">
          <span className="formsection-icon" aria-hidden>
            <IconUsers size={17} />
          </span>
          <div className="formsection-titles">
            <h2 className="formsection-title">Driver details</h2>
            <span className="formsection-hint">
              The name and photo students see while tracking the bus.
            </span>
          </div>
        </div>

        <div className="photo-field" style={{ marginBottom: 20 }}>
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
                <IconUpload size={13} />{" "}
                {image ? "Change photo" : "Upload photo"}
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

        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="driver-name">
              Name
              <RequiredMark />
            </label>
            <input
              id="driver-name"
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
            <label className="field-label" htmlFor="driver-dob">
              Date of birth
              <RequiredMark />
            </label>
            <input
              id="driver-dob"
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
              How the college reaches this driver. The mobile number is also the
              one shown on the live tracking card.
            </span>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label className="field-label" htmlFor="driver-mobile">
            Mobile
            <RequiredMark />
          </label>
          <input
            id="driver-mobile"
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
          <label className="field-label" htmlFor="driver-address">
            Address
            <RequiredMark />
          </label>
          <textarea
            id="driver-address"
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
            <IconBadge size={17} />
          </span>
          <div className="formsection-titles">
            <h2 className="formsection-title">Licence &amp; ID</h2>
            <span className="formsection-hint">
              Kept for the college&rsquo;s own records — students never see
              these.
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="driver-licence">
              Licence number
              <RequiredMark />
            </label>
            <input
              id="driver-licence"
              className="field-control"
              value={licenceNumber}
              onChange={(e) => {
                setLicenceNumber(e.target.value);
                clearFieldError("licenceNumber");
              }}
              style={{ textTransform: "uppercase" }}
              aria-invalid={fieldErrors.licenceNumber ? true : undefined}
              aria-required
            />
            {fieldErrors.licenceNumber ? (
              <span className="field-error">{fieldErrors.licenceNumber}</span>
            ) : (
              <span className="field-help">Saved in capitals.</span>
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="driver-aadhar">
              Aadhar number
              <RequiredMark />
            </label>
            <input
              id="driver-aadhar"
              className="field-control"
              value={aadharNumber}
              onChange={(e) => {
                setAadharNumber(e.target.value);
                clearFieldError("aadharNumber");
              }}
              inputMode="numeric"
              maxLength={12}
              aria-invalid={fieldErrors.aadharNumber ? true : undefined}
              aria-required
            />
            {fieldErrors.aadharNumber ? (
              <span className="field-error">{fieldErrors.aadharNumber}</span>
            ) : (
              <span className="field-help">{aadharNumber.length}/12 digits</span>
            )}
          </div>
        </div>
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
