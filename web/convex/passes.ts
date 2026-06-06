import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("alive"),
  v.literal("out"),
  v.literal("cashed"),
);

export const listByOwner = query({
  args: { ownerAddress: v.string() },
  handler: async (ctx, { ownerAddress }) => {
    return ctx.db
      .query("passes")
      .withIndex("by_owner", (q) => q.eq("ownerAddress", ownerAddress))
      .collect();
  },
});

export const listByPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("passes")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .collect();
  },
});

/** Per-player mint counts for a pool, derived from the passes table — replaces
 *  the per-browser queryEvents(PassMinted) RPC. Keyed by playerId (string). */
export const countsByPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    const rows = await ctx.db
      .query("passes")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .collect();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.playerId] = (counts[r.playerId] ?? 0) + 1;
    return counts;
  },
});

/**
 * Single pass record by on-chain pass id. The on-chain Pass NFT is BURNED on
 * cashout (`object::delete`), so chain reads 404 a cashed pass — this Convex
 * row is the surviving record. Used by the pass page to render a "Cashed out"
 * receipt instead of "not found".
 */
export const getByPassId = query({
  args: { passId: v.string() },
  handler: async (ctx, { passId }) => {
    return ctx.db
      .query("passes")
      .withIndex("by_pass_id", (q) => q.eq("passId", passId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    passId: v.string(),
    ownerAddress: v.string(),
    poolObjectId: v.string(),
    playerId: v.number(),
    status: statusValidator,
    mintedAtMs: v.number(),
    mintTxDigest: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("passes")
      .withIndex("by_pass_id", (q) => q.eq("passId", args.passId))
      .unique();
    if (existing) {
      // Never regress a terminal status. A re-projected PassMinted event must
      // not flip an already cashed/eliminated pass back to "alive".
      const terminal = existing.status === "cashed" || existing.status === "out";
      await ctx.db.patch(existing._id, {
        ownerAddress: args.ownerAddress,
        status: terminal ? existing.status : args.status,
      });
      return existing._id;
    }
    return ctx.db.insert("passes", args);
  },
});

export const setStatus = mutation({
  args: {
    passId: v.string(),
    status: statusValidator,
  },
  handler: async (ctx, { passId, status }) => {
    const pass = await ctx.db
      .query("passes")
      .withIndex("by_pass_id", (q) => q.eq("passId", passId))
      .unique();
    if (!pass) return;
    await ctx.db.patch(pass._id, { status });
  },
});

/**
 * Bulk-flip every alive pass in `poolObjectId` whose playerId is in
 * `eliminatedPlayerIds` to status "out". Idempotent and safe to call
 * multiple times (we only touch rows that are still "alive", so we don't
 * stomp passes that have already been cashed). Called from the admin's
 * settle flow and as a backstop from the Sui event projector.
 */
export const markEliminatedByPlayer = mutation({
  args: {
    poolObjectId: v.string(),
    eliminatedPlayerIds: v.array(v.number()),
  },
  handler: async (ctx, { poolObjectId, eliminatedPlayerIds }) => {
    const ids = new Set(eliminatedPlayerIds);
    if (ids.size === 0) return { updated: 0 };
    const rows = await ctx.db
      .query("passes")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .collect();
    let updated = 0;
    for (const r of rows) {
      if (ids.has(r.playerId) && r.status === "alive") {
        await ctx.db.patch(r._id, { status: "out" });
        updated++;
      }
    }
    return { updated };
  },
});
