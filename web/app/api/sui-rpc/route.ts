import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function upstreamUrl(): string {
  // MAINNET. Server-only env first (keeps any provider key off the wire).
  // Set SUI_RPC_URL to a mainnet endpoint (public fullnode, or a Tatum/QuickNode
  // mainnet gateway). Falls back to the public mainnet fullnode.
  return (
    process.env.SUI_RPC_URL ??
    process.env.TATUM_SUI_MAINNET_RPC ??
    "https://fullnode.mainnet.sui.io:443"
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
