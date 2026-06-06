import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Public HTTP endpoints exposed by this Convex deployment.
 *
 * Routes here are reachable at `<NEXT_PUBLIC_CONVEX_URL replace ".convex.cloud"
 * with ".convex.site">/<path>`. The Convex dashboard prints the exact site URL.
 */
const http = httpRouter();

/**
 * Tatum Notifications webhook receiver.
 *
 * Tatum can't reach localhost — this endpoint is for the **deployed**
 * environment. For local dev you don't need any of this: the
 * `sui_actions.pollEvents` cron polls Sui RPC every 30s and writes into
 * the same `events` table, so the in-app bell + ticker work without
 * Tatum at all.
 *
 * In production:
 *   1. Convex dashboard → Settings → URL & Domains → "HTTP Actions URL"
 *      (ends in `.convex.site`). Append `/tatum-webhook`.
 *   2. dashboard.tatum.io → Notifications → Create → Address activity
 *      on the Gauntlet package id → destination = the URL above.
 *
 * What this handler does, in order:
 *   1. Validates the JSON body.
 *   2. Extracts one or more Sui events (best-effort across Tatum payload
 *      shapes — single object, batched array, raw RPC dump).
 *   3. Calls `api.events.append` so the row lands in the same `events`
 *      table the in-app bell + admin feed already subscribe to.
 *   4. Optionally fans out a one-line summary to `DISCORD_WEBHOOK_URL`
 *      if you want external pings too — completely skippable.
 *
 * Returns 200 fast so Tatum doesn't retry on slow downstream calls.
 */
http.route({
  path: "/tatum-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const events = normalizeToEvents(payload);
    for (const ev of events) {
      try {
        await ctx.runMutation(api.events.append, ev);
      } catch (e) {
        console.warn("[tatum-webhook] events.append failed:", e);
      }
    }

    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl && events.length > 0) {
      try {
        await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: summarizeForDiscord(events),
            username: "Gauntlet",
          }),
        });
      } catch (e) {
        console.warn("[tatum-webhook] Discord forward failed:", e);
      }
    }

    return new Response(`ok · ${events.length} events`, { status: 200 });
  }),
});

interface NormalizedEvent {
  txDigest: string;
  eventSeq: string;
  type: string;
  sender: string;
  poolObjectId?: string;
  payload: Record<string, unknown>;
  timestampMs: number;
}

/**
 * Tatum payload shapes vary by subscription type. This best-effort
 * normalizer tries to pull out one or more Sui events regardless of
 * whether Tatum sent a single event, an array, or a raw RPC dump with
 * `result.data[]`.
 */
function normalizeToEvents(payload: unknown): NormalizedEvent[] {
  if (!payload || typeof payload !== "object") return [];

  if (Array.isArray(payload)) {
    return payload
      .map(toEvent)
      .filter((x): x is NormalizedEvent => x !== null);
  }

  const p = payload as Record<string, unknown>;

  const result = p.result as { data?: unknown[] } | undefined;
  if (result?.data && Array.isArray(result.data)) {
    return result.data
      .map(toEvent)
      .filter((x): x is NormalizedEvent => x !== null);
  }

  if (Array.isArray(p.events)) {
    return p.events
      .map(toEvent)
      .filter((x): x is NormalizedEvent => x !== null);
  }

  const single = toEvent(p);
  return single ? [single] : [];
}

function toEvent(raw: unknown): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = r.id as { txDigest?: string; eventSeq?: string } | undefined;
  const txDigest =
    id?.txDigest ??
    (r.txDigest as string | undefined) ??
    (r.txHash as string | undefined) ??
    "";
  const eventSeq =
    id?.eventSeq ?? (r.eventSeq as string | undefined) ?? "0";
  if (!txDigest) return null;

  const fullType = (r.type as string | undefined) ?? "";
  const type = fullType.split("::").pop() ?? fullType;
  const sender = (r.sender as string | undefined) ?? "";
  const parsed = (r.parsedJson ?? r.payload ?? {}) as Record<string, unknown>;
  const poolObjectId =
    typeof parsed.pool_id === "string" ? parsed.pool_id : undefined;
  const timestampMs = Number(r.timestampMs ?? Date.now());

  return {
    txDigest,
    eventSeq: String(eventSeq),
    type: type || "Unknown",
    sender,
    poolObjectId,
    payload: parsed,
    timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now(),
  };
}

function summarizeForDiscord(events: NormalizedEvent[]): string {
  const lines = events.slice(0, 3).map((e) => {
    const tx = e.txDigest
      ? `https://suiscan.xyz/mainnet/tx/${e.txDigest}`
      : "";
    return `🟧 **${e.type}**${e.sender ? ` · ${shortHex(e.sender)}` : ""}${tx ? `\n${tx}` : ""}`;
  });
  if (events.length > 3) lines.push(`+${events.length - 3} more`);
  return lines.join("\n");
}

function shortHex(h: string): string {
  if (!h || h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export default http;
