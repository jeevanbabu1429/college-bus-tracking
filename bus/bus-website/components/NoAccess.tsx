"use client";

import Link from "next/link";
import { IconShield } from "./icons";

/**
 * Shown when someone opens a console page their role does not cover.
 *
 * Says which module is missing and who can change it, because the useful next
 * step is a conversation with their admin, not another click.
 */
export function NoAccess({
  module,
  roleName,
}: {
  module: string | null | undefined;
  roleName: string | null;
}) {
  return (
    <div className="empty-state" style={{ maxWidth: 460, margin: "40px auto" }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          width: 46,
          height: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-muted)",
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        <IconShield size={22} />
      </span>
      <h3>You don&rsquo;t have access to this page</h3>
      <p>
        {module === null ? (
          <>Only the college owner can open this.</>
        ) : (
          <>
            Your role{roleName ? ` (${roleName})` : ""} doesn&rsquo;t include
            the <strong>{module}</strong> module. Your college admin can change
            that under Roles &amp; access.
          </>
        )}
      </p>
      <Link href="/profile" className="btn btn-secondary">
        See what you can reach
      </Link>
    </div>
  );
}
