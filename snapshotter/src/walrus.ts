const PUBLISHER = process.env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space";

export interface UploadResult {
  blobId: string;
  raw: unknown;
}

export async function uploadToWalrus(bytes: Buffer, epochs = 5): Promise<UploadResult> {
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    body: bytes,
  });
  if (!res.ok) throw new Error(`Walrus PUT failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as Record<string, unknown>;

  const blobId =
    (json as any)?.newlyCreated?.blobObject?.blobId ??
    (json as any)?.alreadyCertified?.blobId;
  if (!blobId) throw new Error(`Walrus response missing blobId: ${JSON.stringify(json)}`);

  return { blobId, raw: json };
}
