/**
 * Per-endpoint cache TTL config for API-Football. One source of truth.
 *
 * Rule of thumb when adding a new endpoint:
 *   - Pick the LONGEST TTL the data could conceivably tolerate.
 *   - Trust upstream `cache_until` / `Last-Modified` over these defaults when present.
 *   - Use FOREVER for genuinely immutable data (finalized match results).
 *   - Use 0 (or skip caching) for live data that updates per-second.
 */

const SECOND = 1;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TTL = {
  /** Team metadata (id, name, crest URL) — effectively never changes. */
  teams: 30 * DAY,

  /** Player profile (age, club, nationality). Changes per transfer window or birthday. */
  players: 30 * DAY,

  /** Current squad rosters. Shift per international window (~8x/year). */
  squads: 7 * DAY,

  /** Fixtures (kickoff times, venues). Stable once announced, but can shift. */
  fixtures: 1 * DAY,

  /** Finalized post-match player stats. Immutable. */
  matchResults: FOREVER(),

  /** Per-second live match events. Skip cache. */
  liveEvents: 5 * SECOND,
} as const;

export type TtlSeconds = number;

export function FOREVER(): TtlSeconds {
  return -1;
}
