import { NextResponse } from "next/server";

/**
 * Server-side Walrus PUT proxy. Browser uploads a JSON payload to this route;
 * the route forwards it to the configured Walrus publisher and returns the
 * blob ID. Keeps the publisher URL out of the client bundle and avoids any
 * CORS surprises when the publisher tightens up.
 */

// NOTE: Walrus blobs are just roster/result JSON — independent of the Sui
// mainnet pool (no funds). Mysten runs NO free public mainnet publisher, so we
// default to the public TESTNET publisher (free + reliably certifies). For
// durable mainnet storage, run your own publisher and set WALRUS_PUBLISHER.
const PUBLISHER =
  process.env.WALRUS_PUBLISHER ??
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ??
  "https://publisher.walrus-testnet.walrus.space";

interface WalrusUploadResponse {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const epochs = Number(url.searchParams.get("epochs") ?? "5");

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (e) {
    return NextResponse.json(
      { error: `Body must be valid JSON: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const body = JSON.stringify(payload);

  let res: Response;
  try {
    res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Publisher unreachable: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Walrus upload failed (${res.status})`,
        detail: detail.slice(0, 600),
      },
      { status: 502 },
    );
  }

  const data = (await res.json()) as WalrusUploadResponse;
  const blobId =
    data.newlyCreated?.blobObject.blobId ?? data.alreadyCertified?.blobId;

  if (!blobId) {
    return NextResponse.json(
      {
        error: `Walrus response missing blobId`,
        raw: JSON.stringify(data).slice(0, 600),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ blobId, size: body.length });
}
