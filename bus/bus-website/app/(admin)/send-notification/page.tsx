"use client";

import { useCallback, useEffect, useState } from "react";
import { useColleges } from "../../../lib/college/CollegeContext";
import {
  collegeNotificationsApi,
  BODY_MAX,
  TITLE_MAX,
  type AudienceChoice,
  type AudienceInfo,
  type SendResult,
} from "../../../lib/api/collegeNotifications";
import { NoCollege } from "../../../components/NoCollege";
import { IconBell, IconBadge, IconSend, IconUsers } from "../../../components/icons";

const CHOICES: { value: AudienceChoice; label: string }[] = [
  { value: "students", label: "Students only" },
  { value: "drivers", label: "Drivers only" },
  { value: "both", label: "Students and drivers" },
];

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

export default function SendNotificationPage() {
  const { selected } = useColleges();
  const [info, setInfo] = useState<AudienceInfo | null>(null);
  const [choice, setChoice] = useState<AudienceChoice>("both");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const load = useCallback(async () => {
    if (!selected) return;
    setError(null);
    try {
      setInfo(await collegeNotificationsApi.audience(selected._id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selected]);

  useEffect(() => {
    setInfo(null);
    load();
  }, [load]);

  if (!selected) return <NoCollege />;

  const students = info?.students ?? { total: 0, withDevice: 0 };
  const drivers = info?.drivers ?? { total: 0, withDevice: 0 };

  // Only devices count. Someone who has never opened the app has nowhere to
  // receive this, and promising the admin a bigger number than that would be
  // a lie they'd only discover afterwards.
  const reach =
    (choice === "drivers" ? 0 : students.withDevice) +
    (choice === "students" ? 0 : drivers.withDevice);
  const missing =
    (choice === "drivers" ? 0 : students.total - students.withDevice) +
    (choice === "students" ? 0 : drivers.total - drivers.withDevice);

  const ready =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    title.length <= TITLE_MAX &&
    body.length <= BODY_MAX &&
    reach > 0 &&
    info?.pushConfigured === true;

  async function send() {
    if (!selected || !ready) return;
    setConfirming(false);
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await collegeNotificationsApi.send(selected._id, {
        title: title.trim(),
        body: body.trim(),
        audience: choice,
      });
      setResult(res);
      // Cleared so a second click can't repeat a blast that already went out.
      setTitle("");
      setBody("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function countFor(value: AudienceChoice): string {
    if (!info) return "Loading…";
    if (value === "students") {
      return `${students.withDevice} of ${students.total} reachable`;
    }
    if (value === "drivers") {
      return `${drivers.withDevice} of ${drivers.total} reachable`;
    }
    return `${students.withDevice + drivers.withDevice} of ${
      students.total + drivers.total
    } reachable`;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Send notification</h1>
          <p className="page-subtitle">
            Push an announcement to the phones of everyone at {selected.name}.
          </p>
        </div>
      </div>

      {info && !info.pushConfigured && (
        <div className="alert alert-warning">
          <strong>Push is not switched on for this server.</strong> Nothing can
          be sent until the Firebase credentials are configured on the API.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="alert alert-success">
          <strong>Sent.</strong> Delivered to {result.devices}{" "}
          {result.devices === 1 ? "device" : "devices"} —{" "}
          {result.sentTo.students.withDevice} student
          {result.sentTo.students.withDevice === 1 ? "" : "s"} and{" "}
          {result.sentTo.drivers.withDevice} driver
          {result.sentTo.drivers.withDevice === 1 ? "" : "s"}. One person can
          have more than one device.
        </div>
      )}

      <div className="formstack">
        <section className="formsection">
          <div className="formsection-head">
            <span className="formsection-icon" aria-hidden>
              <IconUsers size={17} />
            </span>
            <div className="formsection-titles">
              <h2 className="formsection-title">Who gets this</h2>
              <span className="formsection-hint">
                Only people who have signed in on a phone can be reached — the
                rest have no device registered yet.
              </span>
            </div>
          </div>

          <div className="audience-grid" role="radiogroup" aria-label="Audience">
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={choice === c.value}
                data-active={choice === c.value}
                className="audience-card"
                onClick={() => setChoice(c.value)}
              >
                <span className="audience-card-head">
                  {c.value === "drivers" ? (
                    <IconBadge size={15} />
                  ) : (
                    <IconUsers size={15} />
                  )}
                  <span className="audience-card-label">{c.label}</span>
                </span>
                <span className="audience-card-meta">{countFor(c.value)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="formsection">
          <div className="formsection-head">
            <span className="formsection-icon" aria-hidden>
              <IconBell size={17} />
            </span>
            <div className="formsection-titles">
              <h2 className="formsection-title">Message</h2>
              <span className="formsection-hint">
                This arrives as a phone notification, so keep it short — long
                text is cut off by the operating system.
              </span>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label className="field-label" htmlFor="notif-title">
              Title
            </label>
            <input
              id="notif-title"
              className="field-control"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Holiday tomorrow"
            />
            <span className="field-help">
              {title.length}/{TITLE_MAX}
            </span>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="notif-body">
              Message
            </label>
            <textarea
              id="notif-body"
              className="field-control"
              rows={3}
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="No buses will run tomorrow. Regular service resumes on Monday."
            />
            <span className="field-help">
              {body.length}/{BODY_MAX}
            </span>
          </div>

          {/* What it will actually look like on a phone. Worth the few lines:
              the admin is about to interrupt several hundred people. */}
          <div className="notif-preview" aria-label="Preview">
            <span className="notif-preview-icon" aria-hidden>
              <IconBell size={17} />
            </span>
            <span className="notif-preview-body">
              <span className="notif-preview-app">Bus · now</span>
              <span className="notif-preview-title">
                {title.trim() || "Your title appears here"}
              </span>
              <span className="notif-preview-text">
                {body.trim() || "And the message underneath it."}
              </span>
            </span>
          </div>
        </section>

        <div className="formbar">
          <span className="formbar-note">
            {info === null ? (
              "Checking who can be reached…"
            ) : reach === 0 ? (
              <>Nobody in this group has the app installed yet.</>
            ) : (
              <>
                Goes to <strong>{people(reach)}</strong>
                {missing > 0 && ` · ${missing} without the app won't get it`}
              </>
            )}
          </span>
          <div className="formbar-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!ready || sending}
              onClick={() => setConfirming(true)}
            >
              {sending ? (
                <span className="spinner spinner-light" />
              ) : (
                <>
                  <IconSend size={14} /> Send notification
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmed rather than sent on the first click: it goes out to real
          phones instantly and there is no way to take it back. */}
      {confirming && (
        <div
          className="modal-overlay"
          onClick={() => setConfirming(false)}
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <h2 className="modal-title">Send to {people(reach)}?</h2>
            <p className="modal-text">
              This buzzes their phones straight away and cannot be taken back.
            </p>
            <div className="notif-preview" style={{ marginTop: 14 }}>
              <span className="notif-preview-icon" aria-hidden>
                <IconBell size={17} />
              </span>
              <span className="notif-preview-body">
                <span className="notif-preview-app">Bus · now</span>
                <span className="notif-preview-title">{title.trim()}</span>
                <span className="notif-preview-text">{body.trim()}</span>
              </span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={send}>
                <IconSend size={14} /> Send now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
