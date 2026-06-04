"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { POOL_OBJECT_ID } from "@/lib/sui";

export function poolStateKey(poolId: string) {
  return ["pool-state", poolId] as const;
}

/** Back-compat for call sites that still import a static key. Uses the env-default poolId. */
export const POOL_STATE_KEY = poolStateKey(POOL_OBJECT_ID);

export interface PoolState {
  admin: string;
  entry_fee_mist: bigint;
  pot_mist: bigint;
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

/**
 * Read a Pool shared object from chain. Defaults to the singleton pool from
 * env (POOL_OBJECT_ID). Pass `poolId` to scope to a specific Pool — used by
 * pool-scoped pages like /pools/[slug]/live.
 */
export function usePoolState(poolId: string = POOL_OBJECT_ID) {
  const client = useSuiClient();

  return useQuery({
    queryKey: poolStateKey(poolId),
    enabled: poolId !== "0x0",
    queryFn: async (): Promise<PoolState | null> => {
      const obj = await client.getObject({
        id: poolId,
        options: { showContent: true },
      });

      const content = obj.data?.content;
      if (content?.dataType !== "moveObject") return null;
      const f = content.fields as Record<string, unknown>;

      const pot = f.pot as { fields?: { value?: string } } | string | undefined;
      const potValue =
        typeof pot === "object" && pot?.fields?.value
          ? pot.fields.value
          : typeof pot === "string"
            ? pot
            : "0";

      return {
        admin: String(f.admin ?? ""),
        entry_fee_mist: BigInt(String(f.entry_fee_mist ?? "0")),
        pot_mist: BigInt(potValue),
        total_passes: Number(f.total_passes ?? 0),
        alive_count: Number(f.alive_count ?? 0),
        phase: Number(f.phase ?? 0),
        roster_blob_id: (f.roster_blob_id as number[]) ?? [],
        matchday_blob_id: (f.matchday_blob_id as number[]) ?? [],
        eliminated_players:
          ((f.eliminated_players as Array<string | number>) ?? []).map(Number),
      };
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
