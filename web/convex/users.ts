import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").collect();
  },
});

/**
 * Wallet directory for the admin Users page. Joins the `users` table with live
 * pass counts derived from the `passes` table (the `users.passCount` column is
 * mint-only and never decremented, so it's unreliable). Also surfaces any
 * address that has passes but no `users` row yet. Sorted by total passes.
 */
export const directory = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const passes = await ctx.db.query("passes").collect();

    type Tally = { total: number; alive: number; cashed: number; out: number };
    const byOwner = new Map<string, Tally>();
    for (const p of passes) {
      const t = byOwner.get(p.ownerAddress) ?? {
        total: 0,
        alive: 0,
        cashed: 0,
        out: 0,
      };
      t.total++;
      if (p.status === "alive") t.alive++;
      else if (p.status === "cashed") t.cashed++;
      else t.out++;
      byOwner.set(p.ownerAddress, t);
    }

    const userByAddr = new Map(users.map((u) => [u.address, u]));
    const addresses = new Set<string>([
      ...users.map((u) => u.address),
      ...byOwner.keys(),
    ]);

    return [...addresses]
      .map((address) => {
        const u = userByAddr.get(address);
        const t = byOwner.get(address) ?? {
          total: 0,
          alive: 0,
          cashed: 0,
          out: 0,
        };
        return {
          address,
          displayName: u?.displayName,
          firstSeenAt: u?.firstSeenAt ?? 0,
          lastSeenAt: u?.lastSeenAt ?? 0,
          total: t.total,
          alive: t.alive,
          cashed: t.cashed,
          out: t.out,
        };
      })
      .sort((a, b) => b.total - a.total || b.lastSeenAt - a.lastSeenAt);
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
