import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const kindValidator = v.union(
  v.literal("player-pool"),
  v.literal("matchday-roster"),
  v.literal("matchday-results"),
);

export const listByKind = query({
  args: { kind: kindValidator },
  handler: async (ctx, { kind }) => {
    return ctx.db
      .query("rosters")
      .withIndex("by_kind", (q) => q.eq("kind", kind))
      .collect();
  },
});

export const listForTournament = query({
  args: { tournamentSlug: v.string() },
  handler: async (ctx, { tournamentSlug }) => {
    return ctx.db
      .query("rosters")
      .withIndex("by_tournament", (q) => q.eq("tournamentSlug", tournamentSlug))
      .collect();
  },
});

export const getByBlobId = query({
  args: { blobId: v.string() },
  handler: async (ctx, { blobId }) => {
    return ctx.db
      .query("rosters")
      .withIndex("by_blob", (q) => q.eq("blobId", blobId))
      .unique();
  },
});

export const record = mutation({
  args: {
    blobId: v.string(),
    kind: kindValidator,
    tournamentSlug: v.optional(v.string()),
    mdSlug: v.optional(v.string()),
    name: v.string(),
    playerCount: v.number(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Compute version = 1 + max existing version with the same (kind, tournament).
    const siblings = args.tournamentSlug
      ? await ctx.db
          .query("rosters")
          .withIndex("by_tournament", (q) =>
            q.eq("tournamentSlug", args.tournamentSlug),
          )
          .filter((q) => q.eq(q.field("kind"), args.kind))
          .collect()
      : [];
    const version =
      siblings.reduce((m, r) => Math.max(m, r.version), 0) + 1;

    return ctx.db.insert("rosters", {
      ...args,
      version,
      uploadedAt: Date.now(),
    });
  },
});
