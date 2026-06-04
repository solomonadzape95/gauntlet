"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";

export const PASS_KEY = (id: string) => ["pass", id];

export interface PassObject {
  pool_id: string;
  player_id: number;
  minted_at_ms: bigint;
  owner: string;
}

export function usePass(passId: string) {
  const client = useSuiClient();

  return useQuery({
    queryKey: PASS_KEY(passId),
    enabled: !!passId,
    queryFn: async (): Promise<PassObject | null> => {
      try {
        const obj = await client.getObject({
          id: passId,
          options: { showContent: true, showOwner: true },
        });

        const content = obj.data?.content;
        if (content?.dataType !== "moveObject") return null;
        const f = content.fields as Record<string, unknown>;

        const owner = obj.data?.owner;
        let ownerAddr = "unknown";
        if (
          owner &&
          typeof owner === "object" &&
          "AddressOwner" in owner &&
          typeof owner.AddressOwner === "string"
        ) {
          ownerAddr = owner.AddressOwner;
        }

        return {
          pool_id: String(f.pool_id ?? ""),
          player_id: Number(f.player_id ?? 0),
          minted_at_ms: BigInt(String(f.minted_at_ms ?? "0")),
          owner: ownerAddr,
        };
      } catch (e) {
        // 404 / object deleted → return null so the UI can render "not found"
        return null;
      }
    },
    refetchInterval: 10_000,
  });
}
