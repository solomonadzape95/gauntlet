import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function upstreamUrl(): string {
  // Server-only env first (recommended — keeps the Tatum key off the wire).
  // NEXT_PUBLIC_* fallback for compatibility with existing .env.local files.
  return (
    process.env.TATUM_SUI_TESTNET_RPC ??
    process.env.NEXT_PUBLIC_TATUM_SUI_TESTNET_RPC ??
    "https://fullnode.testnet.sui.io:443"
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = upstreamUrl();

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: `RPC proxy error: ${message}` },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Friendly response for accidental browser GETs.
export async function GET() {
  return new Response(
    "Sui RPC proxy. POST JSON-RPC requests here.",
    { status: 200, headers: { "Content-Type": "text/plain" } },
  );
}
