"use node";

import { internalAction, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";

/**
 * Autonomous game loop. Drives each enrolled pool through its lifecycle by
 * SIGNING admin transactions on Sui mainnet:
 *
 *   OPEN  ──(now ≥ lastMint + lockDelay)──►  lock_pool
 *   LOCKED ──(+ simDelay)──►  Sim:start (users watch)
 *   SIM    ──(+ settleDelay)──►  generate results → Walrus → settle_pool
 *   SETTLED ──► spawn next matchday (same teams, fresh AI targets)
 *
 * Tick-driven (cron, ~30s) and idempotent: every step is gated on the live
 * on-chain phase, so a double-fire just aborts on-chain and is swallowed.
 * Never calls close_pool — settled pools stay open for withdrawals.
 *
 * Requires env (Convex prod + dev): ADMIN_PRIVATE_KEY (suiprivkey… of the pool
 * admin), GAUNTLET_PACKAGE_ID, SUI_RPC_URL (+ TATUM_API_KEY), GEMINI_API_KEY,
 * and the Walrus publisher/aggregator vars.
 */

const CLOCK_ID = "0x6";
const WEIGHT_SCALE = 1_000_000;
const SURVIVAL_RATE: Record<string, number> = {
  star: 0.3,
  regular: 0.5,
  workhorse: 0.55,
  defender: 0.45,
  GK: 0.6,
};
const likelihood = (d: string) => SURVIVAL_RATE[d] ?? 0.5;
const weightFor = (d: string) => Math.round(WEIGHT_SCALE / likelihood(d));

// ── Sui plumbing ────────────────────────────────────────────────────────────

function pkg(): string {
  const p = process.env.GAUNTLET_PACKAGE_ID;
  if (!p || p === "0x0") throw new Error("GAUNTLET_PACKAGE_ID not configured");
  return p;
}

function signer(): Ed25519Keypair {
  const pk = process.env.ADMIN_PRIVATE_KEY;
  if (!pk) throw new Error("ADMIN_PRIVATE_KEY not set");
  const { secretKey } = decodeSuiPrivateKey(pk.trim());
  return Ed25519Keypair.fromSecretKey(secretKey);
}

function client(): SuiClient {
  const url = process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";
  const headers = process.env.TATUM_API_KEY
    ? { "x-api-key": process.env.TATUM_API_KEY }
    : undefined;
  return new SuiClient({
    transport: new SuiHTTPTransport({ url, ...(headers ? { rpc: { headers } } : {}) }),
  });
}

async function exec(c: SuiClient, kp: Ed25519Keypair, tx: Transaction) {
  const res = await c.signAndExecuteTransaction({ signer: kp, transaction: tx });
  await c.waitForTransaction({ digest: res.digest });
  const fx = await c.getTransactionBlock({
    digest: res.digest,
    options: { showEffects: true, showObjectChanges: true },
  });
  if (fx.effects?.status?.status !== "success") {
    throw new Error(`tx ${res.digest} failed: ${fx.effects?.status?.error ?? "?"}`);
  }
  return fx;
}

interface ChainPool {
  phase: number;
  total_passes: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a few times on rate-limit (429) with backoff — the shared gateway can
 *  throttle when browser traffic spikes. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/429|too many requests/i.test(msg)) throw e;
      await sleep(600 * (i + 1));
    }
  }
  throw lastErr;
}

async function readPool(c: SuiClient, poolId: string): Promise<ChainPool | null> {
  const obj = await withRetry(() =>
    c.getObject({ id: poolId, options: { showContent: true } }),
  );
  const content = obj.data?.content;
  if (content?.dataType !== "moveObject") return null;
  const f = content.fields as Record<string, unknown>;
  return {
    phase: Number(f.phase ?? 0),
    total_passes: Number(f.total_passes ?? 0),
  };
}

// ── Walrus ──────────────────────────────────────────────────────────────────

function aggregator(): string {
  return (
    process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR ??
    "https://aggregator.walrus-testnet.walrus.space"
  );
}
function publisher(): string {
  return (
    process.env.WALRUS_PUBLISHER ??
    process.env.NEXT_PUBLIC_WALRUS_PUBLISHER ??
    "https://publisher.walrus-testnet.walrus.space"
  );
}

