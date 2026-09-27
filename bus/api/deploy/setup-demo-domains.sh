#!/usr/bin/env bash
#
# One-off setup for the demo environment's two domains on the shared VPS.
#
#   https://buszo.thinkcove.com      -> 127.0.0.1:3060  (Next.js website, demo)
#   https://buszo-api.thinkcove.com  -> 127.0.0.1:3050  (Express API, demo)
#
# The box already runs Traefik on ports 80 and 443 for every other project, so
# this adds one rule file in its watched directory rather than installing a
# second web server. Traefik picks the file up within a second or two, and asks
# Let's Encrypt for the certificates itself the first time each domain is
# visited — there is no certbot step.
#
# Safe to run again: the file is rewritten with the same content and no other
# project's file is touched.
#
# Usage:
#   ./deploy/setup-demo-domains.sh

set -euo pipefail

VPS_HOST="${VPS_HOST:-89.116.134.28}"
VPS_USER="${VPS_USER:-root}"
WEB_DOMAIN="${WEB_DOMAIN:-buszo.thinkcove.com}"
API_DOMAIN="${API_DOMAIN:-buszo-api.thinkcove.com}"
WEB_PORT="${WEB_PORT:-3060}"
API_PORT="${API_PORT:-3050}"
DYNAMIC_DIR="${DYNAMIC_DIR:-/opt/traefik/dynamic}"
# Matches certificatesResolvers in /etc/traefik/traefik.yml.
CERT_RESOLVER="${CERT_RESOLVER:-letsencrypt}"
SSH_KEY="${SSH_KEY:-}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")
REMOTE="$VPS_USER@$VPS_HOST"
RULE_FILE="$DYNAMIC_DIR/buszo.thinkcove.com.yml"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

step 'Checking the domains point at this server'
for d in "$WEB_DOMAIN" "$API_DOMAIN"; do
  ip="$(dig +short "$d" A | tail -1 || true)"
  [[ -z "$ip" ]] && fail "$d does not resolve yet. Add the A record and wait a few minutes."
  [[ "$ip" == "$VPS_HOST" ]] || fail \
    "$d resolves to $ip, not $VPS_HOST.
If it is behind Cloudflare's proxy (orange cloud), switch that record to
\"DNS only\" — Let's Encrypt must reach this server directly."
  echo "$d -> $ip"
done

ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$REMOTE" 'true' \
  || fail "Cannot ssh to $REMOTE."

step "Adding the Traefik rules on $VPS_HOST"
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "WEB_DOMAIN='$WEB_DOMAIN' API_DOMAIN='$API_DOMAIN' WEB_PORT='$WEB_PORT' \
   API_PORT='$API_PORT' DYNAMIC_DIR='$DYNAMIC_DIR' RULE_FILE='$RULE_FILE' \
   CERT_RESOLVER='$CERT_RESOLVER' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

[ -d "$DYNAMIC_DIR" ] || {
  echo "ERROR: $DYNAMIC_DIR does not exist — is this box still running Traefik?" >&2
  exit 1
}

# One file for both domains, same shape as the other projects here: a router
# per host on the TLS entrypoint, and a service pointing at the PM2 process
# listening on loopback.
cat > "$RULE_FILE" <<YAML
# Busszo demo environment. Written by bus/api/deploy/setup-demo-domains.sh —
# edits here are overwritten the next time it runs.
http:
  routers:
    buszo-api-demo:
      rule: "Host(\`$API_DOMAIN\`)"
      entryPoints:
        - "websecure"
      tls:
        certResolver: $CERT_RESOLVER
      service: buszo-api-demo

    buszo-web-demo:
      rule: "Host(\`$WEB_DOMAIN\`)"
      entryPoints:
        - "websecure"
      tls:
        certResolver: $CERT_RESOLVER
      service: buszo-web-demo

  services:
    buszo-api-demo:
      loadBalancer:
        servers:
          - url: "http://localhost:$API_PORT"

    buszo-web-demo:
      loadBalancer:
        servers:
          - url: "http://localhost:$WEB_PORT"
YAML

echo "wrote $RULE_FILE"
echo
cat "$RULE_FILE"

# Traefik watches the directory (watch: true), so there is nothing to restart.
# Give it a moment, then show whether it complained.
sleep 3
if [ -f /var/log/traefik/traefik.log ]; then
  echo
  echo "Recent Traefik log lines:"
  tail -5 /var/log/traefik/traefik.log || true
fi
REMOTE_SCRIPT

step 'Done'
cat <<EOF

  Website : https://$WEB_DOMAIN   -> localhost:$WEB_PORT
  API     : https://$API_DOMAIN   -> localhost:$API_PORT

Traefik reloaded the rules on its own, and will fetch each certificate the
first time the domain is visited. Both answer once the demo apps are deployed:

  cd bus/api         && DEPLOY_ENV=demo ./deploy/deploy.sh
  cd bus/bus-website && DEPLOY_ENV=demo ./deploy/deploy.sh

Until then a visit returns a Traefik "Bad Gateway" — that is the proxy working
with nothing behind it yet.
EOF
