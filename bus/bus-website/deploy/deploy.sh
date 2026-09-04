#!/usr/bin/env bash
#
# Manual deploy for bus-website (Next.js) -> VPS, PM2, no reverse proxy.
#
# Same shape as bus/api/deploy/deploy.sh — preflight, build locally, package,
# scp, PM2, health check — pointed at the Next.js app instead of the Express
# API, and sharing the same server.
#
# Reached directly at http://<VPS_HOST>:<WEB_PORT>. No domain, no TLS, no
# Traefik. It talks to the API at NEXT_PUBLIC_API_URL, also over plain HTTP.
#
# Shared server, so the same two rules as the API deploy hold:
#   * the app runs under its own nvm-managed Node, leaving the system Node
#     (used by other projects) alone;
#   * only /opt/bus-website-dev and the PM2 process 'bus-website-dev' are
#     ever touched. The API's own process is never restarted.
#
# Usage:
#   ./deploy/deploy.sh                  # full deploy
#   SKIP_LINT=1 ./deploy/deploy.sh      # skip eslint
#   LINT_STRICT=1 ./deploy/deploy.sh    # make lint errors fail the deploy
#   WEB_PORT=3041 ./deploy/deploy.sh    # different port

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — override any of these from the environment.
# ---------------------------------------------------------------------------
NODE_VERSION_MIN='20'
WEB_PORT="${WEB_PORT:-3040}"                   # 3030 is the API; keep them apart
APP_NAME='College Bus Tracking Website'
PM2_NAME='bus-website-dev'

# Next.js requires production mode to serve a built app. Unlike the API — where
# NODE_ENV=development is a deliberate choice that pins every OTP to "0000" —
# this has no auth side effects. The website holds no secrets of its own.
NODE_ENV='production'

VPS_HOST="${VPS_HOST:-89.116.134.28}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bus-website-dev}"

SSH_KEY="${SSH_KEY:-}"                         # optional: path to a private key
TARBALL='bus-website-dev.tar.gz'

# ---------------------------------------------------------------------------
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$WEB_DIR/deploy"
STAGE_DIR="$WEB_DIR/.deploy-stage"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi
REMOTE="$VPS_USER@$VPS_HOST"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

# --- Preflight -------------------------------------------------------------
step 'Preflight checks'

for bin in node npm tar ssh scp; do
  command -v "$bin" >/dev/null 2>&1 || fail "\`$bin\` not found on PATH."
done

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < NODE_VERSION_MIN )); then
  fail "Node $NODE_VERSION_MIN+ required to build; you have $(node -v)."
fi

PROD_ENV="$DEPLOY_DIR/.env.production"
[[ -f "$PROD_ENV" ]] || fail \
  "Missing $PROD_ENV — copy deploy/.env.production.example and fill it in."

if grep -qE '^NEXT_PUBLIC_API_URL=[[:space:]]*$' "$PROD_ENV"; then
  fail "$PROD_ENV has an empty NEXT_PUBLIC_API_URL."
fi

API_URL="$(grep -m1 '^NEXT_PUBLIC_API_URL=' "$PROD_ENV" | cut -d= -f2- | tr -d '\r')"
if [[ "$API_URL" == *'<'*'>'* ]]; then
  fail "$PROD_ENV still has placeholder <...> text in NEXT_PUBLIC_API_URL."
fi

# This URL is resolved by the visitor's browser, not by the server. Pointing it
# at loopback is the classic self-hosting mistake: it works when you curl it on
# the box and fails for every actual user.
if [[ "$API_URL" == *'127.0.0.1'* || "$API_URL" == *'localhost'* ]]; then
  fail "NEXT_PUBLIC_API_URL is $API_URL — that resolves on the *visitor's*
machine, not the server. Use the public address:  http://$VPS_HOST:3030"
fi

# The API is what every page talks to; if it's down the site deploys fine and
# then shows errors everywhere. Warn, don't block — you may be deploying the
# website first on purpose.
if curl -fsS --max-time 8 "${API_URL%/}/health" 2>/dev/null | grep -q '"ok"'; then
  echo "API        : $API_URL (healthy)"
else
  warn "API at $API_URL is not answering /health from here."
  warn "The site will build and start, but its pages will fail to load data."
fi

ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$REMOTE" 'true' \
  || fail "Cannot ssh to $REMOTE. Check the host, user, and your SSH key."

