"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Gender } from "../../lib/api/auth";
import { useAuth } from "../../lib/auth/AuthContext";
import { RequiredLegend, RequiredMark } from "../../components/RequiredMark";
import { SupportContact } from "../../components/SupportContact";

const GENDERS: Gender[] = ["male", "female", "other"];

const NAME_MIN = 2;
const NAME_MAX = 60;
const MOBILE_LENGTH = 10;
const EMAIL_MAX = 254;
const MIN_AGE = 18;
const MAX_AGE = 100;

// Pragmatic address check: something@something.tld, no spaces, no empty labels.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

type Field = "name" | "gender" | "dob" | "mobile" | "email";

type Values = {
  name: string;
  gender: Gender | null;
  dob: string;
  mobile: string;
  email: string;
};

type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: "", gender: null, dob: "", mobile: "", email: "" };

// Keep only the characters real names use, so bad input never reaches state.
function sanitiseName(value: string): string {
  return value
    .replace(/[^\p{L}\s'.-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, NAME_MAX);
}

function sanitiseMobile(value: string): string {
  return value.replace(/\D/g, "").slice(0, MOBILE_LENGTH);
}

function sanitiseEmail(value: string): string {
  return value.replace(/\s/g, "").slice(0, EMAIL_MAX);
}

function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// `new Date("2026-02-30")` silently rolls over into March, so rebuild the date
// and check every part survived the round trip.
function parseDob(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function ageOn(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function validate(v: Values): Errors {
  const errors: Errors = {};

  const name = v.name.trim();
  if (!name) errors.name = "Name is required";
  else if (name.length < NAME_MIN)
    errors.name = `Name must be at least ${NAME_MIN} characters`;

  if (!v.gender) errors.gender = "Select a gender";

  if (!v.dob) {
    errors.dob = "Date of birth is required";
  } else {
    const dob = parseDob(v.dob);
    if (!dob) {
      errors.dob = "Enter a real date";
    } else {
      const age = ageOn(dob, new Date());
      if (age < 0) errors.dob = "Date of birth can’t be in the future";
      else if (age < MIN_AGE)
        errors.dob = `You must be at least ${MIN_AGE} to register`;
      else if (age > MAX_AGE) errors.dob = "Enter a valid date of birth";
    }
  }

  if (!v.mobile) errors.mobile = "Mobile number is required";
  else if (v.mobile.length !== MOBILE_LENGTH)
    errors.mobile = `Enter a valid ${MOBILE_LENGTH}-digit mobile number`;

  const email = v.email.trim();
  if (!email) errors.email = "Email is required";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address";

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register } = useAuth();

  const errors = useMemo(() => validate(values), [values]);

  // A field's error only surfaces once the user has left it, or once they've
  // tried to submit — so the form isn't red before it has been filled in.
  function errorFor(field: Field): string | undefined {
    return submitted || touched[field] ? errors[field] : undefined;
  }

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function markTouched(field: Field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setSubmitError(null);
    const { gender } = values;
    if (Object.keys(errors).length > 0 || !gender || busy) return;

    setBusy(true);
    try {
      await register({
        name: values.name.trim(),
        gender,
        dob: values.dob,
        mobile: values.mobile,
        email: values.email.trim().toLowerCase(),
      });
      // register() persists the session, so the shell will render the
      // pending-verification dashboard.
      router.replace("/dashboard");
    } catch (err) {
      setSubmitError((err as Error).message);
      setBusy(false);
    }
  }

  const today = new Date();
  const dobMax = isoDay(
    new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate())
  );
  const dobMin = isoDay(
    new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate())
  );

  const showSummary = submitted && Object.keys(errors).length > 0;

  return (
    <div className="auth-page">
      <main className="auth-form-wrap">
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          <div className="auth-brand">
            <span className="auth-brand-mark">B</span>
            <span className="auth-brand-title">Bus Admin</span>
          </div>

          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-subheading" style={{ marginBottom: 20 }}>
            One account governs every college, bus, driver and student you
            manage.
          </p>

          <RequiredLegend />

          <div className="field">
            <label className="field-label" htmlFor="register-name">
              Full name
              <RequiredMark />
            </label>
            <input
              id="register-name"
              className="field-control"
              value={values.name}
              onChange={(e) => set("name", sanitiseName(e.target.value))}
              onBlur={() => markTouched("name")}
              aria-required="true"
              autoComplete="name"
              maxLength={NAME_MAX}
              placeholder="Your name"
              aria-invalid={errorFor("name") ? true : undefined}
              aria-describedby={
                errorFor("name") ? "register-name-error" : undefined
              }
            />
            <FieldError id="register-name-error" message={errorFor("name")} />
          </div>

          <div className="field">
            <label className="field-label">
              Gender
              <RequiredMark />
            </label>
            <div
              className="chip-row"
              data-invalid={errorFor("gender") ? true : undefined}
            >
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    set("gender", g);
                    markTouched("gender");
                  }}
                  className={`chip ${values.gender === g ? "chip-active" : ""}`}
                  aria-pressed={values.gender === g}
                >
                  {g}
                </button>
              ))}
            </div>
            <FieldError
              id="register-gender-error"
              message={errorFor("gender")}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-dob">
              Date of birth
              <RequiredMark />
            </label>
            <input
              id="register-dob"
              className="field-control"
              type="date"
              value={values.dob}
              onChange={(e) => set("dob", e.target.value)}
              onBlur={() => markTouched("dob")}
              aria-required="true"
              min={dobMin}
              max={dobMax}
              aria-invalid={errorFor("dob") ? true : undefined}
              aria-describedby={
                errorFor("dob") ? "register-dob-error" : undefined
              }
            />
            <FieldError id="register-dob-error" message={errorFor("dob")} />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-mobile">
              Mobile number
              <RequiredMark />
            </label>
            <input
              id="register-mobile"
              className="field-control"
              value={values.mobile}
              onChange={(e) => set("mobile", sanitiseMobile(e.target.value))}
              onBlur={() => markTouched("mobile")}
              aria-required="true"
              inputMode="tel"
              autoComplete="tel"
              maxLength={MOBILE_LENGTH}
              placeholder={`Enter your ${MOBILE_LENGTH}-digit mobile`}
              aria-invalid={errorFor("mobile") ? true : undefined}
              aria-describedby={
                errorFor("mobile") ? "register-mobile-error" : undefined
              }
            />
            <FieldError
              id="register-mobile-error"
              message={errorFor("mobile")}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="register-email">
              Email
              <RequiredMark />
            </label>
            <input
              id="register-email"
              className="field-control"
              type="email"
              value={values.email}
              onChange={(e) => set("email", sanitiseEmail(e.target.value))}
              onBlur={() => markTouched("email")}
              aria-required="true"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              placeholder="you@company.com"
              aria-invalid={errorFor("email") ? true : undefined}
              aria-describedby={
                errorFor("email") ? "register-email-error" : undefined
              }
            />
            <FieldError id="register-email-error" message={errorFor("email")} />
          </div>

          {showSummary && (
            <div
              className="alert alert-error"
              role="alert"
              style={{ marginTop: 4 }}
            >
              Please fix the highlighted fields before continuing.
            </div>
          )}

          {submitError && (
            <div className="alert alert-error" style={{ marginTop: 18 }}>
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            disabled={busy}
          >
            {busy ? "Creating your account…" : "Create account"}
          </button>

          <p className="small muted text-center" style={{ marginTop: 18 }}>
            Already have an account?{" "}
            <Link href="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </form>
        <SupportContact label="Having trouble registering? Contact support" />
      </main>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="field-error" role="alert">
      {message}
    </span>
  );
}
