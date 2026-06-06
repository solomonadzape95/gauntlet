import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const recent = query({
  args: {
    poolObjectId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { poolObjectId, limit = 16 }) => {
    if (poolObjectId) {
      return ctx.db
        .query("events")
        .withIndex("by_pool_time", (q) => q.eq("poolObjectId", poolObjectId))
        .order("desc")
        .take(limit);
    }
    return ctx.db.query("events").withIndex("by_time").order("desc").take(limit);
  },
});

export const append = mutation({
  args: {
    txDigest: v.string(),
    eventSeq: v.string(),
    type: v.string(),
    sender: v.string(),
    poolObjectId: v.optional(v.string()),
    payload: v.any(),
    timestampMs: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_digest_seq", (q) =>
        q.eq("txDigest", args.txDigest).eq("eventSeq", args.eventSeq),
      )
      .unique();
    // `inserted` tells the caller whether this is the FIRST time we've seen the
    // event. The Sui poller uses it to run derived-table projections (passes,
    // cashouts, users) exactly once per on-chain event — re-projecting on every
    // poll was double-counting cashouts and flipping cashed passes back to alive.
    if (existing) return { id: existing._id, inserted: false };
    const id = await ctx.db.insert("events", args);
    return { id, inserted: true };
  },
});

/**
 * Events relevant to ONE wallet — the in-app notification feed. Scopes to:
 *   • pass-level events (PassMinted / PassCashedOut) the wallet owns, via the
 *     `owner` field the Move events carry, and
 *   • pool-level events (PoolLocked / PoolSettled / PoolClosed) for pools the
 *     wallet actually holds a pass in.
 * Without this, the bell showed every mint in the system — people got pinged
 * for players they never picked.
 */
export const forOwner = query({
  args: { address: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { address, limit = 20 }) => {
    const addr = address.toLowerCase();
    const myPasses = await ctx.db
      .query("passes")
      .withIndex("by_owner", (q) => q.eq("ownerAddress", address))
      .collect();
    const myPools = new Set(myPasses.map((p) => p.poolObjectId));

    // Scan a bounded window of recent events, then filter to this wallet.
    const recent = await ctx.db
      .query("events")
      .withIndex("by_time")
      .order("desc")
      .take(Math.max(limit * 10, 200));

    const mine = recent.filter((ev) => {
      const owner = (ev.payload as { owner?: unknown } | undefined)?.owner;
      if (typeof owner === "string") return owner.toLowerCase() === addr;
      // Pool-level events have no owner — surface them only for pools the
      // wallet participates in.
      return !!ev.poolObjectId && myPools.has(ev.poolObjectId);
    });

    return mine.slice(0, limit);
  },
});

/**
 * Platform revenue — the 10% fee skimmed to the treasury at settle. Each
 * PoolSettled event carries `fee_mist` (and `pot_mist`, the gross pot). Summed
 * across all settles. Returns mist as strings (bigint doesn't cross the wire
 * cleanly). Event volume is low, so a bounded full scan is fine.
 */
export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_time")
      .order("desc")
      .take(2000);
    let feeMist = 0n;
    let grossPotMist = 0n;
    let poolsSettled = 0;
    for (const ev of rows) {
      if (ev.type !== "PoolSettled") continue;
      poolsSettled++;
      const p = ev.payload as { fee_mist?: unknown; pot_mist?: unknown };
      feeMist += BigInt(String(p.fee_mist ?? "0"));
      grossPotMist += BigInt(String(p.pot_mist ?? "0"));
    }
    return {
      feeMist: feeMist.toString(),
      grossPotMist: grossPotMist.toString(),
      poolsSettled,
    };
  },
});

export const watermark = query({
  args: { poolObjectId: v.optional(v.string()) },
  handler: async (ctx, { poolObjectId }) => {
    const q = poolObjectId
      ? ctx.db
          .query("events")
          .withIndex("by_pool_time", (qb) =>
            qb.eq("poolObjectId", poolObjectId),
          )
      : ctx.db.query("events").withIndex("by_time");
    const latest = await q.order("desc").first();
    return latest?.timestampMs ?? 0;
  },
});
