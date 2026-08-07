# Manual dev deploy — bus-api

Same shape as `deploy-dev2.yml` (build → package → scp → PM2), but run from your
machine over SSH. No GitHub Actions runner needed.

This is a **dev** deployment: reached directly by IP and port, no domain, no
TLS, no Traefik. The database is MongoDB Atlas.

| | |
|---|---|
| Base URL | `http://89.116.134.28:3030` |
| Server | `89.116.134.28` (shared with other projects) |
| Remote dir | `/opt/bus-api-dev` |
| PM2 process | `bus-api-dev` |
| Database | MongoDB Atlas |
| `NODE_ENV` | `development` |

> **`NODE_ENV=development` makes every OTP `0000`.**
> `src/lib/otp.ts` returns a fixed `"0000"` whenever `NODE_ENV !== "production"`.
> That's the point of a dev box, but on a bare public IP it means anyone who
> finds the port can log in as any user. Restrict the port — see
> [Firewall](#firewall).

---

## This is a shared server

Other projects run on this box, so the deploy is scoped to avoid them:

- **Only** `/opt/bus-api-dev` and the PM2 process `bus-api-dev` are touched.
  Other PM2 apps keep running, and `pm2 save` preserves the whole list.
- **The system Node is never modified.** It's older than this app needs, and
  other projects depend on it. Instead the app gets its own Node via `nvm`, and
  `ecosystem.config.cjs` pins it with an explicit `interpreter` path. The PM2
  daemon itself keeps running under the old Node — that's fine, it only spawns
  processes.

Never run a `apt-get install nodejs` / NodeSource upgrade on this box; it would
replace Node for every project at once.

---

## One-time server setup

Almost everything is already installed. You only need Node 22 **for this app**:

```bash
ssh root@89.116.134.28

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 22

nvm which 22        # should print a path — deploy.sh looks this up itself
```

This installs under `~/.nvm` and leaves the system Node untouched.

`deploy.sh` resolves that path during preflight and fails with instructions if
it can't find a Node ≥ 20, so you'll know immediately if it didn't take.

### Firewall

The app port is exposed directly, so it must be open — but scope it. Because
OTP is `0000` in dev, prefer allowing only the IPs that need it:

```bash
sudo ufw allow from <your.ip> to any port 3030 proto tcp
```

Open to everyone only if you accept that anyone can log in:

```bash
sudo ufw allow 3030/tcp
```

Most VPS providers run a **second** firewall in their control panel — open 3030
there too, or the app will be healthy on the box and unreachable from outside.

### Atlas

Add `89.116.134.28` under **Atlas → Network Access → IP Access List**. Without
it the app starts, fails to connect, and exits — the deploy's health check will
catch this and say so.

---

## One-time local setup

From `college-bus-tracking/bus/api`:

```bash
cp deploy/.env.dev.example deploy/.env.dev
```

Fill in:

- `MONGODB_URI` — from Atlas → Connect → Drivers. URL-encode special characters
  in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`).
- `JWT_SECRET` — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Make sure `firebase-service-account.json` is present in `bus/api/`. Both files
are gitignored and get copied into the tarball at deploy time — this replaces
the `${{ secrets.* }}` injection the workflow did.

Set up SSH key auth so the script isn't prompted for a password:

```bash
ssh-copy-id root@89.116.134.28
```

---

## Deploying

Run from **Git Bash** on Windows (not PowerShell — it's a bash script):

```bash
cd college-bus-tracking/bus/api
./deploy/deploy.sh
```

Escape hatches:

```bash
SKIP_TESTS=1 ./deploy/deploy.sh      # skip the 33-test suite (it downloads a mongo binary)
API_PORT=3031 ./deploy/deploy.sh     # different port
VPS_USER=deploy ./deploy/deploy.sh   # non-root deploy user
SSH_KEY=~/.ssh/vps_key ./deploy/deploy.sh
```

Every config value at the top of `deploy.sh` can be overridden the same way.

### What it does

1. **Preflight** — local tooling and Node ≥ 20; `.env.dev` and the Firebase JSON
   exist, are non-blank, and have no leftover `<placeholder>` text; SSH works;
   **port 3030 is free** (or already ours); and a Node ≥ 20 exists on the VPS.
   All before building, so a misconfiguration costs seconds, not a half-deploy.
   The local-MongoDB check is skipped automatically when `MONGODB_URI` is remote.
2. **`npm ci`** → **`npm test`** → **`npm run build`** (`tsc` → `dist/`).
3. **Package** `dist/`, `package.json`, `package-lock.json`, `.env`,
   `firebase-service-account.json`, and a generated `ecosystem.config.cjs` into
   `bus-api-dev.tar.gz`.
4. **`scp`** to `/opt/bus-api-dev/`.
5. **On the VPS** — put the nvm Node first on `PATH`, wipe the old deploy,
   extract, `npm ci --omit=dev`, `chmod 600` the secrets, `pm2 delete` +
   `pm2 start` + `pm2 save`, then poll `/health` for 20s. **On failure it exits
   non-zero, points at the likely Atlas cause, and dumps the last 40 log lines**
   — the original workflow reported success either way.
6. **Verify from outside** — curls `http://89.116.134.28:3030/health` from your
   machine. Passing locally but failing here means a firewall is blocking the
   port, and the script tells you instead of leaving you to find out.

---

## Operating it

```bash
curl http://89.116.134.28:3030/health          # → {"status":"ok"}
ssh root@89.116.134.28 'pm2 status'
ssh root@89.116.134.28 'pm2 logs bus-api-dev'
ssh root@89.116.134.28 'pm2 restart bus-api-dev'
```

Point the mobile app / website at `http://89.116.134.28:3030`. Note it's plain
HTTP — Android blocks cleartext traffic by default, so the app needs
`usesCleartextTraffic` enabled for this dev build.

### Notes

- **This runs the compiled build**, not `tsx watch`. "Dev" here means the dev
  *environment* (like `dev2` in the original workflow), not a file watcher —
  code arrives as a tarball, so there'd be nothing to watch.
- `ecosystem.config.cjs` **must** keep the `.cjs` extension — `package.json` is
  `"type": "module"`, so PM2 would fail to load a `.js` config using
  `module.exports`.
- The `interpreter` line in that config is what pins the app to the nvm Node. If
  you ever `nvm install` a different version, re-run `deploy.sh` so the path is
  regenerated — the old path would be stale.
- Step 5 deletes everything in `/opt/bus-api-dev` except the tarball, mirroring
  the dev2 workflow. Don't keep uploads there; PM2 logs live in `~/.pm2/logs`.
- `pm2 startup` is presumably already configured on this box for the existing
  projects. If `pm2 list` is empty after a reboot, it isn't — run `pm2 startup`
  once and follow the command it prints.
- `npm ci --omit=dev` on the server skips `mongodb-memory-server`, so no Mongo
  binary gets downloaded on the VPS.
- `src/scripts/migrateStops.ts` is **not** run automatically. Run it by hand if
  you need it — it isn't compiled into `dist/` as an entrypoint the deploy calls.
- Going to production later means: `NODE_ENV=production` (restores random OTP),
  a real domain + TLS, and a separate Atlas database.
