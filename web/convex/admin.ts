import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const roleValidator = v.union(v.literal("super"), v.literal("admin"));

export const isAdmin = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    if (!address) return false;
    const row = await ctx.db
      .query("adminRoles")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    return Boolean(row);
  },
});

export const role = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    if (!address) return null;
    const row = await ctx.db
      .query("adminRoles")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    return row?.role ?? null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("adminRoles").collect();
  },
});

export const add = mutation({
  args: {
    address: v.string(),
    role: roleValidator,
    addedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adminRoles")
      .withIndex("by_address", (q) => q.eq("address", args.address))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    return ctx.db.insert("adminRoles", { ...args, addedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const row = await ctx.db
      .query("adminRoles")
      .withIndex("by_address", (q) => q.eq("address", address))
      .unique();
    if (!row) return;
    await ctx.db.delete(row._id);
  },
});