async function walrusFetch<T>(blobId: string): Promise<T> {
  const res = await fetch(`${aggregator()}/v1/blobs/${blobId}`);
  if (!res.ok) throw new Error(`Walrus fetch ${blobId}: ${res.status}`);
  return (await res.json()) as T;
}

async function walrusUpload(json: unknown, epochs = 5): Promise<string> {
  const res = await fetch(`${publisher()}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
  if (!res.ok) throw new Error(`Walrus upload: ${res.status}`);
  const d = (await res.json()) as {
    newlyCreated?: { blobObject: { blobId: string } };
    alreadyCertified?: { blobId: string };
  };
  const id = d.newlyCreated?.blobObject.blobId ?? d.alreadyCertified?.blobId;
  if (!id) throw new Error("Walrus response missing blobId");
  return id;
}

// ── Roster / result types (subset of lib/types) ─────────────────────────────

interface Player {
  id: number;
  name: string;
  team: string;
  club?: string;
  position: string;
  number?: number;
  age?: number;
  difficulty: string;
  target?: { metric: string; human: string; threshold?: number };
  ai_rationale?: string;
}
interface Roster {
  schema_version?: number;
  tournament?: string;
  matchday?: string;
  fixture?: { home?: string; away?: string; venue?: string; kickoff_utc?: string };
  ai_game_master?: string;
  players: Player[];
}

// ── Gemini ──────────────────────────────────────────────────────────────────

const MODEL_CHAIN = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

async function gemini(systemPrompt: string, userPrompt: string, schema: unknown): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.6, responseMimeType: "application/json", responseSchema: schema },
  });
  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!res.ok) continue;
      const j = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      return JSON.parse(stripped);
    } catch {
      continue;
    }
  }
  return null;
}

// ── Result generation (who survives) ────────────────────────────────────────

interface MatchdayResults {
  schema_version: 2;
  matchday: string;
  fixtures: Array<{ home: string; away: string; score: string }>;
  results: Array<{ player_id: number; name: string; stats: Record<string, number>; hit_target: boolean; verdict: string }>;
  eliminated_player_ids: number[];
  survivor_player_ids: number[];
}

async function generateResults(roster: Roster): Promise<MatchdayResults> {
  const home = roster.fixture?.home ?? "Home";
  const away = roster.fixture?.away ?? "Away";
  const system = `You are the AI Game Master resolving ${home} vs ${away}. For each player decide hit_target (informed by difficulty: stars often miss brutal targets, defenders usually hold, GKs ~50/50). Roughly 50% survive. Output JSON with results[] (player_id, name, hit_target, verdict 5-12 words), eliminated_player_ids[], survivor_player_ids[], and fixtures[] with a plausible score.`;
  const user = `Roster:\n${roster.players.map((p) => `- player_id=${p.id} | ${p.name} (${p.team}, ${p.position}, difficulty=${p.difficulty}) target: ${p.target?.human ?? "?"}`).join("\n")}\nReturn ONLY the JSON object.`;
  const schema = {
    type: "OBJECT",
    properties: {
      fixtures: { type: "ARRAY", items: { type: "OBJECT", properties: { home: { type: "STRING" }, away: { type: "STRING" }, score: { type: "STRING" } } } },
      results: { type: "ARRAY", items: { type: "OBJECT", properties: { player_id: { type: "INTEGER" }, name: { type: "STRING" }, hit_target: { type: "BOOLEAN" }, verdict: { type: "STRING" } }, required: ["player_id", "name", "hit_target", "verdict"] } },
      eliminated_player_ids: { type: "ARRAY", items: { type: "INTEGER" } },
      survivor_player_ids: { type: "ARRAY", items: { type: "INTEGER" } },
    },
    required: ["results", "eliminated_player_ids", "survivor_player_ids"],
  };

  const ids = new Set(roster.players.map((p) => p.id));
  const ai = (await gemini(system, user, schema)) as Partial<MatchdayResults> | null;

  // Normalize + backfill so every roster player has a deterministic outcome
  // even if Gemini was unavailable or returned a partial answer.
  const surv = new Set<number>();
  const elim = new Set<number>();
  const results: MatchdayResults["results"] = [];
  const aiById = new Map<number, { hit_target?: boolean; verdict?: string; name?: string; stats?: Record<string, number> }>();
  for (const r of ai?.results ?? []) {
    const pid = Number((r as { player_id?: unknown }).player_id);
    if (ids.has(pid)) aiById.set(pid, r as { hit_target?: boolean; verdict?: string });
  }
  for (const p of roster.players) {
    const r = aiById.get(p.id);
    const hit = r ? !!r.hit_target : Math.random() < likelihood(p.difficulty);
    if (hit) surv.add(p.id);
    else elim.add(p.id);
    results.push({
      player_id: p.id,
      name: p.name,
      stats: r?.stats ?? {},
      hit_target: hit,
      verdict: r?.verdict ?? (hit ? `${p.name} hit their target.` : `${p.name} fell short.`),
    });
  }
  const fixtures = (ai?.fixtures && ai.fixtures.length > 0)
    ? ai.fixtures
    : [{ home, away, score: "1-1" }];

  return {
    schema_version: 2,
    matchday: roster.matchday ?? `${home} vs ${away}`,
    fixtures,
    results,
    eliminated_player_ids: [...elim],
    survivor_player_ids: [...surv],
  };
}

// ── Target generation (for the spawned matchday) ────────────────────────────

function deterministicTarget(d: string): { metric: string; human: string; threshold?: number } {
  switch (d) {
    case "GK": return { metric: "clean_sheet", threshold: 1, human: "Keep a clean sheet" };
    case "defender": return { metric: "clearances", threshold: 3, human: "3+ clearances" };
    case "workhorse": return { metric: "key_passes", threshold: 2, human: "2+ key passes" };
    case "star": return { metric: "goals_or_assists", threshold: 1, human: "Score or assist" };
    default: return { metric: "shots_on_target", threshold: 2, human: "2+ shots on target" };
  }
}

async function regenerateTargets(players: Player[], home: string, away: string): Promise<Player[]> {
  const system = `You are the AI Game Master setting one stat target each player must hit in ${home} vs ${away} to keep their pass alive. Stars get brutal targets, regulars reachable, workhorses effort metrics, defenders defensive, GKs clean-sheet/saves. Each plausible for one 90-min match. Return JSON array, one entry per input player_id (copied exactly), each with target {metric, human, threshold} and ai_rationale (1 sentence).`;
  const user = `Players:\n${players.map((p) => `- player_id=${p.id} | ${p.name} (${p.team}, ${p.position}, difficulty=${p.difficulty})`).join("\n")}\nReturn the JSON array.`;
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        player_id: { type: "INTEGER" },
        target: { type: "OBJECT", properties: { metric: { type: "STRING" }, human: { type: "STRING" }, threshold: { type: "INTEGER" } }, required: ["metric", "human"] },
        ai_rationale: { type: "STRING" },
      },
      required: ["player_id", "target", "ai_rationale"],
    },
  };
  const ai = (await gemini(system, user, schema)) as Array<{ player_id?: number; target?: { metric: string; human: string; threshold?: number }; ai_rationale?: string }> | null;
  const byId = new Map<number, { target?: { metric: string; human: string; threshold?: number }; ai_rationale?: string }>();
  for (const g of ai ?? []) {
    if (g && typeof g.player_id === "number") byId.set(Number(g.player_id), g);
  }
  return players.map((p) => {
    const g = byId.get(p.id);
    return {
      ...p,
      target: g?.target ?? deterministicTarget(p.difficulty),
      ai_rationale: g?.ai_rationale ?? `${p.name} needs to deliver this matchday.`,
    };
  });
}

// ── Lifecycle steps ─────────────────────────────────────────────────────────

function nextMdSlug(slug: string): string {
  const m = slug.match(/^([A-Za-z]+)(\d+)$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${slug}-2`;
}

type AutomationRow = {
  poolObjectId: string;
  tournamentSlug: string;
  mdSlug: string;
  rosterBlobId?: string;
  entryFeeMist: string;
  treasury: string;
  lockDelayMs: number;
  simDelayMs: number;
  settleDelayMs: number;
  lastMintAtMs?: number;
  lockedAtMs?: number;
  simStartedAtMs?: number;
  status: string;
};

/** Resolve one pool by one step, based on its live on-chain phase + timers. */
async function advanceOne(ctx: any, row: AutomationRow): Promise<string> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const c = client();
  const kp = signer();
  const pool = await readPool(c, row.poolObjectId);
  if (!pool) return "pool not found";
  const now = Date.now();

  // OPEN → lock once the post-mint countdown elapses.
  if (pool.phase === 0) {
    if (pool.total_passes === 0) return "open · no mints yet";
    const eta = (row.lastMintAtMs ?? now) + row.lockDelayMs;
    if (now < eta) return `open · locks in ${Math.ceil((eta - now) / 1000)}s`;
    const tx = new Transaction();
    tx.moveCall({ target: `${pkg()}::pool::lock_pool`, arguments: [tx.object(row.poolObjectId)] });
    await exec(c, kp, tx);
    await ctx.runMutation(internal.automation.patchState, {
      poolObjectId: row.poolObjectId, status: "locked", lockedAtMs: now,
    });
    return "locked";
  }

  // LOCKED → start the sim, then (after the window) resolve + settle.
  if (pool.phase === 1) {
    if (!row.simStartedAtMs) {
      const simEta = (row.lockedAtMs ?? now) + row.simDelayMs;
      if (now < simEta) return `locked · sim in ${Math.ceil((simEta - now) / 1000)}s`;
      await ctx.runMutation(api.matchSim.startSim, {
        poolObjectId: row.poolObjectId, startedAt: now, durationMs: row.settleDelayMs,
      });
      await ctx.runMutation(internal.automation.patchState, {
        poolObjectId: row.poolObjectId, status: "simming", simStartedAtMs: now,
      });
      return "sim started";
    }
    const settleEta = row.simStartedAtMs + row.settleDelayMs;
    if (now < settleEta) return `simming · settles in ${Math.ceil((settleEta - now) / 1000)}s`;

    // Resolve outcome → Walrus → settle_pool.
    if (!row.rosterBlobId) throw new Error("no rosterBlobId to resolve");
    const roster = await walrusFetch<Roster>(row.rosterBlobId);
    const md = await generateResults(roster);
    const blobId = await walrusUpload(md);

    const passes = (await ctx.runQuery(api.passes.listByPool, {
      poolObjectId: row.poolObjectId,
    })) as Array<{ playerId: number }>;
    const elimSet = new Set(md.eliminated_player_ids);
    const survivors = passes.filter((p) => !elimSet.has(p.playerId)).length;

    const tx = new Transaction();
    tx.moveCall({
      target: `${pkg()}::pool::settle_pool`,
      arguments: [
        tx.object(row.poolObjectId),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
        tx.pure.vector("u32", md.eliminated_player_ids),
        tx.pure.u64(BigInt(survivors)),
      ],
    });
    await exec(c, kp, tx);

    await ctx.runMutation(api.matchdays.setResults, {
      tournamentSlug: row.tournamentSlug, mdSlug: row.mdSlug, matchdayResultsBlobId: blobId,
    });
    await ctx.runMutation(api.passes.markEliminatedByPlayer, {
      poolObjectId: row.poolObjectId, eliminatedPlayerIds: md.eliminated_player_ids,
    });
    await ctx.runMutation(api.matchSim.stopSim, {
      poolObjectId: row.poolObjectId, startedAt: row.simStartedAtMs,
    });
    await ctx.runMutation(internal.automation.patchState, {
      poolObjectId: row.poolObjectId, status: "settled", settledAtMs: now,
    });
    return `settled · ${survivors} survivors`;
  }

  // SETTLED → spawn the next matchday (same teams, fresh targets), then retire.
  if (pool.phase === 2) {
    if (!row.rosterBlobId) throw new Error("no rosterBlobId to spawn from");
    const prev = await walrusFetch<Roster>(row.rosterBlobId);
    const home = prev.fixture?.home ?? prev.players[0]?.team ?? "Home";
    const away = prev.fixture?.away ?? prev.players[prev.players.length - 1]?.team ?? "Away";
    const players = await regenerateTargets(prev.players, home, away);
    const childMd = nextMdSlug(row.mdSlug);
    const newRoster: Roster = {
      schema_version: 2,
      tournament: prev.tournament,
      matchday: childMd,
      fixture: prev.fixture,
      ai_game_master: "gauntlet-auto",
      players,
    };
    const rosterBlobId = await walrusUpload(newRoster);

    const tx = new Transaction();
    tx.moveCall({
      target: `${pkg()}::pool::create_pool`,
      arguments: [
        tx.pure.u64(BigInt(row.entryFeeMist)),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(rosterBlobId))),
        tx.pure.address(row.treasury),
        tx.pure.vector("u32", players.map((p) => p.id)),
        tx.pure.vector("u64", players.map((p) => BigInt(weightFor(p.difficulty)))),
      ],
    });
    const fx = await exec(c, kp, tx);
    const created = fx.objectChanges?.find(
      (ch) => ch.type === "created" && "objectType" in ch &&
        typeof ch.objectType === "string" && ch.objectType.endsWith("::pool::Pool"),
    ) as { objectId?: string } | undefined;
    if (!created?.objectId) throw new Error("spawned pool id not found");
    const childPool = created.objectId;

    await ctx.runMutation(api.matchdays.create, {
      tournamentSlug: row.tournamentSlug,
      mdSlug: childMd,
      label: childMd,
      date: new Date().toISOString().slice(0, 10),
      fixture: prev.fixture?.home && prev.fixture?.away ? `${home} vs ${away}` : undefined,
      status: "live",
      rosterBlobId,
      poolObjectId: childPool,
      entryFeeMist: row.entryFeeMist,
    });
    await ctx.runMutation(internal.automation.registerInternal, {
      poolObjectId: childPool,
      tournamentSlug: row.tournamentSlug,
      mdSlug: childMd,
      rosterBlobId,
      entryFeeMist: row.entryFeeMist,
      treasury: row.treasury,
      enabled: true,
      lockDelayMs: row.lockDelayMs,
      simDelayMs: row.simDelayMs,
      settleDelayMs: row.settleDelayMs,
    });
    // Retire the parent so the loop now drives the child.
    await ctx.runMutation(internal.automation.patchState, {
      poolObjectId: row.poolObjectId, status: "spawned", enabled: false, spawnedChildPool: childPool,
    });
    return `spawned ${childMd} (${childPool})`;
  }

  return `phase ${pool.phase} · no action`;
}

