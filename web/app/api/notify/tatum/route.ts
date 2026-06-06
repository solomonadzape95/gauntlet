import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUISCAN_BASE = "https://suiscan.xyz/mainnet";

/**
 * In-memory replay cache. Tatum sometimes redelivers events; we keep a sliding
 * window of (digest:seq) keys so we only ping Discord once per event.
 */
const SEEN = new Set<string>();
const SEEN_CAP = 500;

function remember(key: string): boolean {
  if (SEEN.has(key)) return true;
  SEEN.add(key);
  if (SEEN.size > SEEN_CAP) {
    // FIFO eviction — Sets preserve insertion order
    const oldest = SEEN.values().next().value;
    if (oldest) SEEN.delete(oldest);
  }
  return false;
}

interface NormalizedEvent {
  type: string;
  digest: string;
  seq: string;
  sender?: string;
  parsedJson?: Record<string, unknown>;
}

/**
 * Tatum's webhook payload shapes vary by subscription type. We try a few common
 * shapes, returning the bits we care about. Unknown payloads are passed through
 * with a fallback "raw" event.
 */
function normalize(raw: unknown): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Shape A: { type, data: { type, transactionDigest, eventSeq, sender, parsedJson } }
  const dataA = (obj.data ?? {}) as Record<string, unknown>;
  const typeA = (dataA.type as string) ?? (obj.eventType as string) ?? (obj.type as string);
  const digestA =
    (dataA.transactionDigest as string) ??
    (dataA.txDigest as string) ??
    (obj.txDigest as string) ??
    (obj.transactionDigest as string);
  const seqA = String((dataA.eventSeq as string | number) ?? (obj.eventSeq as string | number) ?? "0");
  const senderA = (dataA.sender as string) ?? (obj.sender as string);
  const parsedA = (dataA.parsedJson as Record<string, unknown>) ?? (obj.parsedJson as Record<string, unknown>);

  if (typeA && digestA) {
    return { type: typeA, digest: digestA, seq: seqA, sender: senderA, parsedJson: parsedA };
  }

  // Shape B (bare Sui event): { type, transactionDigest, eventSeq, parsedJson }
  if (obj.type && (obj.transactionDigest || obj.txDigest)) {
    return {
      type: String(obj.type),
      digest: String(obj.transactionDigest ?? obj.txDigest),
      seq: String(obj.eventSeq ?? "0"),
      sender: obj.sender as string | undefined,
      parsedJson: obj.parsedJson as Record<string, unknown>,
    };
  }

  return null;
}

/**
 * Convert a Move event type string into a short tail. `0x...::pool::PassMinted` → `PassMinted`.
 */
function shortType(t: string): string {
  const parts = t.split("::");
  return parts[parts.length - 1] ?? t;
}

function shortAddr(addr?: string, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function formatSuiMist(mist?: string | number): string {
  if (mist === undefined || mist === null) return "0";
  const n = typeof mist === "string" ? BigInt(mist) : BigInt(Math.floor(Number(mist)));
  const whole = n / 1_000_000_000n;
  const frac = n % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, "0").slice(0, 4).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  url?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

function buildEmbed(ev: NormalizedEvent): DiscordEmbed {
  const tail = shortType(ev.type);
  const url = `${SUISCAN_BASE}/tx/${ev.digest}`;
  const json = ev.parsedJson ?? {};

  switch (tail) {
    case "PassMinted": {
      const playerId = json.player_id;
      return {
        title: `🎟  Pass minted — player #${playerId ?? "?"}`,
        description: `New entry in the gauntlet.`,
        color: 0xf5ff00,
        url,
        fields: [
          { name: "Owner", value: shortAddr(json.owner as string), inline: true },
          { name: "Player", value: `#${playerId ?? "?"}`, inline: true },
        ],
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    }
    case "PoolLocked":
      return {
        title: "🔒  Pool locked",
        description: "Minting closed. Matchday is on deck.",
        color: 0xfacc15,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    case "PoolSettled": {
      const eliminated = (json.eliminated_player_ids as unknown[])?.length ?? 0;
      const survivors = json.survivors_count ?? json.survivor_count ?? "?";
      return {
        title: "⚖️  Matchday settled",
        description: `${eliminated} eliminated · ${survivors} survivors. Cashout window open.`,
        color: 0xf5ff00,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    }
    case "PassCashedOut": {
      const payout = json.payout_mist ?? json.payout ?? "0";
      return {
        title: `💰  Pass cashed out — ${formatSuiMist(payout as string)} SUI`,
        description: `Survivor took their share.`,
        color: 0x22c55e,
        url,
        fields: [
          { name: "Owner", value: shortAddr(json.owner as string), inline: true },
          { name: "Player", value: `#${json.player_id ?? "?"}`, inline: true },
        ],
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    }
    case "PassEliminated":
      return {
        title: `❌  Pass eliminated — player #${json.player_id ?? "?"}`,
        color: 0x71717a,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    case "PoolClosed":
      return {
        title: "🏁  Pool closed",
        description: "Final whistle. Unclaimed pot rolls forward.",
        color: 0x71717a,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    case "PoolCreated":
      return {
        title: "🆕  Pool created",
        description: `New shared object on mainnet.`,
        color: 0xf5ff00,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
    default:
      return {
        title: `📡  ${tail}`,
        color: 0x52525b,
        url,
        footer: { text: ev.digest.slice(0, 18) + "…" },
      };
  }
}

async function forwardToDiscord(embed: DiscordEmbed): Promise<{ ok: boolean; status: number }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { ok: false, status: 0 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Gauntlet",
      embeds: [embed],
    }),
  });
  return { ok: res.ok, status: res.status };
}

export async function POST(req: NextRequest) {
  // Optional shared-secret check — set TATUM_NOTIFY_SECRET and configure Tatum
  // to send it as an `X-Notify-Secret` header.
  const secret = process.env.TATUM_NOTIFY_SECRET;
  if (secret) {
    const got = req.headers.get("x-notify-secret");
    if (got !== secret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Tatum sometimes posts an array of events.
  const events = Array.isArray(body) ? body : [body];

  let delivered = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of events) {
    const ev = normalize(raw);
    if (!ev) {
      skipped++;
      continue;
    }
    const key = `${ev.digest}:${ev.seq}`;
    if (remember(key)) {
      skipped++;
      continue;
    }
    try {
      const embed = buildEmbed(ev);
      const res = await forwardToDiscord(embed);
      if (res.ok) delivered++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, delivered, skipped, failed }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// A small GET so you can sanity-check the route exists in a browser without
// triggering a webhook delivery.
export async function GET() {
  const configured = Boolean(process.env.DISCORD_WEBHOOK_URL);
  return new Response(
    JSON.stringify({
      route: "/api/notify/tatum",
      method: "POST",
      configured,
      hint: configured
        ? "Discord webhook URL is set."
        : "Set DISCORD_WEBHOOK_URL in .env.local to enable forwarding.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
