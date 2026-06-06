import type { RosterData, MatchdayData } from "./types";

// Must match the network the blobs were PUBLISHED to (see the upload route).
// Defaults to testnet to pair with the free testnet publisher; override with
// NEXT_PUBLIC_WALRUS_AGGREGATOR if you publish to mainnet.
const AGGREGATOR =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ??
  "https://aggregator.walrus-testnet.walrus.space";

export function walrusUrl(blobId: string) {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

export async function fetchRoster(blobId: string): Promise<RosterData> {
  const res = await fetch(walrusUrl(blobId), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Walrus roster fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMatchday(blobId: string): Promise<MatchdayData> {
  const res = await fetch(walrusUrl(blobId), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Walrus matchday fetch failed: ${res.status}`);
  return res.json();
}
