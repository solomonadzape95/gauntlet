import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").collect();
  },
});

export const get = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    return ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
  },
});

export const seen = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      return existing._id;
    }
    return ctx.db.insert("users", {
      address,
      firstSeenAt: now,
      lastSeenAt: now,
      passCount: 0,
    });
  },
});

export const setDisplayName = mutation({
  args: { address: v.string(), displayName: v.string() },
  handler: async (ctx, { address, displayName }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (!u) throw new Error("User not found");
    await ctx.db.patch(u._id, { displayName });
  },
});

export const incrementPassCount = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const u = await ctx.db
      .query("users")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (!u) return;
    await ctx.db.patch(u._id, { passCount: u.passCount + 1 });
  },
});
