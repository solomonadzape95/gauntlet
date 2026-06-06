"use node";

import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Server-side Sui event poller. Runs in a Node action so it can make outbound
 * fetch calls to the Sui RPC. Pulls the most recent events for the gauntlet
 * package and forwards each to the `events.append` mutation (which dedups by
 * txDigest + eventSeq).
 *
 * Cron-scheduled in `convex/crons.ts`. Safe to invoke manually too:
 *   pnpm dlx convex run sui_actions:pollEvents
 */
export const pollEvents = action({
  args: {
    /** Optional override for the package id; defaults to env. */
    packageId: v.optional(v.string()),
    /** Number of events to pull per poll. */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { packageId, limit = 50 }) => {
    const pkg =
      packageId ??
      process.env.GAUNTLET_PACKAGE_ID ??
      process.env.NEXT_PUBLIC_GAUNTLET_PACKAGE_ID;
    const rpcUrl =
      process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";

    if (!pkg || pkg === "0x0") {
      console.warn("[sui_actions.pollEvents] package id not configured; skip");
      return { ok: false, reason: "no package id" };
    }

    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [
        { MoveModule: { package: pkg, module: "pool" } },
        null,
        limit,
        true,
      ],
    };

    // Tatum gateway endpoints need x-api-key; public fullnodes ignore it.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.TATUM_API_KEY) headers["x-api-key"] = process.env.TATUM_API_KEY;

    let res: Response;
    try {
      res = await fetch(rpcUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("[sui_actions.pollEvents] RPC fetch failed:", e);
      return { ok: false, reason: "rpc unreachable" };
    }

    if (!res.ok) {
      console.error("[sui_actions.pollEvents] RPC non-2xx:", res.status);
      return { ok: false, reason: `rpc ${res.status}` };
    }

    const json = (await res.json()) as {
      result?: {
        data?: Array<{
          id: { txDigest: string; eventSeq: string };
          packageId: string;
          type: string;
          sender: string;
          parsedJson?: Record<string, unknown>;
          timestampMs?: string;
        }>;
      };
      error?: { message?: string };
    };

    if (json.error) {
      console.error("[sui_actions.pollEvents] RPC error:", json.error.message);
      return { ok: false, reason: json.error.message };
    }

    const events = json.result?.data ?? [];
    let inserted = 0;

    for (const ev of events) {
      const evType = ev.type.split("::").pop() ?? "Unknown";
      const data = ev.parsedJson ?? {};
      const poolObjectId =
        typeof data.pool_id === "string" ? data.pool_id : undefined;
      const ts = Number(ev.timestampMs ?? 0);

      const appendResult = (await ctx.runMutation(api.events.append, {
        txDigest: ev.id.txDigest,
        eventSeq: ev.id.eventSeq,
        type: evType,
        sender: ev.sender,
        poolObjectId,
        payload: data,
        timestampMs: ts || Date.now(),
      })) as { inserted?: boolean } | null;

      // Only project derived tables (passes, cashouts, users) the FIRST time we
      // see an event. Re-projecting on every 30s poll was inserting duplicate
      // cashouts and re-flipping cashed/eliminated passes back to "alive".
      if (!appendResult?.inserted) continue;
      inserted++;

      // Side effects per event type — derived tables (passes, cashouts, users).
      try {
        await maybeProjectEvent(ctx, evType, ev.sender, data, ev.id.txDigest, ts);
      } catch (e) {
        console.warn(`[sui_actions.pollEvents] projection failed for ${evType}:`, e);
      }
    }

    return { ok: true, inserted };
  },
});

async function maybeProjectEvent(
  ctx: ActionCtx,
  type: string,
  sender: string,
  data: Record<string, unknown>,
  txDigest: string,
  timestampMs: number,
) {
  if (type === "PassMinted") {
    const passId = String(data.pass_id ?? "");
    const poolObjectId = String(data.pool_id ?? "");
    const playerId = Number(data.player_id ?? 0);
    if (!passId || !poolObjectId) return;
    await ctx.runMutation(api.passes.upsert, {
      passId,
      ownerAddress: sender,
      poolObjectId,
      playerId,
      status: "alive",
      mintedAtMs: timestampMs || Date.now(),
      mintTxDigest: txDigest,
    });
    await ctx.runMutation(api.users.seen, { address: sender });
    await ctx.runMutation(api.users.incrementPassCount, { address: sender });
    // Reset the autonomous lock countdown — locks `lockDelayMs` after the last
    // mint. No-op if this pool isn't enrolled in the game loop.
    await ctx.runMutation(api.automation.touchMint, {
      poolObjectId,
      timestampMs: timestampMs || Date.now(),
    });
  } else if (type === "PassCashedOut") {
    const passId = String(data.pass_id ?? "");
    const poolObjectId = String(data.pool_id ?? "");
    const amountMist = String(data.payout_mist ?? "0");
    if (!passId) return;
    await ctx.runMutation(api.passes.setStatus, {
      passId,
      status: "cashed",
    });
    await ctx.runMutation(api.cashouts.record, {
      passId,
      ownerAddress: sender,
      poolObjectId,
      amountMist,
      txDigest,
      timestampMs: timestampMs || Date.now(),
    });
  } else if (type === "PassEliminated") {
    const passId = String(data.pass_id ?? "");
    if (!passId) return;
    await ctx.runMutation(api.passes.setStatus, {
      passId,
      status: "out",
    });
  } else if (type === "PoolSettled") {
    // The on-chain settle event carries the eliminated player ids. Bulk-flip
    // every still-alive pass for those players to "out" so the Convex view
    // converges on the on-chain truth even if the admin's UI didn't fire the
    // mutation directly (closed tab, network blip, etc.).
    const poolObjectId = String(data.pool_id ?? "");
    if (!poolObjectId) return;
    const raw = data.eliminated_players ?? data.eliminated_player_ids ?? [];
    const eliminatedPlayerIds = Array.isArray(raw)
      ? raw.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    if (eliminatedPlayerIds.length === 0) return;
    await ctx.runMutation(api.passes.markEliminatedByPlayer, {
      poolObjectId,
      eliminatedPlayerIds,
    });
  }
}
