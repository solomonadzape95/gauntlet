import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("live"),
  v.literal("soon"),
  v.literal("done"),
);

export const listForTournament = query({
  args: { tournamentSlug: v.string() },
  handler: async (ctx, { tournamentSlug }) => {
    return ctx.db
      .query("matchdays")
      .withIndex("by_tournament", (q) => q.eq("tournamentSlug", tournamentSlug))
      .collect();
  },
});

export const getByMd = query({
  args: { tournamentSlug: v.string(), mdSlug: v.string() },
  handler: async (ctx, { tournamentSlug, mdSlug }) => {
    return ctx.db
      .query("matchdays")
      .withIndex("by_tournament_md", (q) =>
        q.eq("tournamentSlug", tournamentSlug).eq("mdSlug", mdSlug),
      )
      .unique();
  },
});

export const getByPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("matchdays")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
  },
});

/**
 * Idempotent upsert. If the matchday slot doesn't exist for this
 * (tournament, mdSlug) it's inserted; if it does (e.g. seeded as "soon"),
 * the row is patched with whatever fields are supplied — typically the
 * newly-minted on-chain pool id + roster blob + a status flip to "live".
 *
 * This means "creating a matchday" and "spawning its on-chain pool" can be
 * the same admin action regardless of whether the slot was pre-seeded.
 */
export const create = mutation({
  args: {
    tournamentSlug: v.string(),
    mdSlug: v.string(),
    label: v.string(),
    date: v.string(),
    fixture: v.optional(v.string()),
    status: statusValidator,
    rosterBlobId: v.optional(v.string()),
    poolObjectId: v.optional(v.string()),
    entryFeeMist: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("matchdays")
      .withIndex("by_tournament_md", (q) =>
        q.eq("tournamentSlug", args.tournamentSlug).eq("mdSlug", args.mdSlug),
      )
      .unique();
    if (!existing) {
      return ctx.db.insert("matchdays", { ...args, createdAt: Date.now() });
    }
    // Patch — only overwrite fields that were actually supplied so a
    // re-run without a pool id doesn't accidentally clear one.
    const patch: Record<string, unknown> = {
      label: args.label,
      date: args.date,
      status: args.status,
    };
    if (args.fixture !== undefined) patch.fixture = args.fixture;
    if (args.rosterBlobId) patch.rosterBlobId = args.rosterBlobId;
    if (args.poolObjectId) patch.poolObjectId = args.poolObjectId;
    if (args.entryFeeMist) patch.entryFeeMist = args.entryFeeMist;
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

export const setPoolId = mutation({
  args: {
    tournamentSlug: v.string(),
    mdSlug: v.string(),
    poolObjectId: v.string(),
  },
  handler: async (ctx, { tournamentSlug, mdSlug, poolObjectId }) => {
    const md = await ctx.db
      .query("matchdays")
      .withIndex("by_tournament_md", (q) =>
        q.eq("tournamentSlug", tournamentSlug).eq("mdSlug", mdSlug),
      )
      .unique();
    if (!md) throw new Error("Matchday not found");
    await ctx.db.patch(md._id, { poolObjectId, status: "live" });
  },
});

export const setResults = mutation({
  args: {
    tournamentSlug: v.string(),
    mdSlug: v.string(),
    matchdayResultsBlobId: v.string(),
  },
  handler: async (
    ctx,
    { tournamentSlug, mdSlug, matchdayResultsBlobId },
  ) => {
    const md = await ctx.db
      .query("matchdays")
      .withIndex("by_tournament_md", (q) =>
        q.eq("tournamentSlug", tournamentSlug).eq("mdSlug", mdSlug),
      )
      .unique();
    if (!md) throw new Error("Matchday not found");
    await ctx.db.patch(md._id, {
      matchdayResultsBlobId,
      status: "done",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("matchdays"),
    label: v.optional(v.string()),
    date: v.optional(v.string()),
    fixture: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, { id, ...patch }) => {
    const filtered = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(id, filtered);
  },
});

/**
 * Remove a matchday row. By default refuses to delete a matchday that's still
 * pinned to an on-chain Pool object (so we can't silently orphan a live pool).
 * Pass `force: true` to bypass that guard when the pool is dead / abandoned.
 */
export const remove = mutation({
  args: {
    id: v.id("matchdays"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, force }) => {
    const md = await ctx.db.get(id);
    if (!md) return;
    if (md.poolObjectId && !force) {
      throw new Error(
        "Matchday is attached to an on-chain Pool. Pass force=true to delete anyway.",
      );
    }
    await ctx.db.delete(id);
  },
});
