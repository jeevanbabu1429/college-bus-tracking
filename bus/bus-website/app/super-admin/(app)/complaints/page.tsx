"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  complaintsApi,
  categoryLabel,
  STATUS_LABELS,
  type ComplaintPage,
  type ComplaintStatus,
} from "../../../../lib/api/complaints";
import { formatDate, ROLE_LABELS, StatusPill, truncate } from "./shared";

type Filter = ComplaintStatus | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: STATUS_LABELS.open },
  { key: "in_progress", label: STATUS_LABELS.in_progress },
  { key: "resolved", label: STATUS_LABELS.resolved },
  { key: "all", label: "All" },
];

export default function SuperAdminComplaintsPage() {
  // Open first — it is the only tab with anything to do on it.
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ComplaintPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The spinner is armed by whichever control changed the query, not here:
  // clearing state synchronously inside an effect is what react-hooks/
  // set-state-in-effect exists to stop.
  useEffect(() => {
    let cancelled = false;
    complaintsApi
      .list({ status: filter === "all" ? undefined : filter, page })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Complaints</h1>
          <p className="page-subtitle">
            Problems reported from inside the mobile app, by students, drivers
            and college admins.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="access-tabs" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`access-tab${filter === f.key ? " chip-active" : ""}`}
            onClick={() => {
              if (filter === f.key) return;
              setData(null);
              setError(null);
              setFilter(f.key);
              setPage(1);
            }}
          >
            {f.label}
            {data && f.key !== "all" && (
              <span className="access-tab-count">{data.counts[f.key] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {data === null && !error ? (
        <div className="center" style={{ padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : data && data.complaints.length === 0 ? (
        <div className="card">
          <p className="muted small">
            {filter === "open"
              ? "Nothing open. Every reported problem has been picked up."
              : "No complaints here."}
          </p>
        </div>
      ) : (
        data && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Reported</th>
                  <th>From</th>
                  <th>About</th>
                  <th>Problem</th>
                  <th>App</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.complaints.map((c) => (
                  <tr key={c._id}>
                    <td className="muted small" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(c.createdAt)}
                    </td>
                    <td>
                      <strong>{c.reporter.name || "Unknown"}</strong>
                      <div className="muted small">
                        {ROLE_LABELS[c.reporter.role] ?? c.reporter.role}
                        {c.reporter.mobile ? ` · ${c.reporter.mobile}` : ""}
                      </div>
                    </td>
                    <td className="small">{categoryLabel(c.category)}</td>
                    <td className="small" style={{ maxWidth: 360 }}>
                      {truncate(c.message, 110)}
                      {c.hasScreenshot && (
                        <span className="pill pill-plain" style={{ marginLeft: 6 }}>
                          Screenshot
                        </span>
                      )}
                    </td>
                    <td className="muted small" style={{ whiteSpace: "nowrap" }}>
                      {c.diagnostics.appVersion || "—"}
                      <div>{c.diagnostics.platform || ""}</div>
                    </td>
                    <td>
                      <StatusPill status={c.status} />
                      {c.replies.length > 0 && (
                        <div className="muted small">
                          {c.replies.length}{" "}
                          {c.replies.length === 1 ? "reply" : "replies"}
                        </div>
                      )}
                    </td>
                    <td className="table-actions">
                      <Link
                        className="link-action"
                        href={`/super-admin/complaints/${c._id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {data && totalPages > 1 && (
        <div className="flex-row" style={{ gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => {
              setData(null);
              setPage((p) => p - 1);
            }}
          >
            Previous
          </button>
          <span className="muted small">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => {
              setData(null);
              setPage((p) => p + 1);
            }}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
