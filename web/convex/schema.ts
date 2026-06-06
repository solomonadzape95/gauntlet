import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Gauntlet — mutable application state. Money + ownership stay on Sui;
 * roster JSONs live on Walrus; this is the editable index / cache / audit
 * layer that the admin UI mutates and the public app queries.
 */
export default defineSchema({
  // Top-level container — e.g. "World Cup 2026", "EPL Weekly".
  // Holds the master player pool blob from which matchday rosters are filtered.
  tournaments: defineTable({
    slug: v.string(),
    name: v.string(),
    season: v.string(),
    tagline: v.string(),
    image: v.string(),
    imageOriginal: v.string(),
    status: v.union(v.literal("live"), v.literal("soon"), v.literal("done")),
    ownerAddress: v.optional(v.string()),
    playerPoolBlobId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // Per-matchday slot under a tournament. Live ones carry their on-chain Pool.
  matchdays: defineTable({
    tournamentSlug: v.string(),
    mdSlug: v.string(),
    label: v.string(),
    date: v.string(),
    fixture: v.optional(v.string()),
    status: v.union(v.literal("live"), v.literal("soon"), v.literal("done")),
    rosterBlobId: v.optional(v.string()),
    matchdayResultsBlobId: v.optional(v.string()),
    poolObjectId: v.optional(v.string()),
    entryFeeMist: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tournament", ["tournamentSlug"])
    .index("by_pool", ["poolObjectId"])
    .index("by_tournament_md", ["tournamentSlug", "mdSlug"]),

  // Audit index of Walrus blob uploads (player pool / matchday roster / results).
  // Convex is never the source of truth on blob *contents* — only on what we've
  // uploaded, when, by whom.
  rosters: defineTable({
    blobId: v.string(),
    kind: v.union(
      v.literal("player-pool"),
      v.literal("matchday-roster"),
      v.literal("matchday-results"),
    ),
    tournamentSlug: v.optional(v.string()),
    mdSlug: v.optional(v.string()),
    name: v.string(),
    playerCount: v.number(),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
    version: v.number(),
  })
    .index("by_blob", ["blobId"])
    .index("by_kind", ["kind"])
    .index("by_tournament", ["tournamentSlug"]),

  // Cached Sui events, polled by an action every 30s. Powers the activity feed
  // without thrashing Tatum RPC from every browser tab.
  events: defineTable({
    txDigest: v.string(),
    eventSeq: v.string(),
    type: v.string(),
    sender: v.string(),
    poolObjectId: v.optional(v.string()),
    payload: v.any(),
    timestampMs: v.number(),
  })
    .index("by_pool_time", ["poolObjectId", "timestampMs"])
    .index("by_digest_seq", ["txDigest", "eventSeq"])
    .index("by_time", ["timestampMs"]),

  // Materialized view of Pass NFTs derived from the event log.
  passes: defineTable({
    passId: v.string(),
    ownerAddress: v.string(),
    poolObjectId: v.string(),
    playerId: v.number(),
    status: v.union(
      v.literal("alive"),
      v.literal("out"),
      v.literal("cashed"),
    ),
    mintedAtMs: v.number(),
    mintTxDigest: v.string(),
  })
    .index("by_owner", ["ownerAddress"])
    .index("by_pool", ["poolObjectId"])
    .index("by_pass_id", ["passId"]),

  // Cashout receipts for the admin dashboard.
  cashouts: defineTable({
    passId: v.string(),
    ownerAddress: v.string(),
    poolObjectId: v.string(),
    amountMist: v.string(),
    txDigest: v.string(),
    timestampMs: v.number(),
  })
    .index("by_pool", ["poolObjectId"])
    .index("by_owner", ["ownerAddress"])
    .index("by_pass_id", ["passId"])
    .index("by_time", ["timestampMs"]),

  // Admin role table. Seeded with NEXT_PUBLIC_ADMIN_ADDRESS; expandable from UI.
  adminRoles: defineTable({
    address: v.string(),
    role: v.union(v.literal("super"), v.literal("admin")),
    addedBy: v.optional(v.string()),
    addedAt: v.number(),
  }).index("by_address", ["address"]),

  // Server-polled snapshot of each on-chain Pool, so browsers read pool state
  // reactively from Convex instead of hammering Sui RPC from every tab (which
  // tripped the gateway rate limit). Refreshed by the 30s cron + on demand.
  poolStates: defineTable({
    poolObjectId: v.string(),
    admin: v.string(),
    treasury: v.string(),
    feeBps: v.number(),
    entryFeeMist: v.string(),
    potMist: v.string(),
    netPotMist: v.string(),
    totalPasses: v.number(),
    aliveCount: v.number(),
    survivingWeight: v.number(),
    totalWeight: v.number(),
    phase: v.number(),
    eliminatedPlayers: v.array(v.number()),
    updatedAt: v.number(),
  }).index("by_pool", ["poolObjectId"]),

  // Autonomous game-loop state — one row per pool the engine manages. The
  // on-chain phase is the source of truth; this tracks the off-chain timers
  // (lock countdown, sim window) and bookkeeping the loop needs.
  automation: defineTable({
    poolObjectId: v.string(),
    tournamentSlug: v.string(),
    mdSlug: v.string(),
    rosterBlobId: v.optional(v.string()),
    entryFeeMist: v.string(),
    treasury: v.string(),
    enabled: v.boolean(),
    // Editable timing knobs (ms).
    lockDelayMs: v.number(), //   last mint  → lock
    simDelayMs: v.number(), //    lock       → sim start
    settleDelayMs: v.number(), // sim start  → settle
    // Lifecycle timestamps.
    lastMintAtMs: v.optional(v.number()),
    lockedAtMs: v.optional(v.number()),
    simStartedAtMs: v.optional(v.number()),
    settledAtMs: v.optional(v.number()),
    // open | locking | locked | simming | settling | settled | spawned | error
    status: v.string(),
    lastError: v.optional(v.string()),
    spawnedChildPool: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_pool", ["poolObjectId"])
    .index("by_enabled", ["enabled"]),

  // Lightweight user directory derived from event sender addresses.
  users: defineTable({
    address: v.string(),
    displayName: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    passCount: v.number(),
  }).index("by_address", ["address"]),
});
