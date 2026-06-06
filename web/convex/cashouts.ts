import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("cashouts")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .order("desc")
      .collect();
  },
});

export const listByOwner = query({
  args: { ownerAddress: v.string() },
  handler: async (ctx, { ownerAddress }) => {
    return ctx.db
      .query("cashouts")
      .withIndex("by_owner", (q) => q.eq("ownerAddress", ownerAddress))
      .order("desc")
      .collect();
  },
});

export const getByPassId = query({
  args: { passId: v.string() },
  handler: async (ctx, { passId }) => {
    return ctx.db
      .query("cashouts")
      .withIndex("by_pass_id", (q) => q.eq("passId", passId))
      .order("desc")
      .first();
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    return ctx.db
      .query("cashouts")
      .withIndex("by_time")
      .order("desc")
      .take(limit);
  },
});

export const record = mutation({
  args: {
    passId: v.string(),
    ownerAddress: v.string(),
    poolObjectId: v.string(),
    amountMist: v.string(),
    txDigest: v.string(),
    timestampMs: v.number(),
  },
  handler: async (ctx, args) => {
    // A pass is burned on cashout, so there's at most one cashout per passId.
    // Dedup defensively (and to heal old duplicates) so the profile's "cashed
    // out" count / total winnings can't double-count on re-projection.
    const existing = await ctx.db
      .query("cashouts")
      .withIndex("by_pass_id", (q) => q.eq("passId", args.passId))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("cashouts", args);
  },
});
