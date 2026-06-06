import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Cached on-chain Pool snapshots. Browsers read these (reactive, free) instead
 * of calling Sui RPC from every tab. Written by the poller in `sui_actions`.
 */

export const forPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("poolStates")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
  },
});

export const upsert = internalMutation({
  args: {
    poolObjectId: v.string(),
    admin: v.string(),
    treasury: v.string(),
    feeBps: v.number(),
    entryFeeMist: v.string(),
    potMist: v.string(),
    netPotMist: v.string(),
    totalPasses: v.number(),
    aliveCount: v.number(),
    survivingWeight: v.number(),
    totalWeight: v.number(),
    phase: v.number(),
    eliminatedPlayers: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("poolStates")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", args.poolObjectId))
      .unique();
    const row = { ...args, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return ctx.db.insert("poolStates", row);
  },
});
