"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRoster } from "@/lib/walrus";
import { ROSTER_BLOB_ID } from "@/lib/sui";

export function rosterKey(blobId: string) {
  return ["roster", blobId] as const;
}

/** Legacy static key for callers that haven't been migrated yet. */
export const ROSTER_KEY = rosterKey(ROSTER_BLOB_ID);

/**
 * Client-side roster fetch with react-query caching. Pass `blobId` to scope
 * to a specific pool's roster (recommended — pick / live / pass pages should
 * use the per-pool blob from PoolMeta). Falls back to the env default when
 * no arg is supplied so legacy call sites keep working.
 */
export function useRoster(blobId: string = ROSTER_BLOB_ID) {
  return useQuery({
    queryKey: rosterKey(blobId),
    enabled: !!blobId,
    queryFn: () => fetchRoster(blobId),
    staleTime: 5 * 60 * 1000,
  });
}
