// Liveness probe for the VPS deploy (deploy/deploy.sh polls this after PM2
// starts the app, and again from outside to prove the port is open).
// force-dynamic so a cached static response can never make a dead server look
// healthy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
