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

// ───── Weighted prize sharing ─────
// The pot is split among survivors in proportion to each pick's *weight*, where
// rarer survivals (lower likelihood) carry more weight — so beating long odds
// pays more than coasting on a safe pick. Weight = WEIGHT_SCALE / likelihood,
// rounded to an integer. These exact integers are what the admin pushes
// on-chain at pool creation (`create_pool`), so a Pass's on-chain weight always
// matches what this function computes from the same roster.

/** Fixed-point scale for integer weights pushed on-chain. */
export const WEIGHT_SCALE = 1_000_000;

/** Platform fee in basis points (1000 = 10%), mirrored from `pool.move`. */
export const PLATFORM_FEE_BPS = 1000;
const BPS_DENOM = 10000;

/** Inverse-likelihood share weight for a player. Higher = rarer survival = bigger slice. */
export function survivalWeight(difficulty: Difficulty): number {
  const likelihood = survivalLikelihood(difficulty);
  return Math.round(WEIGHT_SCALE / likelihood);
}

/**
 * Build the parallel (player_ids, weights) arrays that `create_pool` stores
 * on-chain, so a Pass's weight is admin-fixed from the roster and can't be
 * forged at mint time. Keeps the on-chain weights in lockstep with the UI.
 */
export function rosterWeightArgs(players: Player[]): {
  playerIds: number[];
  weights: bigint[];
} {
  return {
    playerIds: players.map((p) => p.id),
    weights: players.map((p) => BigInt(survivalWeight(p.difficulty))),
  };
}

/** Pot after the platform fee is skimmed — the amount survivors actually share. */
export function netPotMist(potMist: bigint): bigint {
  return (potMist * BigInt(BPS_DENOM - PLATFORM_FEE_BPS)) / BigInt(BPS_DENOM);
}

/** The platform fee taken from a pot. */
export function platformFeeMist(potMist: bigint): bigint {
  return (potMist * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_DENOM);
}

/**
 * Reconstruct the GROSS pot at settle from the post-fee snapshot
 * (`net_pot_mist`). The on-chain `cashout` drains the live pot as winners
 * claim, so reading `pot_mist` post-settle makes the "Prize Pool" appear to
 * shrink. `net_pot_mist` is frozen at settle; inverting the fee gives a stable
 * gross figure that matches the pre-settle pot semantics (modulo integer dust).
 */
export function grossPotFromNet(netPotMist: bigint): bigint {
  if (netPotMist <= 0n) return 0n;
  return (netPotMist * BigInt(BPS_DENOM)) / BigInt(BPS_DENOM - PLATFORM_FEE_BPS);
}

/**
 * Stable count of surviving PASSES, independent of cashout order. The on-chain
 * `alive_count` decrements on every cashout, so it can't be shown as the
 * settled "Survivors" figure. Mint counts and eliminations are both frozen
 * once the pool locks, so `total - Σ counts[eliminated]` never moves.
 */
export function settledSurvivorPasses(
  totalPasses: number,
  counts: Record<number, number>,
  eliminatedPlayerIds: number[],
): number {
  const out = new Set(eliminatedPlayerIds);
  let eliminatedPasses = 0;
  for (const [pid, c] of Object.entries(counts)) {
    if (out.has(Number(pid))) eliminatedPasses += c;
  }
  return Math.max(0, totalPasses - eliminatedPasses);
}

/**
 * Weighted per-pass payout: netPot * weight / survivingWeight. Mirrors the
 * on-chain `cashout` math so the UI shows what actually lands in the wallet.
 */
export function weightedPayout(
  netPotMist: bigint,
  passWeight: number,
  survivingWeight: number,
): bigint {
  if (survivingWeight <= 0 || passWeight <= 0) return 0n;
  return (netPotMist * BigInt(passWeight)) / BigInt(survivingWeight);
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

/**
 * Settled-truth payout: pot / actual surviving pass count. Used post-settle
 * everywhere a real per-pass cashout amount needs to be shown.
 */
export function payoutActual(potMist: bigint, aliveCount: number): bigint {
  const denom = BigInt(Math.max(1, aliveCount));
  return potMist / denom;
}

/**
 * Worst-case per-pass payout for a single player: pot / picks-of-this-player.
 * Used on the live leaderboard to show "best case if only this player's
 * holders survive" — the only per-row number that's actually honest before
 * settle (every row used to show pot/estSurvivors, which sums to > pot).
 */
export function payoutBestCase(potMist: bigint, playerCount: number): bigint {
  if (playerCount <= 0) return potMist;
  return potMist / BigInt(playerCount);
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
