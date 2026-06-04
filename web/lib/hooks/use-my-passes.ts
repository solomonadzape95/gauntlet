"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "@/lib/sui";

export interface MyPass {
  id: string;
  pool_id: string;
  player_id: number;
  minted_at_ms: bigint;
}

export const MY_PASSES_KEY = (addr: string | undefined) => [
  "my-passes",
  PACKAGE_ID,
  addr,
];

/**
 * Returns all Survival Pass objects owned by the connected wallet, across pools.
 * Sorted newest-first.
 */
export function useMyPasses() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: MY_PASSES_KEY(account?.address),
    enabled: !!account && PACKAGE_ID !== "0x0",
    queryFn: async (): Promise<MyPass[]> => {
      if (!account) return [];

      const passes: MyPass[] = [];
      let cursor: string | null | undefined = null;

      for (let i = 0; i < 5; i++) {
        const result = await client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${PACKAGE_ID}::pool::Pass` },
          options: { showContent: true },
          cursor,
          limit: 50,
        });

        for (const item of result.data) {
          const obj = item.data;
          if (!obj) continue;
          const content = obj.content;
          if (content?.dataType !== "moveObject") continue;
          const f = content.fields as Record<string, unknown>;
          passes.push({
            id: obj.objectId,
            pool_id: String(f.pool_id ?? ""),
            player_id: Number(f.player_id ?? 0),
            minted_at_ms: BigInt(String(f.minted_at_ms ?? "0")),
          });
        }

        if (!result.hasNextPage || !result.nextCursor) break;
        cursor = result.nextCursor;
      }

      passes.sort((a, b) => Number(b.minted_at_ms - a.minted_at_ms));
      return passes;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
