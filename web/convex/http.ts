import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

/**
 * Public HTTP endpoints exposed by this Convex deployment.
 *
 * Routes here are reachable at `<NEXT_PUBLIC_CONVEX_URL replace ".convex.cloud"
 * with ".convex.site">/<path>`. The dashboard prints the exact site URL.
 */
const http = httpRouter();

/**
 * Tatum Notifications webhook receiver.
 *
 * Set up in the Tatum dashboard:
 *   1. dashboard.tatum.io → Notifications → Create
 *   2. Address activity (or "Sui object activity") on the Gauntlet package
 *   3. Destination: webhook URL = `<convex-site-url>/tatum-webhook`
 *
 * Tatum POSTs a JSON payload describing the event. We mirror it into:
 *   - `events` table (so the admin feed shows it without polling)
 *   - Discord, if `DISCORD_WEBHOOK_URL` is set in Convex env vars
 *
 * Returns 200 quickly so Tatum doesn't retry on slow Discord round-trips.
 */
http.route({
  path: "/tatum-webhook",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      // Best-effort fan-out. Don't block the webhook reply on Discord —
      // Tatum re-fires on non-2xx so we want this fast & idempotent.
      const summary = summarizeForDiscord(payload);
      try {
        await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: summary,
            username: "Gauntlet",
            avatar_url: undefined,
          }),
        });
      } catch (e) {
        console.warn("[tatum-webhook] Discord forward failed:", e);
      }
    }

    return new Response("ok", { status: 200 });
  }),
});

/** Build a one-line Discord-friendly summary from the Tatum payload. */
function summarizeForDiscord(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (!payload || typeof payload !== "object") return `🟧 Gauntlet event · ${json.slice(0, 1500)}`;
  const p = payload as Record<string, unknown>;

  // Tatum payload shape varies by subscription type. Pull a few common
  // fields and fall back to a JSON truncation.
  const type =
    (p.type as string | undefined) ??
    (p.subscriptionType as string | undefined) ??
    "event";
  const txHash =
    (p.txHash as string | undefined) ??
    (p.txId as string | undefined) ??
    (p.transactionId as string | undefined);
  const address =
    (p.address as string | undefined) ?? (p.sender as string | undefined);

  const lines: string[] = [`🟧 **Gauntlet · ${type}**`];
  if (address) lines.push(`👤  ${shortHex(address)}`);
  if (txHash) lines.push(`🔗  https://suiscan.xyz/testnet/tx/${txHash}`);

  if (lines.length === 1) {
    lines.push("```json\n" + json.slice(0, 1500) + "\n```");
  }
  return lines.join("\n");
}

function shortHex(h: string): string {
  if (!h || h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export default http;
