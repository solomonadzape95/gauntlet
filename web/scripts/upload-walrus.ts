/**
 * Tiny Walrus publisher client. Used by seed scripts to upload roster /
 * matchday / matchday-live JSON blobs. The aggregator URL lives in
 * .env.local; the publisher needs `NEXT_PUBLIC_WALRUS_PUBLISHER`.
 */

const PUBLISHER =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ??
  process.env.WALRUS_PUBLISHER ??
  "https://publisher.walrus-testnet.walrus.space";

interface WalrusUploadResponse {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
}

export async function uploadJsonToWalrus(json: unknown, epochs = 5): Promise<string> {
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
