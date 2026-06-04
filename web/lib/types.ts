export type Difficulty = "star" | "regular" | "workhorse" | "defender" | "GK";

export interface PlayerTarget {
  metric: string;
  threshold?: number;
  tackles_threshold?: number;
  passacc_threshold?: number;
  saves_threshold?: number;
  human: string;
}

export interface Player {
  id: number;
  name: string;
  /** Team affiliation in *this* roster — for WC it's the country, for
   * Last Eleven it's the fictional team ("Phoenix XI" / "Eclipse XI"). */
  team: string;
  /** Real-world nationality, used to render the country flag independent of
   * `team`. Optional for back-compat; falls back to `team` when missing. */
  country?: string;
  club: string;
  position: string;
  /** Squad number — drives the jersey graphic. Optional for back-compat with seed-v1. */
  number?: number;
  /** Age in years. Optional for back-compat with seed-v1. */
  age?: number;
  /**
   * Optional player image (portrait / headshot / generated art). Public-relative
   * path served by Next.js, e.g. "/players/01-courtois.jpg". When missing or
   * the file 404s, the player card falls back to the per-country jersey PNG,
   * then to the procedural <Jersey/> SVG.
   */
  image?: string;
  difficulty: Difficulty;
  target: PlayerTarget;
  ai_rationale: string;
}

export interface FixtureMeta {
  id: number;
  venue: string;
  kickoff_utc: string;
  home: string;
  away: string;
}

export interface RosterData {
  schema_version: number;
  tournament: string;
  matchday: string;
  /** Present from schema_version 2 onwards — describes the real-world match. */
  fixture?: FixtureMeta;
  ai_game_master: string;
  players: Player[];
}

export interface MatchdayResult {
  player_id: number;
  name: string;
  stats: Record<string, number>;
  hit_target: boolean;
  verdict: string;
}

export interface MatchdayData {
  schema_version: number;
  matchday: string;
  fixtures: Array<{ home: string; away: string; score: string }>;
  results: MatchdayResult[];
  eliminated_player_ids: number[];
  survivor_player_ids: number[];
}
