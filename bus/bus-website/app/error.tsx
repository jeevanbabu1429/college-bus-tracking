"use client";

import { useEffect } from "react";

// Shown in place of any page that crashes while rendering. Without it Next.js
// falls back to "Application error: a client-side exception has occurred".
// The error itself is never displayed — it goes to the console for us.
export default function ErrorPage({
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
    <div className="pending-page">
      <div className="pending-card" role="alert">
        <div className="pending-icon" aria-hidden>
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3 2.5 20h19z" />
            <path d="M12 10v4M12 17v.5" />
          </svg>
        </div>
        <h1 className="pending-title">Something went wrong</h1>
        <p className="pending-text">
          This page ran into a problem. Try again, and if it keeps happening,
          reload the page or come back in a few minutes.
        </p>
        <div className="pending-signout">
          <button type="button" className="btn btn-primary" onClick={() => unstable_retry()}>
            Try again
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