# A port already used by another project would make PM2 crash-loop after the
# upload, which is a confusing way to find out. Check before building.
if ssh "${SSH_OPTS[@]}" "$REMOTE" "ss -ltn 2>/dev/null | grep -q ':$WEB_PORT '"; then
  ssh "${SSH_OPTS[@]}" "$REMOTE" "pm2 pid '$PM2_NAME' >/dev/null 2>&1" \
    || fail "Port $WEB_PORT is in use on $VPS_HOST by something other than
$PM2_NAME. Pick another:  WEB_PORT=3041 ./deploy/deploy.sh"
fi

# The system Node on this box is older than we need and other projects depend
# on it, so resolve an nvm-managed Node instead and pin the app to it.
step 'Resolving Node on the VPS'
REMOTE_NODE_BIN="$(ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s <<'EOF'
set -e
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  for v in 22 20; do
    p="$(nvm which "$v" 2>/dev/null)" && [ -x "$p" ] && { echo "$p"; exit 0; }
  done
fi
command -v node || true
EOF
)"

[[ -n "$REMOTE_NODE_BIN" ]] || fail "No node found on $VPS_HOST at all."

remote_major="$(ssh "${SSH_OPTS[@]}" "$REMOTE" "'$REMOTE_NODE_BIN' -p 'process.versions.node.split(\".\")[0]'")"
if (( remote_major < NODE_VERSION_MIN )); then
  fail "The best Node on $VPS_HOST is v$remote_major; this app needs $NODE_VERSION_MIN+.
Install one for this app WITHOUT touching the system Node:

  ssh $REMOTE
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\"
  nvm install 22

Then re-run this script. Other projects keep using the system Node."
fi
echo "Using Node v$remote_major at $REMOTE_NODE_BIN"

echo "Deploying $APP_NAME"
echo "  from : $WEB_DIR"
echo "  to   : $REMOTE:$REMOTE_DIR"
echo "  url  : http://$VPS_HOST:$WEB_PORT"

# --- Build locally ---------------------------------------------------------
step 'Installing dependencies (npm ci)'
npm --prefix "$WEB_DIR" ci

# Export deploy/.env.production into the build environment. Shell variables beat
# every .env file in Next's precedence order, so this wins over a stale
# .env.local sitting in the working tree — the deployed build always matches
# what is in deploy/.env.production and nothing else.
step 'Loading build-time environment'
set -a
# shellcheck disable=SC1090
. "$PROD_ENV"
set +a
echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
if [[ -n "${NEXT_PUBLIC_FIREBASE_API_KEY:-}" ]]; then
  echo 'Firebase web push: configured'
else
  echo 'Firebase web push: not configured (notifications disabled)'
fi

# Advisory, not a gate. The app carries pre-existing eslint errors (mostly
# react-hooks/set-state-in-effect), so blocking on a clean lint would mean no
# deploy ever runs. `next build` typechecks the whole app and *is* a hard gate,
# which is the check that actually protects a release.
#   LINT_STRICT=1 -> fail the deploy on any lint error
#   SKIP_LINT=1   -> don't run it at all
if [[ "${SKIP_LINT:-0}" == '1' ]]; then
  step 'Skipping lint (SKIP_LINT=1)'
elif [[ "${LINT_STRICT:-0}" == '1' ]]; then
  step 'Linting (strict — errors abort the deploy)'
  npm --prefix "$WEB_DIR" run lint
else
  step 'Linting (advisory)'
  npm --prefix "$WEB_DIR" run lint || \
    warn 'Lint reported problems. Continuing — run with LINT_STRICT=1 to block on these.'
fi

step 'Building bundle (next build -> .next/standalone)'
npm --prefix "$WEB_DIR" run build
[[ -f "$WEB_DIR/.next/standalone/server.js" ]] || fail \
  'Build produced no .next/standalone/server.js.
Check that next.config.ts still has  output: "standalone".'

# --- Package ---------------------------------------------------------------
# A standalone build carries its own traced node_modules, so unlike the API
# deploy there is NO `npm ci` on the server. Everything needed to run ships in
# the tarball. Next leaves two things out of standalone/ on purpose, and the
# server 404s without them:
#   * .next/static — the hashed JS/CSS chunks every page requests;
#   * public/      — images, the FCM service worker, favicons.
step 'Packaging build artifacts'
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp -r "$WEB_DIR/.next/standalone/." "$STAGE_DIR/"
mkdir -p "$STAGE_DIR/.next"
cp -r "$WEB_DIR/.next/static" "$STAGE_DIR/.next/static"
[[ -d "$WEB_DIR/public" ]] && cp -r "$WEB_DIR/public" "$STAGE_DIR/public"

