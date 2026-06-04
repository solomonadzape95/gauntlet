"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, POOL_OBJECT_ID } from "@/lib/sui";

export function mintCountsKey(poolId: string) {
  return ["mint-counts", PACKAGE_ID, poolId] as const;
}

/** Back-compat for static-import call sites. Uses the env-default poolId. */
export const MINT_COUNTS_KEY = mintCountsKey(POOL_OBJECT_ID);

interface RawPassMinted {
  pool_id: string;
  pass_id: string;
  owner: string;
  player_id: string | number;
}

/**
 * Query all PassMinted events for the given pool and return a per-player count.
 * Polls every 30s; invalidate manually after a successful mint for instant UI feedback.
 */
export function useMintCounts(poolId: string = POOL_OBJECT_ID): Record<number, number> {
  const client = useSuiClient();

  const { data } = useQuery({
    queryKey: mintCountsKey(poolId),
    enabled: PACKAGE_ID !== "0x0" && poolId !== "0x0",
    queryFn: async (): Promise<Record<number, number>> => {
      const counts: Record<number, number> = {};
      let cursor: { txDigest: string; eventSeq: string } | null | undefined =
        null;

      // Cap pagination at 10 pages * 100 = 1000 events. More than enough for a hackathon pool.
      for (let i = 0; i < 10; i++) {
        const result = await client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::pool::PassMinted` },
          cursor,
          limit: 100,
        });

        for (const ev of result.data) {
          const json = ev.parsedJson as RawPassMinted | null;
          if (!json) continue;
          if (json.pool_id !== poolId) continue;
          const pid = Number(json.player_id);
          counts[pid] = (counts[pid] ?? 0) + 1;
        }

        if (!result.hasNextPage || !result.nextCursor) break;
        cursor = result.nextCursor;
      }

      return counts;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return data ?? {};
}
