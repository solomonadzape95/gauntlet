import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Cross-tab / cross-device match-playback bus. BroadcastChannel only works
 * within a single browser, which kills the demo when the operator is on a
 * laptop and the projector is on a different machine. We piggyback on the
 * existing `events` table so we don't need a schema migration — sim events
 * are stamped with `type: "Sim:<kind>"` and a synthetic txDigest so they
 * coexist with real on-chain events without colliding.
 */

/**
 * Record a single scripted match event into the events table so every
 * subscriber of `latest` sees it via Convex live-query. Idempotent on
 * (txDigest, eventSeq) — re-firing the same event is a no-op.
 */
export const recordSimEvent = mutation({
  args: {
    poolObjectId: v.string(),
    startedAt: v.number(),
    event: v.any(),
  },
  handler: async (ctx, { poolObjectId, startedAt, event }) => {
    const eventSeq = String(event?.id ?? `${startedAt}-${Date.now()}`);
    const txDigest = `sim-${startedAt}`;
    const existing = await ctx.db
      .query("events")
      .withIndex("by_digest_seq", (q) =>
        q.eq("txDigest", txDigest).eq("eventSeq", eventSeq),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("events", {
      txDigest,
      eventSeq,
      type: `Sim:${event?.type ?? "unknown"}`,
      sender: "sim",
      poolObjectId,
      payload: { startedAt, event },
      timestampMs: Date.now(),
    });
  },
});

/**
 * Mark a sim run as started — emits a `Sim:start` event so subscribers can
 * reset the scoreboard / event ticker without waiting for the first scored
 * event to arrive.
 */
export const startSim = mutation({
  args: {
    poolObjectId: v.string(),
    startedAt: v.number(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { poolObjectId, startedAt, durationMs }) => {
    const txDigest = `sim-${startedAt}`;
    const eventSeq = "start";
    const existing = await ctx.db
      .query("events")
      .withIndex("by_digest_seq", (q) =>
        q.eq("txDigest", txDigest).eq("eventSeq", eventSeq),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("events", {
      txDigest,
      eventSeq,
      type: "Sim:start",
      sender: "sim",
      poolObjectId,
      payload: { startedAt, durationMs: durationMs ?? null },
      timestampMs: Date.now(),
    });
  },
});

/**
 * Mark a sim run as aborted. Subscribers should clear the live scoreboard.
 */
export const stopSim = mutation({
  args: {
    poolObjectId: v.string(),
    startedAt: v.number(),
  },
  handler: async (ctx, { poolObjectId, startedAt }) => {
    const txDigest = `sim-${startedAt}`;
    const eventSeq = "stop";
    const existing = await ctx.db
      .query("events")
      .withIndex("by_digest_seq", (q) =>
        q.eq("txDigest", txDigest).eq("eventSeq", eventSeq),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert("events", {
      txDigest,
      eventSeq,
      type: "Sim:stop",
      sender: "sim",
      poolObjectId,
      payload: { startedAt },
      timestampMs: Date.now(),
    });
  },
});

/**
 * Live-query: every Sim:* event for this pool, oldest-first. The live page
 * subscribes here and replays the run client-side — including the most
 * recent start/stop so reloads pick up mid-match.
 */
export const latest = query({
  args: {
    poolObjectId: v.string(),
    /** Optional cap so a long history doesn't blow up the response. */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { poolObjectId, limit = 500 }) => {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_pool_time", (q) => q.eq("poolObjectId", poolObjectId))
      .order("desc")
      .take(limit);
    // Filter to Sim:* in JS — Convex indexes don't support startsWith.
    const sims = rows.filter((r) => r.type.startsWith("Sim:"));
    // Reverse so the caller gets oldest → newest for replay.
    return sims.reverse();
  },
});
