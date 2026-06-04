import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("live"),
  v.literal("soon"),
  v.literal("done"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("tournaments").collect();
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    season: v.string(),
    tagline: v.string(),
    image: v.string(),
    imageOriginal: v.string(),
    status: statusValidator,
    ownerAddress: v.optional(v.string()),
    playerPoolBlobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(`Tournament '${args.slug}' already exists`);
    }
    return ctx.db.insert("tournaments", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    season: v.optional(v.string()),
    tagline: v.optional(v.string()),
    image: v.optional(v.string()),
    imageOriginal: v.optional(v.string()),
    status: v.optional(statusValidator),
    playerPoolBlobId: v.optional(v.string()),
  },
  handler: async (ctx, { slug, ...patch }) => {
    const t = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!t) throw new Error(`Tournament '${slug}' not found`);
    const filtered = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(t._id, filtered);
    return t._id;
  },
});

export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const t = await ctx.db
      .query("tournaments")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!t) return;
    await ctx.db.delete(t._id);
  },
});