# PM2 config is rendered here rather than on the server, so there are no nested
# heredocs to escape. Three things matter:
#   * .cjs extension — safe whatever "type" package.json ends up with;
#   * explicit `interpreter` — the PM2 daemon runs under the old system Node for
#     the other projects on this box; this pins OUR app to the newer one;
#   * HOSTNAME=0.0.0.0 — the standalone server binds localhost by default, which
#     would pass the on-box health check and be unreachable from the internet.
cat > "$STAGE_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: '$PM2_NAME',
    cwd: '$REMOTE_DIR',
    script: 'server.js',
    interpreter: '$REMOTE_NODE_BIN',
    exec_mode: 'fork',
    instances: 1,
    max_memory_restart: '600M',
    time: true,
    env: {
      NODE_ENV: '$NODE_ENV',
      PORT: '$WEB_PORT',
      HOSTNAME: '0.0.0.0'
    }
  }]
};
EOF

tar -czf "$WEB_DIR/$TARBALL" -C "$STAGE_DIR" .

echo 'Package created:'
ls -lh "$WEB_DIR/$TARBALL"

# --- Upload ----------------------------------------------------------------
step "Uploading to $REMOTE:$REMOTE_DIR"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$REMOTE_DIR'"
scp "${SSH_OPTS[@]}" "$WEB_DIR/$TARBALL" "$REMOTE:$REMOTE_DIR/"

# --- Deploy on VPS ---------------------------------------------------------
step 'Deploying on VPS'
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "REMOTE_DIR='$REMOTE_DIR' TARBALL='$TARBALL' PM2_NAME='$PM2_NAME' \
   WEB_PORT='$WEB_PORT' NODE_BIN='$REMOTE_NODE_BIN' bash -s" \
  <<'REMOTE_SCRIPT'
set -euo pipefail

export PATH="$(dirname "$NODE_BIN"):$PATH"
echo "Running under $(node -v) ($NODE_BIN)"

cd "$REMOTE_DIR"

echo "Cleaning previous deploy (keeping the uploaded tarball)..."
find . -maxdepth 1 -mindepth 1 ! -name 'bus-website-dev*.tar.gz' -exec rm -rf {} +

echo "Extracting build..."
tar -xzf "$TARBALL"
rm -f "$TARBALL"

command -v pm2 >/dev/null 2>&1 || npm install -g pm2

# No `npm ci` here: a standalone build ships its own traced node_modules.
[ -d node_modules ] || { echo "ERROR: tarball has no node_modules — not a standalone build."; exit 1; }
[ -d .next/static ] || { echo "ERROR: tarball has no .next/static — pages would 404 their assets."; exit 1; }

echo "Starting/reloading app with PM2..."
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save

echo "Waiting for health check on http://127.0.0.1:$WEB_PORT/api/health ..."
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$WEB_PORT/api/health" >/dev/null 2>&1; then
    echo "Health check passed (local)."
    exit 0
  fi
  sleep 1
done

echo "Health check FAILED after 20s."
echo "Most likely causes: the port is already taken by another process, or the"
echo "Node version pinned in ecosystem.config.cjs is gone (re-run deploy.sh)."
echo
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
exit 1
REMOTE_SCRIPT

# --- Verify from outside ---------------------------------------------------
# With no reverse proxy the port is exposed directly, so confirm it is actually
# reachable from off-box — a firewall drop is invisible to the local check.
step "Verifying http://$VPS_HOST:$WEB_PORT/api/health from here"
if curl -fsS --max-time 10 "http://$VPS_HOST:$WEB_PORT/api/health" 2>/dev/null | grep -q '"ok"'; then
  echo 'Reachable from outside.'
else
  warn "App is healthy on the VPS but port $WEB_PORT is not reachable from here."
  warn "Open it on the server:  ufw allow $WEB_PORT/tcp"
  warn "Also check your VPS provider's firewall/security-group panel."
fi

# --- Done ------------------------------------------------------------------
step 'Deployment completed'
rm -rf "$STAGE_DIR" "$WEB_DIR/$TARBALL"
ssh "${SSH_OPTS[@]}" "$REMOTE" 'pm2 status'

echo
echo "Website  : http://$VPS_HOST:$WEB_PORT"
echo "Health   : http://$VPS_HOST:$WEB_PORT/api/health"
echo "Logs     : ssh $REMOTE 'pm2 logs $PM2_NAME'"
