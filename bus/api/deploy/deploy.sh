#!/usr/bin/env bash
#
# Manual DEV deploy for bus-api → VPS, PM2, no reverse proxy.
#
# Same shape as .github/workflows/deploy-dev2.yml (build → package → scp → PM2),
# minus GitHub Actions: the build happens on your machine, the artifact is scp'd
# to the VPS, and the remote steps run over plain ssh. No runner required.
#
# Dev deployment: reached directly at http://<VPS_HOST>:<API_PORT>, no domain,
# no TLS, no Traefik. Database is MongoDB Atlas.
#
# Shared server, so two things are deliberate:
#   * the app runs under its own nvm-managed Node, leaving the system Node (used
#     by other projects) alone — see REMOTE_NODE_BIN resolution below;
#   * only /opt/bus-api-dev and the PM2 process 'bus-api-dev' are ever touched.
#
# Usage:
#   ./deploy/deploy.sh                 # full deploy
#   SKIP_TESTS=1 ./deploy/deploy.sh    # skip the test suite

set -euo pipefail

# ---------------------------------------------------------------------------
# Config — the manual equivalent of the workflow's `env:` block.
# ---------------------------------------------------------------------------
NODE_VERSION_MIN='20'                          # workflow pinned 22; 20+ is fine
API_PORT="${API_PORT:-3030}"
APP_NAME='College Bus Tracking API (Dev)'
PM2_NAME='bus-api-dev'

# Dev, not production. This is what makes generateOtp() return a fixed "0000"
# (src/lib/otp.ts) — convenient for testing logins, and the reason this port
# should not be left open to the whole internet. See the README's firewall note.
NODE_ENV='development'

VPS_HOST="${VPS_HOST:-89.116.134.28}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/bus-api-dev}"

SSH_KEY="${SSH_KEY:-}"                         # optional: path to a private key
TARBALL='bus-api-dev.tar.gz'

# ---------------------------------------------------------------------------
API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$API_DIR/deploy"
STAGE_DIR="$API_DIR/.deploy-stage"

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

# Gitignored, so they can only ever be supplied by hand. This is the manual
# stand-in for the workflow's `${{ secrets.* }}` injection.
DEV_ENV="$DEPLOY_DIR/.env.dev"
[[ -f "$DEV_ENV" ]] || fail \
  "Missing $DEV_ENV — copy deploy/.env.dev.example and fill it in."

FIREBASE_JSON="$API_DIR/firebase-service-account.json"
[[ -f "$FIREBASE_JSON" ]] || fail "Missing $FIREBASE_JSON."

if grep -qE '^(MONGODB_URI|JWT_SECRET)=[[:space:]]*$' "$DEV_ENV"; then
  fail "$DEV_ENV has an empty MONGODB_URI or JWT_SECRET."
fi

MONGO_URI="$(grep -m1 '^MONGODB_URI=' "$DEV_ENV" | cut -d= -f2- || true)"
if [[ "$MONGO_URI" == *'<'*'>'* ]]; then
  fail "$DEV_ENV still has placeholder <...> text in MONGODB_URI."
fi

ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$REMOTE" 'true' \
  || fail "Cannot ssh to $REMOTE. Check the host, user, and your SSH key."

# Only demand a local Mongo if the URI actually points at one. With Atlas the
# database lives off-box and there is nothing here to check.
if [[ "$MONGO_URI" == *'127.0.0.1'* || "$MONGO_URI" == *'localhost'* ]]; then
  ssh "${SSH_OPTS[@]}" "$REMOTE" \
    'command -v mongod >/dev/null 2>&1 || ss -ltn 2>/dev/null | grep -q ":27017 "' \
    || fail "MONGODB_URI points at localhost but no MongoDB is running on $VPS_HOST."
else
  echo "Database   : remote (Atlas) — make sure $VPS_HOST is allowlisted in Atlas."
fi

# A port already in use by another project would make PM2 crash-loop after the
# upload, which is a confusing way to find out. Check before building.
if ssh "${SSH_OPTS[@]}" "$REMOTE" "ss -ltn 2>/dev/null | grep -q ':$API_PORT '"; then
  ssh "${SSH_OPTS[@]}" "$REMOTE" "pm2 pid '$PM2_NAME' >/dev/null 2>&1" \
    || fail "Port $API_PORT is in use on $VPS_HOST by something other than
$PM2_NAME. Pick another:  API_PORT=3031 ./deploy/deploy.sh"
fi

# The system Node on this box is older than we need and other projects depend on
# it, so resolve an nvm-managed Node instead and pin the app to it explicitly.
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
echo "  from : $API_DIR"
echo "  to   : $REMOTE:$REMOTE_DIR"
echo "  url  : http://$VPS_HOST:$API_PORT"

# --- Build locally ---------------------------------------------------------
step 'Installing dependencies (npm ci)'
npm --prefix "$API_DIR" ci

if [[ "${SKIP_TESTS:-0}" == '1' ]]; then
  step 'Skipping tests (SKIP_TESTS=1)'
else
  step 'Running test suite'
  npm --prefix "$API_DIR" test
fi

step 'Building bundle (tsc → dist/)'
npm --prefix "$API_DIR" run build
[[ -f "$API_DIR/dist/index.js" ]] || fail 'Build produced no dist/index.js.'

