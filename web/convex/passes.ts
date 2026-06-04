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
      await ctx.db.patch(existing._id, {
        ownerAddress: args.ownerAddress,
        status: args.status,
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
