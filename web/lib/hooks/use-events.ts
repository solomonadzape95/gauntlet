"use client";

import { useMemo } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
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

interface EventRow {
  type: string;
  txDigest: string;
  eventSeq: string;
  timestampMs: number;
  sender: string;
  payload: Record<string, unknown>;
}

/**
 * Pool events, newest first — read from the Convex `events` table (populated by
 * the 30s poller) instead of querying Sui RPC from every browser tab. Sim:*
 * playback rows are filtered out. Returns `{ data }` to match call sites.
 */
export function useEvents(limit = 50, poolId: string = POOL_OBJECT_ID) {
  const rows = useConvexQuery(
    api.events.recent,
    convexConfigured
      ? poolId && poolId !== "0x0"
        ? { poolObjectId: poolId, limit }
        : { limit }
      : "skip",
  ) as EventRow[] | undefined;

  const data = useMemo<PoolEvent[] | undefined>(() => {
    if (rows === undefined) return undefined;
    return rows
      .filter((r) => !r.type.startsWith("Sim:"))
      .map((r) => ({
        type: r.type as EventType,
        txDigest: r.txDigest,
        eventSeq: r.eventSeq,
        timestampMs: r.timestampMs,
        sender: r.sender,
        data: r.payload ?? {},
      }));
  }, [rows]);

  return { data, isLoading: rows === undefined };
}
