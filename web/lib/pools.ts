import {
  POOL_OBJECT_ID,
  ROSTER_BLOB_ID,
  MATCHDAY_BLOB_ID,
} from "./sui";

export type PoolStatus = "live" | "soon";

export interface PoolMeta {
  slug: string;
  name: string;
  season: string;
  tagline: string;
  /** Stylized cover — shown at rest. Path: /pools/<slug>-edited.jpg */
  image: string;
  /** Real photo — revealed on hover via the warp transition. Path: /pools/<slug>-original.jpg */
  imageOriginal: string;
  status: PoolStatus;
  /** Tournament slug (see lib/tournaments.ts). When set, this pool renders under the tournament header on /pools. */
  tournament?: string;
  /** Sui Pool object id — only set for "live" pools. */
  poolId?: string;
  /** Walrus blob id holding this pool's roster. */
  rosterBlobId?: string;
  /** Walrus blob id holding this pool's matchday results. */
  matchdayBlobId?: string;
  /** Stringified u64 (Sui MIST). Surfaced from Convex so the pick page can
   * render the actual entry fee without round-tripping to Sui RPC. */
  entryFeeMist?: string;
}

/**
 * Hardcoded registry of pool metadata, keyed by slug. The Genesis (World Cup)
 * pool reads from env so the existing single-pool plumbing keeps working.
 * Other entries are "coming soon" placeholders.
 *
 * When Convex lands, this becomes a Convex query — call sites stay the same.
 */
export const POOLS: Record<string, PoolMeta> = {
  "genesis-wc": {
    slug: "genesis-wc",
    name: "Genesis · World Cup",
    season: "Season 0 · 2026",
    tagline:
      "Group Stage Matchday 1. Mexico vs South Africa, Estadio Azteca. 22 players, 22 AI-set targets. The Genesis pool that ships Gauntlet.",
    image: "/pools/genesis-wc-edited.jpg",
    imageOriginal: "/pools/genesis-wc-original.jpg",
    status: "live",
    tournament: "world-cup-2026",
    poolId: POOL_OBJECT_ID,
    rosterBlobId: ROSTER_BLOB_ID,
    matchdayBlobId: MATCHDAY_BLOB_ID,
  },
  "epl-weekly": {
    slug: "epl-weekly",
    name: "Premier League · Weekly",
    season: "Season 1 · Coming Soon",
    tagline:
      "Every Saturday matchday. Twenty teams, hundreds of players, a fresh AI roster per fixture window.",
    image: "/pools/epl-weekly-edited.jpg",
    imageOriginal: "/pools/epl-weekly-original.jpg",
    status: "soon",
  },
  "laliga-weekly": {
    slug: "laliga-weekly",
    name: "La Liga · Weekly",
    season: "Season 1 · Coming Soon",
    tagline:
      "Same survival mechanic, Spanish rotation. Hand-built derbies, no FOMO across Sundays.",
    image: "/pools/laliga-weekly-edited.jpg",
    imageOriginal: "/pools/laliga-weekly-original.jpg",
    status: "soon",
  },
  "ucl-nights": {
    slug: "ucl-nights",
    name: "Champions League · Nights",
    season: "Season 1 · Coming Soon",
    tagline:
      "Tuesday and Wednesday under the lights. Shorter, sharper pools that resolve before the second leg.",
    image: "/pools/ucl-nights-edited.jpg",
    imageOriginal: "/pools/ucl-nights-original.jpg",
    status: "soon",
  },
};

export const POOL_LIST: PoolMeta[] = Object.values(POOLS);

export function getPool(slug: string): PoolMeta | null {
  return POOLS[slug] ?? null;
}
