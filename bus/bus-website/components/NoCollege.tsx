"use client";

import Link from "next/link";

export function NoCollege({
  message = "Add a college before managing its buses, drivers and students.",
}: {
  message?: string;
}) {
  return (
    <div className="empty-state">
      <h3>No college selected</h3>
      <p>{message}</p>
      <Link href="/colleges/new" className="btn btn-primary">
        + Add college
      </Link>
    </div>
  );
}
