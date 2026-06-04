"use client";

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, POOL_OBJECT_ID } from "@/lib/sui";

export function eventsKey(poolId: string) {
  return ["pool-events", PACKAGE_ID, poolId] as const;
}

/** Back-compat for static-import call sites. Uses the env-default poolId. */
export const EVENTS_KEY = eventsKey(POOL_OBJECT_ID);

export type EventType =
  | "PoolCreated"
  | "PassMinted"
  | "PoolLocked"
  | "PoolSettled"
  | "PassCashedOut"
  | "PassEliminated"
  | "PoolClosed";

export interface PoolEvent {
  type: EventType;
  txDigest: string;
  eventSeq: string;
  timestampMs: number;
  sender: string;
  data: Record<string, unknown>;
}

/**
 * Query all module-level events for a given pool, newest first.
 * Filters to events whose parsedJson.pool_id matches `poolId`.
 */
export function useEvents(limit = 50, poolId: string = POOL_OBJECT_ID) {
  const client = useSuiClient();

  return useQuery({
    queryKey: [...eventsKey(poolId), limit],
    enabled: PACKAGE_ID !== "0x0",
    queryFn: async (): Promise<PoolEvent[]> => {
      const result = await client.queryEvents({
        query: {
          MoveModule: { package: PACKAGE_ID, module: "pool" },
        },
        limit,
        order: "descending",
      });

      const events: PoolEvent[] = [];
      for (const ev of result.data) {
        const json = (ev.parsedJson ?? {}) as Record<string, unknown>;

        // If the event has a pool_id, filter to current pool. PoolCreated
        // has no pool_id key in our schema — we let it through.
        const evPoolId = json.pool_id;
        if (
          typeof evPoolId === "string" &&
          poolId !== "0x0" &&
          evPoolId !== poolId
        ) {
          continue;
        }

        const eventName = (ev.type.split("::").pop() ?? "") as EventType;

        events.push({
          type: eventName,
          txDigest: ev.id.txDigest,
          eventSeq: ev.id.eventSeq,
          timestampMs: Number(ev.timestampMs ?? 0),
          sender: ev.sender,
          data: json,
        });
      }

      return events;
    },
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
