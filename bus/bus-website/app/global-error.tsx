"use client";

import { useEffect } from "react";

// Last resort, for a crash in the root layout itself. It replaces the layout,
// so globals.css is not loaded — the styles are inline and self-contained.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
          background: "#f5efe2",
          color: "#1a1d29",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <title>Something went wrong · Busszo</title>
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#ffffff",
            border: "1px solid #ece6d6",
            borderRadius: 18,
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: "0 12px 32px rgb(15 23 42 / 6%)",
          }}
        >
          <h1 style={{ fontSize: 21, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#6b7280", margin: 0 }}>
            Busszo ran into a problem loading. Please try again, or reload the
            page in a few minutes.
          </p>
          <div style={{ marginTop: 26, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                font: "inherit",
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: 10,
                border: 0,
                background: "#ff8a5b",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                font: "inherit",
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid #d8d0bd",
                background: "#ffffff",
                color: "#1a1d29",
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
