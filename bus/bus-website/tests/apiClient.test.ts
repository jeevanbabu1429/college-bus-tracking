import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiFetch,
  ApiError,
  EXPIRED_MESSAGE_KEY,
  SUSPENDED_MESSAGE_KEY,
} from "../lib/api/client";
import { setCurrentToken } from "../lib/auth/tokenStore";

// What the web console shows when a request fails. Every page renders
// `(err as Error).message` straight into its error box, so the message that
// apiFetch throws IS the text an admin reads.
//
// Run: ../api/node_modules/.bin/tsx --test tests/*.test.ts
// Test names carry the case IDs used in docs/Test-Report.docx.

const RAW = /failed to fetch|network|typeerror|syntaxerror|json|unexpected|bad gateway|internal server error|cast to|E11000|^\s*$/i;

function assertFriendly(err: unknown) {
  assert.ok(err instanceof Error, "did not throw an Error");
  const msg = (err as Error).message;
  assert.ok(msg.trim().length > 0, "empty error message");
  assert.doesNotMatch(msg, RAW, `raw message shown to the admin: "${msg}"`);
}

async function thrown(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  assert.fail("expected the request to fail");
}

type Stub = () => Promise<Response>;
const realFetch = globalThis.fetch;
function stubFetch(fn: Stub) {
  globalThis.fetch = (() => fn()) as typeof fetch;
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("web apiFetch", () => {
  let session: MemoryStorage;
  let local: MemoryStorage;
  let location: { href: string };

  beforeEach(() => {
    session = new MemoryStorage();
    local = new MemoryStorage();
    location = { href: "/buses" };
    Object.assign(globalThis, {
      window: { localStorage: local, location },
      sessionStorage: session,
    });
    setCurrentToken(null);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it("WEB-01 server's own error message reaches the page unchanged", async () => {
    stubFetch(async () =>
      Response.json({ error: "Bus is full (40 seats)" }, { status: 409 })
    );
    const err = await thrown(apiFetch("/api/x"));
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 409);
    assert.equal(err.message, "Bus is full (40 seats)");
  });

  it("WEB-02 API unreachable (offline / server down) shows a friendly message", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("WEB-03 proxy error page (502 HTML) shows a friendly message", async () => {
    stubFetch(
      async () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "Content-Type": "text/html" },
        })
    );
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("WEB-04 error with no body and no status text still shows a message", async () => {
    stubFetch(async () => new Response(null, { status: 500, statusText: "" }));
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("WEB-05 success reply that is not JSON shows a friendly message", async () => {
    stubFetch(
      async () =>
        new Response("<html>maintenance</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
    );
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("WEB-06 server crash message (500 with technical text) is not shown as-is", async () => {
    stubFetch(async () =>
      Response.json(
        { error: 'Cast to ObjectId failed for value "abc" at path "_id"' },
        { status: 500 }
      )
    );
    assertFriendly(await thrown(apiFetch("/api/x")));
  });

  it("WEB-07 204 No Content resolves without an error", async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    assert.equal(await apiFetch("/api/x"), undefined);
  });

  it("WEB-08 expired session signs the admin out with a clear message", async () => {
    setCurrentToken("old-token");
    local.setItem("bus.authToken", "old-token");
    stubFetch(async () =>
      Response.json({ error: "Invalid or expired token" }, { status: 401 })
    );
    await thrown(apiFetch("/api/x"));
    assert.equal(location.href, "/login");
    assert.equal(local.getItem("bus.authToken"), null);
    assert.match(session.getItem(EXPIRED_MESSAGE_KEY) ?? "", /session has expired/i);
  });

  it("WEB-09 suspended account is signed out and told why", async () => {
    setCurrentToken("token");
    stubFetch(async () =>
      Response.json(
        { error: "Your account has been suspended", suspended: true },
        { status: 403 }
      )
    );
    await thrown(apiFetch("/api/x"));
    assert.equal(location.href, "/login");
    assert.equal(session.getItem(SUSPENDED_MESSAGE_KEY), "Your account has been suspended");
  });
});
