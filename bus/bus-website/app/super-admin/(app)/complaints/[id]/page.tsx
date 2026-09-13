"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  categoryLabel,
  complaintsApi,
  COMPLAINT_STATUSES,
  STATUS_LABELS,
  type ComplaintDetail,
  type ComplaintStatus,
} from "../../../../../lib/api/complaints";
import { formatDate, ROLE_LABELS, StatusPill } from "../shared";

export default function SuperAdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    complaintsApi
      .get(id)
      .then(setComplaint)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(t);
  }, [success]);

  async function onStatus(status: ComplaintStatus) {
    if (!complaint || complaint.status === status) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await complaintsApi.setStatus(id, status);
      // The status endpoint returns the list shape, which carries no
      // screenshot — keep the bytes we already have rather than dropping them.
      setComplaint({ ...complaint, ...updated, screenshot: complaint.screenshot });
      setSuccess(
        status === "resolved"
          ? "Marked resolved. The reporter has been notified."
          : `Moved to ${STATUS_LABELS[status].toLowerCase()}.`
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReply() {
    if (!complaint || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await complaintsApi.reply(id, reply.trim());
      setComplaint({ ...complaint, ...updated, screenshot: complaint.screenshot });
      setReply("");
      setSuccess("Reply sent. It is now visible in their app.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await complaintsApi.remove(id);
      router.push("/super-admin/complaints");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (error && !complaint) {
    return (
      <>
        <BackLink />
        <div className="alert alert-error">{error}</div>
      </>
    );
  }

  if (!complaint) {
    return (
      <div className="center" style={{ padding: 60 }}>
        <span className="spinner" />
      </div>
    );
  }

  const d = complaint.diagnostics;

  return (
    <>
      <BackLink />

      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">{categoryLabel(complaint.category)}</h1>
          <p className="page-subtitle">
            Reported {formatDate(complaint.createdAt)} by{" "}
            {complaint.reporter.name || "an unknown account"} (
            {ROLE_LABELS[complaint.reporter.role] ?? complaint.reporter.role})
          </p>
        </div>
        <div className="page-actions">
          <StatusPill status={complaint.status} />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">What they reported</h2>
        </div>
        <div className="card-body">
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{complaint.message}</p>
          {complaint.screenshot && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={complaint.screenshot}
              alt="Screenshot attached by the reporter"
              style={{
                marginTop: 16,
                maxWidth: 320,
                width: "100%",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Where it happened</h2>
        </div>
        <div className="card-body">
          <dl className="form-grid" style={{ margin: 0 }}>
            <Fact label="Reporter" value={complaint.reporter.name || "—"} />
            <Fact
              label="Role"
              value={ROLE_LABELS[complaint.reporter.role] ?? complaint.reporter.role}
            />
            <Fact label="Mobile" value={complaint.reporter.mobile || "—"} />
            <Fact label="App version" value={d.appVersion || "—"} />
            <Fact label="Build" value={d.buildNumber || "—"} />
            <Fact
              label="Platform"
              value={[d.platform, d.osVersion].filter(Boolean).join(" ") || "—"}
            />
            <Fact label="Device" value={d.deviceModel || "—"} />
          </dl>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Status</h2>
        </div>
        <div className="card-body">
          <div className="chip-row">
            {COMPLAINT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => onStatus(s)}
                className={`chip${complaint.status === s ? " chip-active" : ""}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            Moving this to resolved sends the reporter a notification. Moving it
            back and forth does not send another.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="card-title">
            Replies{complaint.replies.length > 0 && ` (${complaint.replies.length})`}
          </h2>
        </div>
        <div className="card-body">
          {complaint.replies.length === 0 ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              Nothing sent yet. A reply shows up in their app and pushes a
              notification to their phone.
            </p>
          ) : (
            <div className="formstack" style={{ marginBottom: 16 }}>
              {complaint.replies.map((r, i) => (
                <div
                  key={`${r.at}-${i}`}
                  style={{
                    background: "var(--surface-2, #f7f7f7)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.body}</p>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {formatDate(r.at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="reply">
              Write a reply
            </label>
            <textarea
              id="reply"
              className="field-control"
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="What you found, what you changed, or what you need from them."
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !reply.trim()}
            onClick={onReply}
          >
            Send reply
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 className="card-title">Delete</h2>
        </div>
        <div className="card-body">
          <p className="muted small" style={{ marginTop: 0 }}>
            Screenshots are stored with the complaint, so clearing out old
            resolved ones is worth doing. This cannot be undone.
          </p>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete this complaint
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Delete this complaint?</h2>
            <p className="modal-text">
              The report, its screenshot and every reply go for good. The person
              who sent it will no longer see it in their app.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={onDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link className="link-action" href="/super-admin/complaints">
      &larr; All complaints
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
