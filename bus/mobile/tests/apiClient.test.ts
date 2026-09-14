import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiFetch,
  ApiError,
  setOnSuspended,
  setOnUnauthorized,
} from "../src/api/client";
import { setCurrentToken } from "../src/auth/tokenStore";
import { loginRolesApi } from "../src/api/loginRoles";

// What the mobile app shows when a request fails. Screens put
// `(e as Error).message` straight into their error text or alert, so the
// message apiFetch throws IS what a student, driver or admin reads.
//
// Run: ../api/node_modules/.bin/tsx --test tests/*.test.ts
// Test names carry the case IDs used in docs/Test-Report.docx.

const RAW = /network request failed|typeerror|syntaxerror|json|unexpected|bad gateway|internal server error|cast to|E11000|^\s*$/i;

function assertFriendly(err: unknown) {
  assert.ok(err instanceof Error, "did not throw an Error");
  const msg = (err as Error).message;
  assert.ok(msg.trim().length > 0, "empty error message");
  assert.doesNotMatch(msg, RAW, `raw message shown in the app: "${msg}"`);
}

async function thrown(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  assert.fail("expected the request to fail");
}

const realFetch = globalThis.fetch;
function stubFetch(fn: () => Promise<Response>) {
  globalThis.fetch = (() => fn()) as typeof fetch;
}

describe("mobile apiFetch", () => {
  beforeEach(() => {
    setCurrentToken(null);
    setOnSuspended(null);
    setOnUnauthorized(null);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("MOB-01 server's own error message reaches the screen unchanged", async () => {
    stubFetch(async () =>
      Response.json({ error: "Trip is not active" }, { status: 400 })
    );
    const err = await thrown(apiFetch("/api/x"));
    assert.ok(err instanceof ApiError);
    assert.equal(err.message, "Trip is not active");
  });

  it("MOB-02 no internet / server down shows a friendly message", async () => {
    stubFetch(async () => {
      throw new TypeError("Network request failed");
    });
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("MOB-03 proxy error page (502 HTML) shows a friendly message", async () => {
    stubFetch(
      async () =>
        new Response("<html>502 Bad Gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
        })
    );
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("MOB-04 error with no body and no status text (common on phones) still shows a message", async () => {
    stubFetch(async () => new Response(null, { status: 500, statusText: "" }));
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("MOB-05 success reply that is not JSON (captive Wi-Fi page) shows a friendly message", async () => {
    stubFetch(async () => new Response("<html>Login to Wi-Fi</html>", { status: 200 }));
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("MOB-06 server crash message (500 with technical text) is not shown as-is", async () => {
    stubFetch(async () =>
      Response.json(
        { error: 'Student validation failed: dob: Cast to date failed for value "x"' },
        { status: 500 }
      )
    );
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("MOB-07 expired session signs the user out with a clear message", async () => {
    setCurrentToken("old-token");
    let told = "";
    setOnUnauthorized((m) => (told = m));
    stubFetch(async () =>
      Response.json({ error: "Invalid or expired token" }, { status: 401 })
    );
    await thrown(apiFetch("/api/x"));
    assert.match(told, /session has expired/i);
  });

  it("MOB-08 suspended account is signed out and told why", async () => {
    setCurrentToken("token");
    let told = "";
    setOnSuspended((m) => (told = m));
    stubFetch(async () =>
      Response.json(
        { error: "Your college has been suspended", suspended: true },
        { status: 403 }
      )
    );
    await thrown(apiFetch("/api/x"));
    assert.equal(told, "Your college has been suspended");
  });

  it("MOB-09 sign-in screen still offers every role when the server is unreachable", async () => {
    stubFetch(async () => {
      throw new TypeError("Network request failed");
    });
    assert.deepEqual(await loginRolesApi.get(), {
      student: true,
      driver: true,
      admin: true,
    });
  });
});

describe("mobile time wording", () => {
  const now = Date.parse("2026-09-14T10:30:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("MOB-10 'updated … ago' reads naturally, never as raw seconds", async () => {
    const { timeAgo } = await import("../src/lib/time");
    assert.equal(timeAgo(ago(2_000), now), "just now");
    assert.equal(timeAgo(ago(40_000), now), "40s ago");
    assert.equal(timeAgo(ago(30 * 60_000), now), "30 min ago");
    assert.equal(timeAgo(ago(3 * 3600_000), now), "3 h ago");
  });

  it("MOB-11 a bus position older than 2 minutes is no longer shown as live", async () => {
    const { isStale } = await import("../src/lib/time");
    assert.equal(isStale(ago(30_000), now), false);
    assert.equal(isStale(ago(5 * 60_000), now), true);
  });
});
