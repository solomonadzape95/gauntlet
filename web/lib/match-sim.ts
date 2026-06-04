/**
 * Client-side match simulation. Given a Player and the elapsed time of the
 * sim, returns a synthetic "current value" toward their stat target so the
 * live UI can fill progress bars in a believable way without an oracle.
 *
 * The outcome (will-they-hit) is derived from the player's `difficulty` so
 * the demo always plays out plausibly: stars often miss brutal targets,
 * defenders often hold steady, workhorses are coin-flips. Reruns are
 * deterministic per (player.id, startedAt) so multiple tabs show the same
 * reveal.
 */

import type { Player, Difficulty } from "@/lib/types";

export const SIM_DURATION_MS = 60_000;

/** A simple seeded hash → [0, 1). Deterministic per player + sim run. */
function seededRandom(seed: number): number {
  let x = Math.sin(seed) * 10_000;
  x = x - Math.floor(x);
  return x;
}

/** Whether the player "will" hit their target this sim. Difficulty-biased. */
function willHit(player: Player, startedAt: number): boolean {
  const rand = seededRandom(player.id + startedAt);
  const baseSuccessRate: Record<Difficulty, number> = {
    star: 0.4,
    regular: 0.55,
    workhorse: 0.6,
    defender: 0.65,
    GK: 0.5,
  };
  const rate = baseSuccessRate[player.difficulty] ?? 0.5;
  return rand < rate;
}

/**
 * The total target threshold the player is trying to clear. Pulls from the
 * existing target shape (single threshold or multi-threshold metrics).
 */
function targetThreshold(player: Player): number {
  const t = player.target;
  return t.threshold ?? t.tackles_threshold ?? t.saves_threshold ?? t.passacc_threshold ?? 1;
}

/**
 * Final value the player will end up at after 60s. Slightly above target if
 * they're hitting, slightly below if they're missing.
 */
function finalValue(player: Player, startedAt: number): number {
  const target = targetThreshold(player);
  const hit = willHit(player, startedAt);
  const wobble = seededRandom(player.id * 7 + startedAt);
  if (hit) {
    return target + Math.max(0.1, wobble) * Math.max(1, target * 0.4);
  }
  return Math.max(0, target - Math.max(0.2, wobble) * Math.max(1, target * 0.6));
}

export interface SimSnapshot {
  /** Current synthetic value toward the target. */
  value: number;
  /** Target threshold for the player. */
  target: number;
  /** Progress as 0..1 (caps at 1.5 visually but UI clamps). */
  progress: number;
  /** Whether the player will end the sim above target. */
  willHit: boolean;
  /** Whether the sim has ended (elapsed >= duration). */
  done: boolean;
}

/**
 * Compute a per-player snapshot at a given elapsed time. Uses a curve where
 * the stat builds quickly in the first third, then settles toward the final
 * value — closer to real match dynamics than a flat ramp.
 */
export function simSnapshot(
  player: Player,
  elapsedMs: number,
  startedAt: number,
  durationMs = SIM_DURATION_MS,
): SimSnapshot {
  const target = targetThreshold(player);
  const final = finalValue(player, startedAt);
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  // Ease-out cubic — fast at the start, slow at the end
  const eased = 1 - Math.pow(1 - t, 3);
  const value = final * eased;
  const progress = target > 0 ? value / target : 0;
  const done = elapsedMs >= durationMs;
  return {
    value,
    target,
    progress,
    willHit: willHit(player, startedAt),
    done,
  };
}

/**
 * BroadcastChannel name shared by admin (publisher) + live page (subscriber).
 */
export const MATCH_SIM_CHANNEL = "gauntlet-match-sim";

/** A single scripted match event — goals, saves, cards, subs, etc. */
export interface MatchEvent {
  id: number;
  /** When the event fires in the (compressed) sim, in seconds from start. */
  t_sec: number;
  /** Narrative match minute the event happens at. */
  t_min: number;
  type:
    | "kickoff"
    | "goal"
    | "save"
    | "yellow_card"
    | "red_card"
    | "substitution"
    | "halftime"
    | "fulltime";
  team?: string;
  player_id?: number;
  assist_player_id?: number;
  off_player_id?: number;
  score?: { home: number; away: number };
  description: string;
}

/** Match-events doc loaded from /public/data/<...>.json. */
export interface MatchEventsDoc {
  schema_version: number;
  tournament: string;
  matchday: string;
  fixture: {
    id?: number;
    home: string;
    away: string;
    venue?: string;
    kickoff_utc?: string;
  };
  final_score: { home: number; away: number; label?: string };
  winner?: string;
  duration_sec: number;
  events: MatchEvent[];
  results: Array<{
    player_id: number;
    name: string;
    team?: string;
    stats: Record<string, number>;
    hit_target: boolean;
    verdict: string;
  }>;
  eliminated_player_ids: number[];
  survivor_player_ids: number[];
}

/**
 * BroadcastChannel message envelope. "start" / "stop" keep the legacy
 * synthetic-progress flow alive; "event" carries a single scripted
 * MatchEvent fired by the scheduler below.
 */
export type MatchSimEvent =
  | { type: "start"; poolId: string; startedAt: number; durationMs?: number }
  | { type: "stop"; poolId: string; startedAt: number }
  | {
      type: "event";
      poolId: string;
      startedAt: number;
      event: MatchEvent;
    };

/**
 * Schedule a scripted match for playback. Posts a `start` message immediately
 * then queues a `setTimeout` per event to post it at its `t_sec` time. Returns
 * an abort handle that cancels all pending timers and emits a `stop` message.
 *
 * Speed multiplier lets the admin slow things down (0.5x) or speed up (2x)
 * for demos that need to fit a specific window.
 */
export function scheduleMatchEvents(
  doc: MatchEventsDoc,
  poolId: string,
  startedAt: number,
  opts: {
    /** Sim speed; 1 = real, 2 = 2x faster, 0.5 = half speed. */
    speed?: number;
    /** Per-event callback so the publisher tab can also reflect progress. */
    onEvent?: (event: MatchEvent) => void;
    /** Called when the schedule reaches its final event. */
    onComplete?: () => void;
  } = {},
): { abort: () => void } {
  if (typeof window === "undefined") return { abort: () => {} };
  const { speed = 1, onEvent, onComplete } = opts;
  const ch = new BroadcastChannel(MATCH_SIM_CHANNEL);
  const timers: ReturnType<typeof setTimeout>[] = [];

  ch.postMessage({
    type: "start",
    poolId,
    startedAt,
    durationMs: (doc.duration_sec * 1000) / speed,
  } satisfies MatchSimEvent);

  for (const event of doc.events) {
    const delay = (event.t_sec * 1000) / speed;
    const t = setTimeout(() => {
      ch.postMessage({
        type: "event",
        poolId,
        startedAt,
        event,
      } satisfies MatchSimEvent);
      onEvent?.(event);
      if (event.type === "fulltime") onComplete?.();
    }, delay);
    timers.push(t);
  }

  return {
    abort: () => {
      timers.forEach(clearTimeout);
      ch.postMessage({
        type: "stop",
        poolId,
        startedAt,
      } satisfies MatchSimEvent);
      ch.close();
    },
  };
}

/** Convenience loader for fetching a match-events doc from /public/data. */
export async function fetchMatchEventsDoc(
  path: string,
): Promise<MatchEventsDoc> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load match events from ${path}: ${res.status}`);
  }
  return (await res.json()) as MatchEventsDoc;
}