# --- Package ---------------------------------------------------------------
step 'Packaging build artifacts'
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp -r "$API_DIR/dist"              "$STAGE_DIR/dist"
cp    "$API_DIR/package.json"      "$STAGE_DIR/package.json"
cp    "$API_DIR/package-lock.json" "$STAGE_DIR/package-lock.json"
cp    "$FIREBASE_JSON"             "$STAGE_DIR/firebase-service-account.json"
cp    "$DEV_ENV"                   "$STAGE_DIR/.env"

# The service-account path must be absolute: PM2 sets cwd, but a relative path
# would break if anything ever runs the binary from elsewhere.
if grep -q '^FIREBASE_SERVICE_ACCOUNT_PATH=' "$STAGE_DIR/.env"; then
  sed -i.bak "s#^FIREBASE_SERVICE_ACCOUNT_PATH=.*#FIREBASE_SERVICE_ACCOUNT_PATH=$REMOTE_DIR/firebase-service-account.json#" \
    "$STAGE_DIR/.env"
  rm -f "$STAGE_DIR/.env.bak"
else
  echo "FIREBASE_SERVICE_ACCOUNT_PATH=$REMOTE_DIR/firebase-service-account.json" >> "$STAGE_DIR/.env"
fi

# PM2 config is rendered here rather than on the server, so there are no nested
# heredocs to escape. Two things matter:
#   * .cjs extension — package.json is "type": "module", so a .js config using
#     module.exports would fail to load;
#   * explicit `interpreter` — the PM2 daemon runs under the old system Node for
#     the other projects on this box; this pins OUR app to the newer one.
cat > "$STAGE_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: '$PM2_NAME',
    cwd: '$REMOTE_DIR',
    script: 'dist/index.js',
    interpreter: '$REMOTE_NODE_BIN',
    exec_mode: 'fork',
    instances: 1,
    max_memory_restart: '400M',
    time: true,
    env: {
      NODE_ENV: '$NODE_ENV',
      PORT: '$API_PORT'
    }
  }]
};
EOF

tar -czf "$API_DIR/$TARBALL" -C "$STAGE_DIR" \
  dist \
  package.json \
  package-lock.json \
  ecosystem.config.cjs \
  firebase-service-account.json \
  .env

echo 'Package created:'
ls -lh "$API_DIR/$TARBALL"

# --- Upload ----------------------------------------------------------------
step "Uploading to $REMOTE:$REMOTE_DIR"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$REMOTE_DIR'"
scp "${SSH_OPTS[@]}" "$API_DIR/$TARBALL" "$REMOTE:$REMOTE_DIR/"

# --- Deploy on VPS ---------------------------------------------------------
step 'Deploying on VPS'
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "REMOTE_DIR='$REMOTE_DIR' TARBALL='$TARBALL' PM2_NAME='$PM2_NAME' \
   API_PORT='$API_PORT' NODE_BIN='$REMOTE_NODE_BIN' bash -s" \
  <<'REMOTE_SCRIPT'
set -euo pipefail

# Put the app's own Node first, so `npm ci` resolves against it rather than the
# older system Node the other projects use.
export PATH="$(dirname "$NODE_BIN"):$PATH"
echo "Building with $(node -v) ($NODE_BIN)"

cd "$REMOTE_DIR"

echo "Cleaning previous deploy (keeping the uploaded tarball)..."
find . -maxdepth 1 -mindepth 1 ! -name 'bus-api-dev*.tar.gz' -exec rm -rf {} +

echo "Extracting build..."
tar -xzf "$TARBALL"
rm -f "$TARBALL"

command -v pm2 >/dev/null 2>&1 || npm install -g pm2

echo "Installing production dependencies..."
export CI=true
npm ci --omit=dev

chmod 600 .env firebase-service-account.json

echo "Starting/reloading app with PM2..."
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save

echo "Waiting for health check on http://127.0.0.1:$API_PORT/health ..."
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
    echo "Health check passed (local)."
    exit 0
  fi
  sleep 1
done

echo "Health check FAILED after 20s."
echo "Most likely cause: the app could not reach MongoDB Atlas (it exits on a"
echo "failed connect). Confirm this server's IP is allowlisted in Atlas under"
echo "Network Access, and that MONGODB_URI's user/password are right."
echo
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
exit 1
REMOTE_SCRIPT

# --- Verify from outside ---------------------------------------------------
# With no reverse proxy the port is exposed directly, so confirm it is actually
# reachable from off-box — a firewall drop is invisible to the local check.
step "Verifying http://$VPS_HOST:$API_PORT/health from here"
if curl -fsS --max-time 10 "http://$VPS_HOST:$API_PORT/health" 2>/dev/null | grep -q '"ok"'; then
  echo 'Reachable from outside.'
else
  warn "App is healthy on the VPS but port $API_PORT is not reachable from here."
  warn "Open it on the server:  ufw allow $API_PORT/tcp"
  warn "Also check your VPS provider's firewall/security-group panel."
fi

# --- Done ------------------------------------------------------------------
step 'Deployment completed'
rm -rf "$STAGE_DIR" "$API_DIR/$TARBALL"
ssh "${SSH_OPTS[@]}" "$REMOTE" 'pm2 status'

echo
echo "Base URL : http://$VPS_HOST:$API_PORT"
echo "Health   : http://$VPS_HOST:$API_PORT/health"
echo "Logs     : ssh $REMOTE 'pm2 logs $PM2_NAME'"