// ── Public/cron entrypoints ─────────────────────────────────────────────────

/** Cron tick: advance every enabled pool by at most one step. */
export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    const rows = (await ctx.runQuery(internal.automation.listEnabled, {})) as AutomationRow[];
    const out: Record<string, string> = {};
    for (const row of rows) {
      try {
        out[row.poolObjectId] = await advanceOne(ctx, row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        out[row.poolObjectId] = `error: ${msg}`;
        await ctx.runMutation(internal.automation.patchState, {
          poolObjectId: row.poolObjectId, lastError: msg,
        });
      }
    }
    return out;
  },
});

/** Manual single-step trigger for one pool — validate before enabling the cron.
 *  Admin-gated: `caller` must be in adminRoles (this signs an on-chain tx). */
export const step = action({
  args: { caller: v.string(), poolObjectId: v.string() },
  handler: async (ctx, { caller, poolObjectId }) => {
    const ok = (await ctx.runQuery(api.admin.isAdmin, { address: caller })) as boolean;
    if (!ok) throw new Error("Not authorized: admin only");
    const row = (await ctx.runQuery(internal.automation.getByPool, { poolObjectId })) as AutomationRow | null;
    if (!row) throw new Error("pool not enrolled in automation");
    return advanceOne(ctx, row);
  },
});
