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
    if (existing) return existing._id;
    return ctx.db.insert("events", args);
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
