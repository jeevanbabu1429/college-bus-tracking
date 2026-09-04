# Manual dev deploy — bus-website

The website half of the pair. Same shape as `bus/api/deploy/deploy.sh`
(preflight → build → package → scp → PM2 → health check), same server, same
"no domain, no TLS" dev posture — a different port and a Next.js app instead of
an Express one.

| | |
|---|---|
| Base URL | `http://89.116.134.28:3040` |
| Server | `89.116.134.28` (shared — also runs the API and other projects) |
| Remote dir | `/opt/bus-website-dev` |
| PM2 process | `bus-website-dev` |
| Talks to | the API at `http://89.116.134.28:3030` |
| `NODE_ENV` | `production` |

> **`NODE_ENV=production` here does not mean the stack is production.**
> Next.js simply refuses to serve a built app in any other mode, and the
> website holds no secrets of its own. The API is still deployed with
> `NODE_ENV=development`, which pins every OTP to `0000` — see
> `bus/api/deploy/README.md`. **Anyone who can reach the login page can sign in
> as any user, including an admin.** Restrict both ports — see
> [Firewall](#firewall).

---

## Ports on this box

| Port | Process | What |
|---|---|---|
| 3030 | `bus-api-dev` | Express API |
| 3040 | `bus-website-dev` | this Next.js site |

Both must be open in the firewall. The site is rendered in the visitor's
browser and calls the API **from there**, so a user who can load the site but
not reach 3030 sees a site where every page fails to load data.

---

## This is a shared server

Same two rules as the API deploy:

- **Only** `/opt/bus-website-dev` and the PM2 process `bus-website-dev` are
  touched. `bus-api-dev` is never restarted, and `pm2 save` preserves the whole
  list.
- **The system Node is never modified.** The app gets the same nvm-managed Node
  the API uses, pinned by an explicit `interpreter` path in
  `ecosystem.config.cjs`.

If you already deployed the API, the server needs no further setup — Node 22 is
installed and PM2 is running. Otherwise follow *One-time server setup* in
`bus/api/deploy/README.md` first.

### Firewall

```bash
sudo ufw allow from <your.ip> to any port 3040 proto tcp
```

Open to everyone only if you accept that anyone can log in as anyone, because
the API is in dev mode:

```bash
sudo ufw allow 3040/tcp
```

Most VPS providers run a **second** firewall in their control panel — open 3040
there too, or the site will be healthy on the box and unreachable from outside.

---

## One-time local setup

From `college-bus-tracking/bus/bus-website`:

```bash
cp deploy/.env.production.example deploy/.env.production
```

`NEXT_PUBLIC_API_URL` is pre-filled. The seven Firebase values are optional —
leave them blank and web push stays off (`lib/firebase/config.ts` reports the
app as unconfigured and nothing breaks).

SSH key auth, if you haven't already done it for the API:

```bash
ssh-copy-id root@89.116.134.28
```

### The one thing that differs from the API deploy

**Every variable in that file is baked into the build, not read at runtime.**
They are all `NEXT_PUBLIC_*`, which Next substitutes as literal strings during
`next build`.

- Changing a value needs a **full redeploy**. `pm2 restart bus-website-dev`
  keeps serving the old value, and editing `.env` on the server does nothing.
- None of them may be a secret — they ship to every browser.

`deploy.sh` exports the file into the build environment rather than letting
Next discover it. Shell variables beat every `.env` file in Next's precedence
order, so a stale `.env.local` in your working tree can't leak into a deploy:
what ships always matches `deploy/.env.production`.

---

## Deploying

```bash
cd college-bus-tracking/bus/bus-website
./deploy/deploy.sh
```

Escape hatches:

```bash
SKIP_LINT=1 ./deploy/deploy.sh       # skip eslint entirely
LINT_STRICT=1 ./deploy/deploy.sh     # make lint errors abort the deploy
WEB_PORT=3041 ./deploy/deploy.sh     # different port
VPS_USER=deploy ./deploy/deploy.sh   # non-root deploy user
SSH_KEY=~/.ssh/vps_key ./deploy/deploy.sh
```

Every config value at the top of `deploy.sh` can be overridden the same way.

### What it does

1. **Preflight** — local tooling and Node ≥ 20; `deploy/.env.production` exists
   with a non-blank, non-placeholder `NEXT_PUBLIC_API_URL`; **that URL is not
   loopback** (see below); the API answers `/health`, warning if not; SSH works;
   **port 3040 is free** (or already ours); and a Node ≥ 20 exists on the VPS.
   All before building, so a misconfiguration costs seconds.
2. **`npm ci`** → load the build env → **`npm run lint`** → **`next build`**.
   Lint is **advisory**: the app carries 39 pre-existing eslint errors (mostly
   `react-hooks/set-state-in-effect`), so blocking on a clean lint would mean
   no deploy ever runs. `next build` typechecks the whole app and *is* a hard
   gate. Use `LINT_STRICT=1` once those are cleaned up.
3. **Package** `.next/standalone/`, `.next/static/`, `public/`, and a generated
   `ecosystem.config.cjs` into `bus-website-dev.tar.gz` (~14 MB).
4. **`scp`** to `/opt/bus-website-dev/`.
5. **On the VPS** — put the nvm Node first on `PATH`, wipe the old deploy,
   extract, assert the tarball really is a standalone build, `pm2 delete` +
   `pm2 start` + `pm2 save`, then poll `/api/health` for 20s. On failure it
   exits non-zero and dumps the last 40 log lines.
6. **Verify from outside** — curls `http://89.116.134.28:3040/api/health` from
   your machine, so a firewall drop is reported rather than left to discover.

### Why there is no `npm ci` on the server

`next.config.ts` sets `output: "standalone"`, so `next build` emits
`.next/standalone/` containing `server.js` plus only the traced `node_modules`
the app actually reaches. The tarball is self-contained: 14 MB uploaded, no
dependency install on a shared box, no network needed at deploy time. The API
deploy still does `npm ci --omit=dev` remotely because Express has no
equivalent.

Next deliberately leaves two things **out** of `standalone/`, and the server
404s without them, so `deploy.sh` copies them in by hand:

- `.next/static` — the hashed JS/CSS chunks every page requests;
- `public/` — images, favicons, `firebase-messaging-sw.js`.

---

## Operating it

```bash
curl http://89.116.134.28:3040/api/health     # → {"status":"ok"}
ssh root@89.116.134.28 'pm2 status'
ssh root@89.116.134.28 'pm2 logs bus-website-dev'
ssh root@89.116.134.28 'pm2 restart bus-website-dev'
```

### Notes

- **`HOSTNAME=0.0.0.0` in `ecosystem.config.cjs` is load-bearing.** Next's
  standalone server binds `localhost` by default, which passes the on-box
  health check and is unreachable from the internet — the most confusing way
  this can fail.
- `ecosystem.config.cjs` keeps the `.cjs` extension for the same reason the
  API's does: it stays correct no matter what `"type"` ends up in
  `package.json`.
- The `interpreter` line pins the app to the nvm Node. If you ever
  `nvm install` a different version, re-run `deploy.sh` so the path is
  regenerated — the old one would be stale.
- `app/api/health/route.ts` exists only for these checks. It is
  `force-dynamic`, so a cached static response can't make a dead server look
  healthy.
- Step 5 deletes everything in `/opt/bus-website-dev` except the tarball. Don't
  keep uploads there; PM2 logs live in `~/.pm2/logs`.
- The API must be deployed and reachable for the site to be useful. Preflight
  warns rather than blocks, so you can deploy the two in either order.
- Going to a real production setup means, for both apps: a domain + TLS
  (the site on 443, the API behind the same proxy), `NODE_ENV=production` on
  the API — which restores random OTPs and therefore **needs an SMS provider
  wired up first** — and a separate Atlas database.
