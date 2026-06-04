import type { NextRequest } from "next/server";

import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BrokerMessage {
  role: "user" | "assistant";
  content: string;
}

interface BrokerContext {
  poolPhase?: number;
  potSui?: string;
  totalMints?: number;
  alive?: number;
  myPlayerIds?: number[];
  pickCounts?: Record<number, number>;
  roster: Pick<
    Player,
    "id" | "name" | "team" | "club" | "position" | "difficulty" | "target" | "ai_rationale"
  >[];
}

interface BrokerRequest {
  messages: BrokerMessage[];
  context: BrokerContext;
}

/**
 * Model-fallback chain — lite goes first because it's smaller and less in-
 * demand during spikes, then the regular model, then the older GA model.
 * Same approach as the seed-roster script.
 */
const DEFAULT_MODEL_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

function geminiStreamUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
}

function isTransient(status: number): boolean {
  return status === 503 || status === 429 || status === 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const SYSTEM_PROMPT = `You are the AI Game Master for Gauntlet — a survival pool dApp on Sui where players mint a Survival Pass tied to one footballer. If that footballer hits the stat target you set for them in the real-world match, the pass survives; otherwise it burns.

Your job is to advise the user on **which player to back**. You know:
- The current roster (16 players, each with a position, difficulty tier, stat target, and the rationale you wrote when you assigned the target).
- The current pool state (phase, pot size, total mints, alive count) and how many people have already minted each player.
- Which player IDs the user already owns.

Rules of engagement:
- Be sharp and concise. No hedging filler. Football-fan voice, not a corporate assistant.
- Ground every recommendation in the data you were given. Quote the target text and counts.
- Surface the **contrarian / asymmetric** play when warranted — fewer picks on a likely-to-hit target means a fatter share.
- If the user asks something off-topic, redirect them politely back to picks.
- Never invent stats. If you don't know, say "I don't know — check the live page".
- When recommending a player, refer to them by name AND quote their target.
- Keep responses under ~200 words unless the user explicitly asks for depth.`;

function buildContextBlock(ctx: BrokerContext): string {
  const lines: string[] = [];
  lines.push("# Current pool state");
  lines.push(`- Phase: ${phaseName(ctx.poolPhase ?? 0)}`);
  lines.push(`- Pot: ${ctx.potSui ?? "0"} SUI`);
  lines.push(`- Mints so far: ${ctx.totalMints ?? 0}`);
  lines.push(`- Alive: ${ctx.alive ?? 0}`);
  if (ctx.myPlayerIds && ctx.myPlayerIds.length > 0) {
    lines.push(`- User already holds player IDs: [${ctx.myPlayerIds.join(", ")}]`);
  } else {
    lines.push(`- User has not minted any passes yet.`);
  }

  lines.push("");
  lines.push("# Roster");
  for (const p of ctx.roster) {
    const count = ctx.pickCounts?.[p.id] ?? 0;
    lines.push(
      `- [#${p.id}] ${p.name} (${p.team} · ${p.club} · ${p.position}) — tier:${p.difficulty} — target: "${p.target.human}" — picks-so-far:${count}`,
    );
    if (p.ai_rationale) {
      lines.push(`    rationale: ${p.ai_rationale}`);
    }
  }

  return lines.join("\n");
}

function phaseName(phase: number): string {
  switch (phase) {
    case 0:
      return "OPEN (minting)";
    case 1:
      return "LOCKED (awaiting matchday)";
    case 2:
      return "SETTLED (cashout window)";
    case 3:
      return "CLOSED";
    default:
      return "unknown";
  }
}

export async function POST(req: NextRequest) {
  let body: BrokerRequest;
  try {
    body = (await req.json()) as BrokerRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("messages required", { status: 400 });
  }
  if (!body.context || !Array.isArray(body.context.roster)) {
    return new Response("context.roster required", { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return streamFallback(body);
  }

  const contextBlock = buildContextBlock(body.context);

  // Gemini expects a single `systemInstruction` + alternating user/model contents.
  const contents = body.messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      // Inject the context into the first user message so it travels with the convo
      // without bloating the systemInstruction (which is cheaper-cached but immutable).
      i === 0 && m.role === "user"
        ? { text: `${contextBlock}\n\n---\n\nUser: ${m.content}` }
        : { text: m.content },
    ],
  }));

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  });

  // Optional ?model= override (comma-separated) — useful for testing one
  // model in isolation. Falls back to the default chain.
  const url = new URL(req.url);
  const modelParam = url.searchParams.get("model");
  const chain = modelParam
    ? modelParam.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_MODEL_CHAIN;

  // Walk the chain, retrying transient errors once per model. Stream only
  // starts after a successful fetch — failed attempts never touch the body.
  let lastError: { status: number; detail: string; model: string } | null = null;
  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const upstream = await fetch(geminiStreamUrl(model, apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (upstream.ok && upstream.body) {
        return new Response(reencodeSseToText(upstream.body), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Broker-Source": model,
          },
        });
      }

      const detail = await upstream.text().catch(() => "(no body)");
      lastError = { status: upstream.status, detail: detail.slice(0, 400), model };

      if (isTransient(upstream.status) && attempt === 1) {
        await sleep(2000);
        continue;
      }
      // Either non-transient (won't help by trying again) or already retried
      // — fall through to the next model. Both cases break out of the inner loop.
      break;
    }
  }

  // Every model in the chain failed. Fall back to the deterministic responder
  // so the UI still shows something useful rather than a 502.
  console.warn(
    `[ai-broker] All Gemini models failed (${chain.join(", ")}). Last error: ${lastError?.status} ${lastError?.detail?.slice(0, 120)}`,
  );
  return streamFallback(body);
}

