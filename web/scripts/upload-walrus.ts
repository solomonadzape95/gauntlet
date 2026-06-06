/**
 * Tiny Walrus publisher client. Used by seed scripts to upload roster /
 * matchday / matchday-live JSON blobs. The publisher comes from
 * `NEXT_PUBLIC_WALRUS_PUBLISHER` (set in .env.local), defaulting to MAINNET.
 *
 * Resolved lazily (inside the call), NOT at module load — the seed scripts run
 * loadDotEnv() inside main() AFTER importing this module, so reading
 * process.env at import time would always miss .env.local and use the fallback.
 */

function publisherUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ??
    process.env.WALRUS_PUBLISHER ??
    "https://publisher.walrus-mainnet.walrus.space"
  );
}

interface WalrusUploadResponse {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
}

export async function uploadJsonToWalrus(json: unknown, epochs = 5): Promise<string> {
  const PUBLISHER = publisherUrl();
  const body = JSON.stringify(json);
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Walrus upload failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as WalrusUploadResponse;
  const blobId = data.newlyCreated?.blobObject.blobId ?? data.alreadyCertified?.blobId;
  if (!blobId) {
    throw new Error(`Walrus response missing blobId: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return blobId;
}
