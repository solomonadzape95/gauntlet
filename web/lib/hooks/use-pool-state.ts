"use client";

import { useMemo } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { POOL_OBJECT_ID } from "@/lib/sui";

export function poolStateKey(poolId: string) {
  return ["pool-state", poolId] as const;
}

/** Back-compat for call sites that still import a static key. Uses the env-default poolId. */
export const POOL_STATE_KEY = poolStateKey(POOL_OBJECT_ID);

export interface PoolState {
  admin: string;
  treasury: string;
  fee_bps: number;
  entry_fee_mist: bigint;
  pot_mist: bigint;
  /** Post-fee pot snapshot, set at settle. 0 before settle. */
  net_pot_mist: bigint;
  /** Summed weight of surviving passes, set at settle. The payout denominator. */
  surviving_weight: number;
  total_weight: number;
  total_passes: number;
  alive_count: number;
  phase: number;
  roster_blob_id: number[];
  matchday_blob_id: number[];
  eliminated_players: number[];
}

export const PHASE_LABEL: Record<number, string> = {
  0: "OPEN",
  1: "LOCKED",
  2: "SETTLED",
  3: "CLOSED",
};

export const PHASE_DOT: Record<
  number,
  "open" | "locked" | "settled" | "closed"
> = {
  0: "open",
  1: "locked",
  2: "settled",
  3: "closed",
};

interface PoolStateRow {
  admin: string;
  treasury: string;
  feeBps: number;
  entryFeeMist: string;
  potMist: string;
  netPotMist: string;
  totalPasses: number;
  aliveCount: number;
  survivingWeight: number;
  totalWeight: number;
  phase: number;
  eliminatedPlayers: number[];
}

function mapRow(row: PoolStateRow): PoolState {
  return {
    admin: row.admin,
    treasury: row.treasury,
    fee_bps: row.feeBps,
    entry_fee_mist: BigInt(row.entryFeeMist),
    pot_mist: BigInt(row.potMist),
    net_pot_mist: BigInt(row.netPotMist),
    surviving_weight: row.survivingWeight,
    total_weight: row.totalWeight,
    total_passes: row.totalPasses,
    alive_count: row.aliveCount,
    phase: row.phase,
    roster_blob_id: [],
    matchday_blob_id: [],
    eliminated_players: row.eliminatedPlayers ?? [],
  };
}

/**
 * Pool state, read from the Convex `poolStates` cache (refreshed server-side
 * every 30s + on demand) — NOT from Sui RPC. This keeps every browser tab off
 * the rate-limited RPC gateway. Returns `{ data, isLoading }` so existing
 * call sites are unchanged.
 */
export function usePoolState(poolId: string = POOL_OBJECT_ID) {
  const row = useConvexQuery(
    api.poolStates.forPool,
    convexConfigured && poolId !== "0x0" ? { poolObjectId: poolId } : "skip",
  ) as PoolStateRow | null | undefined;

  const data = useMemo<PoolState | null | undefined>(() => {
    if (row === undefined) return undefined;
    if (row === null) return null;
    return mapRow(row);
  }, [row]);

  return { data, isLoading: poolId !== "0x0" && row === undefined };
}