/**
 * Pipe Gemini's SSE response body through a transform that pulls out the
 * `parts[].text` fields and re-emits them as bare text chunks for the client.
 * Extracted from inline ReadableStream so the retry path can call it cleanly.
 */
function reencodeSseToText(upstreamBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const json = trimmed.slice(5).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const obj = JSON.parse(json);
              const text =
                obj?.candidates?.[0]?.content?.parts
                  ?.map((p: { text?: string }) => p.text ?? "")
                  .join("") ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (e) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });
}

/**
 * Deterministic fallback used when GEMINI_API_KEY is not set. Picks the highest-
 * tier player the user doesn't already own, quotes their target, and explains the
 * contrarian angle from pick counts.
 */
function streamFallback(body: BrokerRequest): Response {
  const ctx = body.context;
  const owned = new Set(ctx.myPlayerIds ?? []);
  const sorted = [...ctx.roster].sort((a, b) => {
    const tierOrder: Record<string, number> = {
      star: 5,
      regular: 4,
      workhorse: 3,
      defender: 2,
      GK: 1,
    };
    const ta = tierOrder[a.difficulty] ?? 0;
    const tb = tierOrder[b.difficulty] ?? 0;
    if (ta !== tb) return tb - ta;
    const ca = ctx.pickCounts?.[a.id] ?? 0;
    const cb = ctx.pickCounts?.[b.id] ?? 0;
    return ca - cb;
  });
  const pick = sorted.find((p) => !owned.has(p.id)) ?? sorted[0];
  const count = ctx.pickCounts?.[pick.id] ?? 0;

  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const reply =
    `${pick.name} (${pick.team} · ${pick.position}) is my read. ` +
    `Target: "${pick.target.human}". ` +
    `Only ${count} pass${count === 1 ? "" : "es"} on him so far — if he hits, you cut the pot fewer ways. ` +
    `\n\n[Demo mode — GEMINI_API_KEY not set. Live chat will be sharper.] ` +
    `\n\nYou asked: "${lastUserMsg.slice(0, 120)}"`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      // simulate streaming by chunking words with a tiny delay
      const chunks = reply.split(/(\s+)/);
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Broker-Source": "fallback",
    },
  });
}
