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

// ── Read coalescing + micro-cache ───────────────────────────────────────────
// Every browser tab reads chain state through here, and React Query refetches
// the whole set on window focus — so identical reads stampede the RPC and trip
// its rate limit (429). We (a) coalesce concurrent identical reads into one
// upstream call and (b) cache the response for a few seconds. Per-instance
// memory only (Vercel functions don't share heap), but that's enough to flatten
// the focus burst + multi-tab duplication that causes the 429s.

const CACHE_TTL_MS = 4_000;
type Cached = { at: number; status: number; body: string; contentType: string };
const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<Cached>>();

/** Only idempotent reads are cacheable. Never cache execute/dryRun/devInspect. */
function cacheableMethod(method: unknown): boolean {
  return (
    typeof method === "string" &&
    (method.startsWith("sui_get") ||
      method.startsWith("suix_get") ||
      method === "suix_queryEvents" ||
      method === "sui_getChainIdentifier")
  );
}

function cacheKey(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return null; // batch — don't cache
    if (!cacheableMethod(parsed?.method)) return null;
    // Key on method + params only (ignore the request `id`, which varies).
    return JSON.stringify({ m: parsed.method, p: parsed.params ?? null });
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callUpstream(body: string): Promise<Cached> {
  const url = upstreamUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TATUM_API_KEY) headers["x-api-key"] = process.env.TATUM_API_KEY;

  // Retry once on 429 with a short backoff so a transient spike doesn't surface.
  let last: Cached | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const upstream = await fetch(url, { method: "POST", headers, body, cache: "no-store" });
    const text = await upstream.text();
    last = {
      at: Date.now(),
      status: upstream.status,
      body: text,
      contentType: upstream.headers.get("Content-Type") ?? "application/json",
    };
    if (upstream.status !== 429) break;
    if (attempt === 0) await sleep(450);
  }
  return last!;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const key = cacheKey(body);

  try {
    if (key) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return new Response(hit.body, {
          status: hit.status,
          headers: { "Content-Type": hit.contentType, "X-RPC-Cache": "hit" },
        });
      }
      // Coalesce concurrent identical reads into a single upstream request.
      let p = inflight.get(key);
      if (!p) {
        p = callUpstream(body).finally(() => inflight.delete(key));
        inflight.set(key, p);
      }
      const res = await p;
      if (res.status >= 200 && res.status < 300) cache.set(key, res);
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": res.contentType },
      });
    }

    const res = await callUpstream(body);
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": res.contentType },
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
  return new Response("Sui RPC proxy. POST JSON-RPC requests here.", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
