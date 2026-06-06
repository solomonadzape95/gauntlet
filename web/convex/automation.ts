import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";

/**
 * State layer for the autonomous game loop. The heavy lifting (signing,
 * Gemini, Walrus) lives in the node action `gameLoop.ts`; this file is just
 * the Convex-native reads/writes it and the UI lean on.
 *
 * Defaults: lock 90s after the last mint, sim 30s after lock, settle 30s after
 * the sim starts. All editable per pool from the admin console.
 */
export const DEFAULT_LOCK_DELAY_MS = 90_000;
export const DEFAULT_SIM_DELAY_MS = 30_000;
export const DEFAULT_SETTLE_DELAY_MS = 30_000;

/** Throw unless `address` is in adminRoles. Address-based (matches the app's
 *  wallet identity model) — gate, not cryptographic proof. */
async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: any },
  address: string,
) {
  const row = await ctx.db
    .query("adminRoles")
    .withIndex("by_address", (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq("address", address),
    )
    .unique();
  if (!row) throw new Error("Not authorized: admin only");
}

// ── Public: UI ────────────────────────────────────────────────────────────

/** Automation row for a pool — drives the live-page countdown + status. */
export const forPool = query({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
  },
});

interface RegisterArgs {
  poolObjectId: string;
  tournamentSlug: string;
  mdSlug: string;
  rosterBlobId?: string;
  entryFeeMist: string;
  treasury: string;
  enabled?: boolean;
  lockDelayMs?: number;
  simDelayMs?: number;
  settleDelayMs?: number;
}

// Shared upsert — no auth. Used by the admin-gated `register` and by the loop's
// internal `registerInternal` when it spawns the next matchday.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertAutomation(ctx: { db: any }, args: RegisterArgs) {
  const existing = await ctx.db
    .query("automation")
    .withIndex("by_pool", (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq("poolObjectId", args.poolObjectId),
    )
    .unique();
  const fields = {
    tournamentSlug: args.tournamentSlug,
    mdSlug: args.mdSlug,
    rosterBlobId: args.rosterBlobId,
    entryFeeMist: args.entryFeeMist,
    treasury: args.treasury,
    enabled: args.enabled ?? existing?.enabled ?? false,
    lockDelayMs: args.lockDelayMs ?? existing?.lockDelayMs ?? DEFAULT_LOCK_DELAY_MS,
    simDelayMs: args.simDelayMs ?? existing?.simDelayMs ?? DEFAULT_SIM_DELAY_MS,
    settleDelayMs:
      args.settleDelayMs ?? existing?.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS,
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return ctx.db.insert("automation", {
    poolObjectId: args.poolObjectId,
    ...fields,
    status: "open",
    createdAt: Date.now(),
  });
}

const registerFields = {
  poolObjectId: v.string(),
  tournamentSlug: v.string(),
  mdSlug: v.string(),
  rosterBlobId: v.optional(v.string()),
  entryFeeMist: v.string(),
  treasury: v.string(),
  enabled: v.optional(v.boolean()),
  lockDelayMs: v.optional(v.number()),
  simDelayMs: v.optional(v.number()),
  settleDelayMs: v.optional(v.number()),
};

// ── Public: admin controls ──────────────────────────────────────────────────

/** Enroll a pool in the loop (or update its config). Idempotent by pool id. */
export const register = mutation({
  args: { caller: v.string(), ...registerFields },
  handler: async (ctx, { caller, ...args }) => {
    await assertAdmin(ctx, caller);
    return upsertAutomation(ctx, args);
  },
});

export const setEnabled = mutation({
  args: { caller: v.string(), poolObjectId: v.string(), enabled: v.boolean() },
  handler: async (ctx, { caller, poolObjectId, enabled }) => {
    await assertAdmin(ctx, caller);
    const row = await ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, { enabled });
  },
});

/** Edit the timing knobs (admin "edit the lock time"). Values in seconds. */
export const setTimings = mutation({
  args: {
    caller: v.string(),
    poolObjectId: v.string(),
    lockDelaySec: v.optional(v.number()),
    simDelaySec: v.optional(v.number()),
    settleDelaySec: v.optional(v.number()),
  },
  handler: async (ctx, { caller, poolObjectId, lockDelaySec, simDelaySec, settleDelaySec }) => {
    await assertAdmin(ctx, caller);
    const row = await ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
    if (!row) return;
    const patch: Record<string, number> = {};
    if (lockDelaySec !== undefined) patch.lockDelayMs = Math.max(0, Math.round(lockDelaySec * 1000));
    if (simDelaySec !== undefined) patch.simDelayMs = Math.max(0, Math.round(simDelaySec * 1000));
    if (settleDelaySec !== undefined) patch.settleDelayMs = Math.max(0, Math.round(settleDelaySec * 1000));
    await ctx.db.patch(row._id, patch);
  },
});

/** Bump the lock countdown — called by the event poller on each new mint. */
export const touchMint = mutation({
  args: { poolObjectId: v.string(), timestampMs: v.number() },
  handler: async (ctx, { poolObjectId, timestampMs }) => {
    const row = await ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
    if (!row) return;
    const next = Math.max(row.lastMintAtMs ?? 0, timestampMs);
    if (next !== row.lastMintAtMs) await ctx.db.patch(row._id, { lastMintAtMs: next });
  },
});

// ── Internal: used by the gameLoop node action ──────────────────────────────

/** Loop-side enrollment of a freshly spawned pool (no admin gate — the engine
 *  is the only caller, via internal access). */
export const registerInternal = internalMutation({
  args: registerFields,
  handler: async (ctx, args) => upsertAutomation(ctx, args),
});

export const listEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("automation")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const getByPool = internalQuery({
  args: { poolObjectId: v.string() },
  handler: async (ctx, { poolObjectId }) => {
    return ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
  },
});

export const patchState = internalMutation({
  args: {
    poolObjectId: v.string(),
    status: v.optional(v.string()),
    lockedAtMs: v.optional(v.number()),
    simStartedAtMs: v.optional(v.number()),
    settledAtMs: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    lastError: v.optional(v.string()),
    spawnedChildPool: v.optional(v.string()),
  },
  handler: async (ctx, { poolObjectId, ...patch }) => {
    const row = await ctx.db
      .query("automation")
      .withIndex("by_pool", (q) => q.eq("poolObjectId", poolObjectId))
      .unique();
    if (!row) return;
    // Drop undefined keys so we don't clobber set fields with undefined.
    const clean: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(row._id, clean);
  },
});
