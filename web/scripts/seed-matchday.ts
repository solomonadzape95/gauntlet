/**
 * Generate the matchday outcome for the current roster via Gemini, write it
 * to `data/matchday-<slug>.json`, and upload to Walrus.
 *
 * Usage (from web/):
 *   pnpm dlx tsx scripts/seed-matchday.ts                   # default survival rate 0.5
 *   pnpm dlx tsx scripts/seed-matchday.ts --survival-rate=0.4
 *   pnpm dlx tsx scripts/seed-matchday.ts --dry-run         # print, don't write
 *   pnpm dlx tsx scripts/seed-matchday.ts --skip-upload
 *   pnpm dlx tsx scripts/seed-matchday.ts --model=gemini-2.5-flash
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { uploadJsonToWalrus } from "./upload-walrus";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const ROSTER_PATH = path.join(REPO_ROOT, "data", "roster.json");

const DEFAULT_MODEL_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

interface Flags {
  survivalRate: number;
  skipUpload: boolean;
  dryRun: boolean;
  model?: string;
  out?: string;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { survivalRate: 0.5, skipUpload: false, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--survival-rate=")) {
      flags.survivalRate = Number(a.split("=")[1]);
    } else if (a === "--skip-upload") flags.skipUpload = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a.startsWith("--model=")) flags.model = a.split("=").slice(1).join("=");
    else if (a.startsWith("--out=")) flags.out = a.split("=").slice(1).join("=");
    else throw new Error(`Unknown flag: ${a}`);
  }
  if (!Number.isFinite(flags.survivalRate) || flags.survivalRate < 0 || flags.survivalRate > 1) {
    throw new Error(`--survival-rate must be between 0 and 1 (got ${flags.survivalRate})`);
  }
  return flags;
}

async function loadDotEnv(envPath: string) {
  let content: string;
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface RosterPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  difficulty: string;
  number?: number;
  age?: number;
  target: { metric: string; threshold?: number; tackles_threshold?: number; passacc_threshold?: number; saves_threshold?: number; human: string };
}

interface RosterData {
  matchday: string;
  fixture?: { home: string; away: string; venue?: string; kickoff_utc?: string };
  players: RosterPlayer[];
}

interface MatchdayResultRow {
  player_id: number;
  name: string;
  stats: Record<string, number>;
  hit_target: boolean;
  verdict: string;
}

interface MatchdayData {
  schema_version: 2;
  matchday: string;
  fixtures: Array<{ home: string; away: string; score: string }>;
  results: MatchdayResultRow[];
  eliminated_player_ids: number[];
  survivor_player_ids: number[];
}

function isTransient(status: number): boolean {
  return status === 503 || status === 429 || status === 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiOnce(model: string, apiKey: string, body: string): Promise<MatchdayData> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Gemini ${model} failed (${res.status}): ${detail.slice(0, 300)}`) as Error & { transient: boolean };
    err.transient = isTransient(res.status);
    throw err;
  }
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Gemini ${model} returned non-JSON: ${stripped.slice(0, 300)}`);
  }
  return parsed as MatchdayData;
}

async function generateMatchday(roster: RosterData, flags: Flags): Promise<{ data: MatchdayData; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");

  const chain = flags.model
    ? flags.model.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_MODEL_CHAIN;

  const home = roster.fixture?.home ?? "Home";
  const away = roster.fixture?.away ?? "Away";
  const venue = roster.fixture?.venue ?? "stadium";

  const systemPrompt = `You are the AI Game Master simulating the outcome of ${home} vs ${away} at ${venue}. For each player in the roster, generate plausible per-player stats matching their assigned target metric, decide hit/miss informed by their difficulty tier (stars often miss brutal targets like '2 goals'; defenders typically hold their defensive targets; workhorses are coin-flips on effort metrics; GKs are 50/50 on clean sheets in international games). Roughly ${Math.round(flags.survivalRate * 100)}% of players should hit their target (the survival rate). The output JSON must:
- include every input player_id exactly once in results,
- have hit_target=true for survivors,
- have eliminated_player_ids contain every player_id where hit_target=false,
- have survivor_player_ids contain every player_id where hit_target=true,
- pick a plausible final score for the match (1-1, 2-1, 0-0 etc — choose based on how many forwards you have hitting goal targets).

The stats object per player should use the same metric keys as their target where possible (goals, assists, tackles, pass_accuracy, clearances, saves, conceded, shots_on_target, key_passes, minutes_played). Values should be realistic for a 90-minute match.

The verdict field is a 5-12 word football-fan voice line summarizing why they hit or missed.`;

  const userPrompt = `Roster:\n${roster.players.map((p) => `- player_id=${p.id} | ${p.name} (${p.team}, ${p.position}, difficulty=${p.difficulty}) — target: ${p.target.human}`).join("\n")}\n\nReturn ONLY the JSON object — no prose, no fences.`;

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          fixtures: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                home: { type: "STRING" },
                away: { type: "STRING" },
                score: { type: "STRING" },
              },
              required: ["home", "away", "score"],
            },
          },
          results: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                player_id: { type: "INTEGER" },
                name: { type: "STRING" },
                stats: { type: "OBJECT" },
                hit_target: { type: "BOOLEAN" },
                verdict: { type: "STRING" },
              },
              required: ["player_id", "name", "hit_target", "verdict"],
            },
          },
          eliminated_player_ids: { type: "ARRAY", items: { type: "INTEGER" } },
          survivor_player_ids: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["results", "eliminated_player_ids", "survivor_player_ids"],
      },
    },
  });

  let lastError: Error | null = null;
  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callGeminiOnce(model, apiKey, requestBody);
        return { data, model };
      } catch (e) {
        const err = e as Error & { transient?: boolean };
        lastError = err;
        if (err.transient && attempt === 1) {
          console.warn(`[seed-matchday] ${model} transient — retrying in 2s…`);
          await sleep(2000);
          continue;
        }
        if (err.transient) {
          console.warn(`[seed-matchday] ${model} still overloaded — next model.`);
        } else {
          throw err;
        }
        break;
      }
    }
  }
  throw lastError ?? new Error("All models failed");
}

async function main() {
  const flags = parseFlags(process.argv);
  await loadDotEnv(path.join(WEB_ROOT, ".env.local"));

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY required. Add it to web/.env.local.");
  }

  const rosterRaw = await fs.readFile(ROSTER_PATH, "utf8");
  const roster = JSON.parse(rosterRaw) as RosterData;
  const rosterIds = new Set(roster.players.map((p) => p.id));
  console.log(`[seed-matchday] Loaded roster: ${roster.matchday} (${roster.players.length} players)`);

  const { data: raw, model } = await generateMatchday(roster, flags);
  console.log(`[seed-matchday] Generated via ${model}.`);

  // ---- Defensive normalization ----
  // 1. Coerce IDs to numbers.
  for (const r of raw.results ?? []) r.player_id = Number(r.player_id);
  raw.eliminated_player_ids = (raw.eliminated_player_ids ?? []).map(Number);
  raw.survivor_player_ids = (raw.survivor_player_ids ?? []).map(Number);

  // 2. Drop hallucinated IDs that don't exist in the roster.
  const dropped: number[] = [];
  raw.results = (raw.results ?? []).filter((r) => {
    const ok = rosterIds.has(r.player_id);
    if (!ok) dropped.push(r.player_id);
    return ok;
  });
  raw.eliminated_player_ids = raw.eliminated_player_ids.filter((id) => rosterIds.has(id));
  raw.survivor_player_ids = raw.survivor_player_ids.filter((id) => rosterIds.has(id));
  if (dropped.length > 0) {
    console.warn(`[seed-matchday] Dropped ${dropped.length} hallucinated player_id(s): ${dropped.slice(0, 5).join(", ")}${dropped.length > 5 ? "…" : ""}`);
  }

  // 3. Cross-fill: if Gemini returned a result but didn't list the ID in
  // the correct survivor/eliminated bucket, derive from hit_target.
  const elimSet = new Set(raw.eliminated_player_ids);
  const survSet = new Set(raw.survivor_player_ids);
  for (const r of raw.results) {
    if (r.hit_target) {
      survSet.add(r.player_id);
      elimSet.delete(r.player_id);
    } else {
      elimSet.add(r.player_id);
      survSet.delete(r.player_id);
    }
  }
  raw.eliminated_player_ids = [...elimSet];
  raw.survivor_player_ids = [...survSet];

  // 4. Fill missing players (Gemini didn't return them) with deterministic
  // fallbacks so every roster player has a row.
  const seenIds = new Set(raw.results.map((r) => r.player_id));
  for (const p of roster.players) {
    if (seenIds.has(p.id)) continue;
    const hit = Math.random() < flags.survivalRate;
    console.warn(`[seed-matchday] Filling missing player #${p.id} ${p.name} with random outcome (hit=${hit}).`);
    raw.results.push({
      player_id: p.id,
      name: p.name,
      stats: {},
      hit_target: hit,
      verdict: hit ? `${p.name} hit their target.` : `${p.name} fell short.`,
    });
    if (hit) survSet.add(p.id);
    else elimSet.add(p.id);
  }
  raw.eliminated_player_ids = [...elimSet];
  raw.survivor_player_ids = [...survSet];

  // 5. Ensure fixtures has at least one entry.
  if (!raw.fixtures || raw.fixtures.length === 0) {
    raw.fixtures = [
      {
        home: roster.fixture?.home ?? "Home",
        away: roster.fixture?.away ?? "Away",
        score: "1-1",
      },
    ];
  }

  raw.schema_version = 2;
  raw.matchday = roster.matchday;

  const summary = `[seed-matchday] Outcome: ${raw.survivor_player_ids.length} survive / ${raw.eliminated_player_ids.length} out (target rate ${(flags.survivalRate * 100).toFixed(0)}%). Score: ${raw.fixtures[0].home} ${raw.fixtures[0].score} ${raw.fixtures[0].away}.`;
  console.log(summary);

  if (flags.dryRun) {
    console.log("\n[seed-matchday] --dry-run: would write:");
    console.log(JSON.stringify(raw, null, 2));
    return;
  }

  const home = slug(roster.fixture?.home ?? "home");
  const away = slug(roster.fixture?.away ?? "away");
  const outFile = flags.out
    ? path.resolve(REPO_ROOT, flags.out)
    : path.join(REPO_ROOT, "data", `matchday-${home}-${away}.json`);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(raw, null, 2));
  console.log(`[seed-matchday] Wrote ${path.relative(REPO_ROOT, outFile)}`);

  if (flags.skipUpload) {
    console.log("[seed-matchday] --skip-upload: skipping Walrus.");
    return;
  }

  console.log("[seed-matchday] Uploading to Walrus…");
  const blobId = await uploadJsonToWalrus(raw);
  console.log("\n  ┌─ Walrus blob created");
  console.log(`  │  blob id: ${blobId}`);
  console.log("  └─ Update web/.env.local:");
  console.log(`     NEXT_PUBLIC_MATCHDAY_BLOB_ID=${blobId}`);
  console.log("  └─ Also set matchdayBlobId for 'genesis-wc' in web/lib/pools.ts.");
}

main().catch((e) => {
  console.error("\n[seed-matchday] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
