"use client";

import { useMemo } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { PACKAGE_ID, POOL_OBJECT_ID } from "@/lib/sui";

export function mintCountsKey(poolId: string) {
  return ["mint-counts", PACKAGE_ID, poolId] as const;
}

/** Back-compat for static-import call sites. Uses the env-default poolId. */
export const MINT_COUNTS_KEY = mintCountsKey(POOL_OBJECT_ID);

/**
 * Per-player mint counts, read from the Convex `passes` table (projected from
 * PassMinted events by the poller) rather than querying Sui RPC from every tab.
 * Reactive + free.
 */
export function useMintCounts(
  poolId: string = POOL_OBJECT_ID,
): Record<number, number> {
  const data = useConvexQuery(
    api.passes.countsByPool,
    convexConfigured && poolId !== "0x0" ? { poolObjectId: poolId } : "skip",
  ) as Record<string, number> | undefined;

  return useMemo(() => {
    if (!data) return {};
    const out: Record<number, number> = {};
    for (const [k, val] of Object.entries(data)) out[Number(k)] = val;
    return out;
  }, [data]);
}
