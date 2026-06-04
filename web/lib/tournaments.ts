/**
 * Tournament registry — groups one-or-many pools under a parent tournament.
 *
 * Day-5 scope: the World Cup 2026 group with one live matchday (Genesis MD1)
 * plus placeholder slots for upcoming matchdays. When a new matchday goes
 * live, register a new Pool object in `lib/pools.ts` and flip the slot's
 * `pool` + `status` fields here.
 *
 * Convex will replace this file when it lands — same call sites.
 */

import type { PoolMeta } from "./pools";
import { POOLS } from "./pools";

export type MatchdayStatus = "live" | "soon" | "done";

export interface MatchdaySlot {
  matchday: string;
  date: string; // ISO date, used for chronological sort
  /** Slug of the corresponding pool in `lib/pools.ts`. Null until that matchday has its own pool. */
  pool: string | null;
  status: MatchdayStatus;
  /** Optional fixture line shown on the schedule strip, e.g. "Mexico vs South Africa". */
  fixture?: string;
}

export interface Tournament {
  slug: string;
  name: string;
  tagline: string;
  schedule: MatchdaySlot[];
}

export const TOURNAMENTS: Record<string, Tournament> = {
  "world-cup-2026": {
    slug: "world-cup-2026",
    name: "FIFA World Cup 2026",
    tagline:
      "USA · Mexico · Canada. June 11 – July 19. 48 nations, one survival ladder.",
    schedule: [
      {
        matchday: "MD1",
        date: "2026-06-11",
        pool: "genesis-wc",
        status: "live",
        fixture: "Mexico vs South Africa · Estadio Azteca",
      },
      { matchday: "MD2", date: "2026-06-12", pool: null, status: "soon" },
      { matchday: "MD3", date: "2026-06-13", pool: null, status: "soon" },
      { matchday: "MD4", date: "2026-06-14", pool: null, status: "soon" },
      { matchday: "R16", date: "2026-06-29", pool: null, status: "soon" },
      { matchday: "QF",  date: "2026-07-09", pool: null, status: "soon" },
      { matchday: "SF",  date: "2026-07-14", pool: null, status: "soon" },
      { matchday: "F",   date: "2026-07-19", pool: null, status: "soon" },
    ],
  },
};

export const TOURNAMENT_LIST: Tournament[] = Object.values(TOURNAMENTS);

export function getTournament(slug: string): Tournament | null {
  return TOURNAMENTS[slug] ?? null;
}

/** Pools that belong to a tournament, in schedule order. */
export function poolsForTournament(t: Tournament): Array<{ slot: MatchdaySlot; pool?: PoolMeta }> {
  return t.schedule.map((slot) => ({
    slot,
    pool: slot.pool ? POOLS[slot.pool] : undefined,
  }));
}

/** Pools that aren't part of any tournament. Used by the "Other gauntlets" section. */
export function unaffiliatedPools(allPools: PoolMeta[]): PoolMeta[] {
  return allPools.filter((p) => !p.tournament);
}
