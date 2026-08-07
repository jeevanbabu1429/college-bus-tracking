"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CollegeReport } from "../lib/export/collegeReport";
import { downloadExcel, downloadPdf } from "../lib/export/writers";
import { IconDownload, IconFileSpreadsheet, IconX } from "./icons";

type Format = "excel" | "pdf";

type Props = {
  /** Button text. */
  label?: string;
  /** Dialog heading. */
  title: string;
  /** One line under the heading. */
  description: ReactNode;
  /** Optional bullets spelling out what lands in the file. */
  includes?: string[];
  /** Builds the report. Called on click, not on mount. */
  build: () => Promise<CollegeReport>;
};

export function ExportReportButton({
  label = "Download",
  title,
  description,
  includes,
  build,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function run(format: Format) {
    if (busy) return;
    setBusy(format);
    setError(null);
    try {
      // Fetched on demand rather than with the page — most visits never export.
      const report = await build();
      if (format === "excel") await downloadExcel(report);
      else await downloadPdf(report);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <IconDownload size={14} /> {label}
      </button>

      {open && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <button
              type="button"
              className="tracker-card-close"
              onClick={() => setOpen(false)}
              disabled={busy !== null}
              aria-label="Close"
            >
              <IconX size={14} />
            </button>

            <h2 id="export-title" className="modal-title">
              {title}
            </h2>
            <p className="modal-text" style={{ marginBottom: 14 }}>
              {description}
            </p>

            {includes && includes.length > 0 && (
              <ul className="export-includes">
                {includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginTop: 14 }}>
                {error}
              </div>
            )}

            <div className="export-formats">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => run("excel")}
                disabled={busy !== null}
              >
                {busy === "excel" ? (
                  <span className="spinner spinner-light" />
                ) : (
                  <>
                    <IconFileSpreadsheet size={14} /> Excel (.xlsx)
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => run("pdf")}
                disabled={busy !== null}
              >
                {busy === "pdf" ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <IconDownload size={14} /> PDF (.pdf)
                  </>
                )}
              </button>
            </div>

            <p className="small muted" style={{ marginTop: 12 }}>
              Excel gives one sheet per section. PDF gives one page per section,
              in landscape.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
