import type { Difficulty, Player } from "./types";

// Hand-tuned survival probability per AI tier, reflecting how brutal
// the target is. Production would derive these from historical performance.
const SURVIVAL_RATE: Record<Difficulty, number> = {
  star: 0.30,
  regular: 0.50,
  workhorse: 0.55,
  defender: 0.45,
  GK: 0.60,
};

export function survivalLikelihood(difficulty: Difficulty): number {
  return SURVIVAL_RATE[difficulty] ?? 0.5;
}

/**
 * Estimated number of survivors across the whole pool, weighted by
 * how many people picked each player and how likely that player is to hit.
 */
export function estimateSurvivorCount(
  players: Player[],
  counts: Record<number, number>,
): number {
  let est = 0;
  for (const p of players) {
    const c = counts[p.id] ?? 0;
    if (c > 0) est += c * survivalLikelihood(p.difficulty);
  }
  return Math.max(1, Math.round(est));
}

/**
 * Per-survivor payout = pot / estimated survivors. After settlement,
 * use the actual alive_count instead of the estimate.
 */
export function payoutIfSurvives(
  potMist: bigint,
  estSurvivors: number,
): bigint {
  if (estSurvivors === 0) return potMist;
  return potMist / BigInt(estSurvivors);
}

/** Expected value: likelihood * payout. Useful for comparison. */
export function expectedValueMist(
  player: Player,
  potMist: bigint,
  estSurvivors: number,
  entryFeeMist: bigint,
): bigint {
  const likelihood = survivalLikelihood(player.difficulty);
  const payout = payoutIfSurvives(potMist, estSurvivors);
  // Floating point math then back to bigint
  const evMist = Math.round(Number(payout) * likelihood - Number(entryFeeMist));
  return BigInt(evMist);
}
