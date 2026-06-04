/**
 * One-shot seed: build a real WC 2026 MD1 roster from API-Football, batch-
 * generate stat targets via Gemini, write data/roster.json, upload to Walrus.
 *
 * Usage (from web/):
 *   pnpm dlx tsx scripts/seed-roster.ts
 *
 * Flags:
 *   --fixture-id=<id>       Skip the auto-fixture lookup and use this fixture id.
 *   --refetch-all           Force live API calls (ignore disk cache entirely).
 *   --refetch-teams         Re-fetch the team-name → team-id lookups.
 *   --refetch-fixtures      Re-fetch the fixtures-by-date query.
 *   --refetch-squads        Re-fetch the team squad lists.
 *   --refetch-players       Re-fetch individual player profiles.
 *   --no-cache              Same as --refetch-all.
 *   --skip-upload           Write data/roster.json but don't upload to Walrus.
 *   --dry-run               Print what we'd write; don't write or upload.
 *
 * Env (loaded from web/.env.local automatically):
 *   API_FOOTBALL_KEY        Required. Free key at dashboard.api-football.com.
 *   GEMINI_API_KEY          Optional. If missing, falls back to a deterministic target generator.
 *   NEXT_PUBLIC_WALRUS_PUBLISHER  Used by upload-walrus; has a public testnet default.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ApiFootballClient, type ApiSquadPlayer } from "../lib/api-football/client";
import { createFsCache } from "../lib/api-football/cache";
import { uploadJsonToWalrus } from "./upload-walrus";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const CACHE_ROOT = path.join(REPO_ROOT, "data", ".cache");
const ROSTER_OUT = path.join(REPO_ROOT, "data", "roster.json");

// ---- Flag parsing ----

interface Flags {
  fixtureId?: number;
  /** Manual fixture override — required when API-Football's free tier won't return live fixtures. */
  home?: string;
  away?: string;
  kickoff?: string;
  venue?: string;
  /** Override the Gemini model chain. Comma-separated, first one tried first. */
  model?: string;
  refetchAll: boolean;
  refetchTeams: boolean;
  refetchFixtures: boolean;
  refetchSquads: boolean;
  refetchPlayers: boolean;
  skipUpload: boolean;
  dryRun: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    refetchAll: false,
    refetchTeams: false,
    refetchFixtures: false,
    refetchSquads: false,
    refetchPlayers: false,
    skipUpload: false,
    dryRun: false,
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--fixture-id=")) flags.fixtureId = Number(a.split("=")[1]);
    else if (a.startsWith("--home=")) flags.home = a.split("=").slice(1).join("=");
    else if (a.startsWith("--away=")) flags.away = a.split("=").slice(1).join("=");
    else if (a.startsWith("--kickoff=")) flags.kickoff = a.split("=").slice(1).join("=");
    else if (a.startsWith("--venue=")) flags.venue = a.split("=").slice(1).join("=");
    else if (a.startsWith("--model=")) flags.model = a.split("=").slice(1).join("=");
    else if (a === "--refetch-all" || a === "--no-cache") flags.refetchAll = true;
    else if (a === "--refetch-teams") flags.refetchTeams = true;
    else if (a === "--refetch-fixtures") flags.refetchFixtures = true;
    else if (a === "--refetch-squads") flags.refetchSquads = true;
    else if (a === "--refetch-players") flags.refetchPlayers = true;
    else if (a === "--skip-upload") flags.skipUpload = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

/** Deterministic synthetic fixture id from a team pair — stable across reruns. */
function syntheticFixtureId(home: string, away: string, kickoff: string): number {
  const s = `${home}|${away}|${kickoff}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  // Keep positive + 6-7 digits so it looks like a real fixture id.
  return (Math.abs(h) % 9_000_000) + 1_000_000;
}

// ---- Dotenv (cheap) ----

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

// ---- Domain types (matches web/lib/types.ts) ----

type Difficulty = "star" | "regular" | "workhorse" | "defender" | "GK";

interface RosterPlayer {
  id: number;
  name: string;
  team: string;
  club: string;
  position: "GK" | "DF" | "MF" | "FW";
  number: number;
  age: number;
  difficulty: Difficulty;
  target: {
    metric: string;
    threshold?: number;
    tackles_threshold?: number;
    passacc_threshold?: number;
    saves_threshold?: number;
    human: string;
  };
  ai_rationale: string;
}

interface RosterData {
  schema_version: 2;
  tournament: string;
  matchday: string;
  fixture: {
    id: number;
    venue: string;
    kickoff_utc: string;
    home: string;
    away: string;
  };
  ai_game_master: string;
  players: RosterPlayer[];
}

// ---- Helpers ----

function normalizePosition(raw: string): "GK" | "DF" | "MF" | "FW" {
  const s = raw.toLowerCase();
  if (s.startsWith("goal")) return "GK";
  if (s.startsWith("defen")) return "DF";
  if (s.startsWith("mid")) return "MF";
  return "FW";
}

/**
 * Difficulty key uses POSITION-RELATIVE rank — the top forward in a squad is
 * the "star", the second/third are "regular" (wingers vs the central striker).
 * Same idea for midfielders: the #1 by squad-number rank is the playmaker, the
 * rest are "workhorses".
 */
function difficultyFor(position: "GK" | "DF" | "MF" | "FW", posRank: number): Difficulty {
  if (position === "GK") return "GK";
  if (position === "DF") return "defender";
  if (position === "MF") return posRank === 0 ? "regular" : "workhorse";
  // FW
  return posRank === 0 ? "star" : "regular";
}

/**
 * Formation slots (per side). Default is 4-3-3: 1 GK + 4 DF + 3 MF + 3 FW = 11.
 */
const FORMATION_4_3_3: Record<"GK" | "DF" | "MF" | "FW", number> = {
  GK: 1,
  DF: 4,
  MF: 3,
  FW: 3,
};

/**
 * "Top" within a position = lowest squad number first (international squad
 * numbers are deliberately assigned — #1/2/9/10 etc. signal starters).
 * Players without a squad number sort last. Ties broken by ascending id.
 */
function rankBySquadNumber(a: ApiSquadPlayer, b: ApiSquadPlayer): number {
  const ax = a.number ?? Number.MAX_SAFE_INTEGER;
  const bx = b.number ?? Number.MAX_SAFE_INTEGER;
  if (ax !== bx) return ax - bx;
  return a.id - b.id;
}

interface PickedPlayer {
  player: ApiSquadPlayer;
  /** Rank within the position bucket (0 = top). Used by difficultyFor. */
  posRank: number;
  position: "GK" | "DF" | "MF" | "FW";
}

/**
 * Pick the top N players per position from a squad to fill a formation.
 * Defaults to 4-3-3 (11 players). Falls back to filling short positions
 * from any remaining squad members if a bucket is undersized.
 */
function pickStarters(
  squad: ApiSquadPlayer[],
  formation: Record<"GK" | "DF" | "MF" | "FW", number> = FORMATION_4_3_3,
): PickedPlayer[] {
  const buckets: Record<"GK" | "DF" | "MF" | "FW", ApiSquadPlayer[]> = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) buckets[normalizePosition(p.position)].push(p);

  // Sort each bucket by squad number ascending so "top" = most likely starter.
  (Object.keys(buckets) as Array<"GK" | "DF" | "MF" | "FW">).forEach((pos) => {
    buckets[pos].sort(rankBySquadNumber);
  });

  const out: PickedPlayer[] = [];
  const target = formation.GK + formation.DF + formation.MF + formation.FW;

  (Object.keys(formation) as Array<"GK" | "DF" | "MF" | "FW">).forEach((pos) => {
    buckets[pos].slice(0, formation[pos]).forEach((player, posRank) => {
      out.push({ player, position: pos, posRank });
    });
  });

  // If any bucket was short, top up from the rest of the squad (still by
  // squad-number rank). Anything pulled here is given a posRank of "deep" so
  // they read as workhorse/regular rather than star.
  if (out.length < target) {
    const seen = new Set(out.map((x) => x.player.id));
    const leftovers = [...squad].sort(rankBySquadNumber);
    for (const p of leftovers) {
      if (out.length >= target) break;
      if (seen.has(p.id)) continue;
      const pos = normalizePosition(p.position);
      out.push({ player: p, position: pos, posRank: 99 });
    }
  }
  return out.slice(0, target);
}

// ---- Gemini batch target generator ----

interface GeneratedTargetEntry {
  player_id: number;
  target: RosterPlayer["target"];
  ai_rationale: string;
}

/**
 * Default model chain. We try each in order on 503/UNAVAILABLE / 429. The
 * cheaper/older models are listed AFTER the preferred one because they are
 * generally less in-demand and serve as graceful fallbacks during spikes.
 */
const DEFAULT_MODEL_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

async function generateTargets(
  players: Array<Omit<RosterPlayer, "target" | "ai_rationale">>,
  fixture: RosterData["fixture"],
  modelOverride?: string,
): Promise<{ targets: GeneratedTargetEntry[]; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("[seed-roster] GEMINI_API_KEY not set — generating deterministic targets.");
    return { targets: players.map((p) => deterministicTarget(p)), model: "deterministic-fallback" };
  }

  const chain = modelOverride ? modelOverride.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_MODEL_CHAIN;

  const validIds = players.map((p) => p.id);

  const systemPrompt = `You are the AI Game Master for Gauntlet — a survival pool on Sui. You are about to set the stat target each player must hit during a real match to keep their Survival Pass alive.

Match: ${fixture.home} vs ${fixture.away} at ${fixture.venue} (kickoff ${fixture.kickoff_utc}).

Rules for target assignment:
- Each target must be PLAUSIBLE for a single 90-minute match.
- Stars (difficulty=star) get brutal targets ("score 2 goals", "1 goal + 1 assist"). Regulars get reachable ones ("90+ minutes + 1 key pass"). Workhorses get effort metrics ("3+ tackles AND 85%+ pass accuracy"). Defenders get defensive metrics ("1 clean sheet OR 3 clearances"). GKs get "save % >= 75% AND clean sheet".
- Each metric must be one of: goals, assists, goals_or_assists, shots_on_target, key_passes, tackles_and_pass_acc, clearances, clean_sheet, saves_threshold, minutes_played.
- For metrics with multiple thresholds, set them on the threshold field names (tackles_threshold, passacc_threshold, saves_threshold).
- The human field is plain English shown to users.
- The ai_rationale is 1-2 sentences explaining WHY this is the right target for this player in this match. Reference their nationality + position. Football-fan voice.

Output rules (CRITICAL):
- Return ONE entry per input player. Same length, same order.
- player_id MUST be the integer from the input list, copied exactly. Allowed values: [${validIds.join(", ")}]. Do not invent or renumber.
- Output a bare JSON array — no top-level object, no wrapping {"players": ...}, no markdown fences, no commentary.`;

  const userPrompt = `Players:\n${players.map((p) => `- player_id=${p.id} | ${p.name} (${p.team}, ${p.position}, difficulty=${p.difficulty}, age=${p.age}, squad#=${p.number})`).join("\n")}\n\nReturn the JSON array of ${players.length} target objects.`;

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            player_id: { type: "INTEGER" },
            target: {
              type: "OBJECT",
              properties: {
                metric: { type: "STRING" },
                threshold: { type: "INTEGER" },
                tackles_threshold: { type: "INTEGER" },
                passacc_threshold: { type: "INTEGER" },
                saves_threshold: { type: "INTEGER" },
                human: { type: "STRING" },
              },
              required: ["metric", "human"],
            },
            ai_rationale: { type: "STRING" },
          },
          required: ["player_id", "target", "ai_rationale"],
        },
      },
    },
  });

  let lastError: Error | null = null;
  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const targets = await callGeminiOnce(key, model, requestBody);
        if (attempt > 1 || model !== chain[0]) {
          console.log(`[seed-roster] Targets generated via ${model}${attempt > 1 ? ` (retry ${attempt})` : ""}.`);
        }
        return { targets, model };
      } catch (e) {
        const err = e as Error & { transient?: boolean };
        lastError = err;
        if (err.transient && attempt === 1) {
          console.warn(`[seed-roster] ${model} returned transient error; retrying in 2s…`);
          await sleep(2000);
          continue;
        }
        if (err.transient) {
          console.warn(`[seed-roster] ${model} still overloaded after retry — falling through to next model.`);
        } else {
          // Non-transient (bad request, etc.) — don't waste a retry on the next model.
          throw err;
        }
        break;
      }
    }
  }

  console.warn(
    `[seed-roster] All Gemini models in the chain (${chain.join(", ")}) failed. ` +
      `Falling back to deterministic targets so the seed still completes. Last error: ${lastError?.message ?? "(unknown)"}`,
  );
  return { targets: players.map((p) => deterministicTarget(p)), model: "deterministic-fallback" };
}

async function callGeminiOnce(key: string, model: string, body: string): Promise<GeneratedTargetEntry[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const transient = res.status === 503 || res.status === 429 || res.status === 500;
    const err = new Error(`Gemini ${model} failed (${res.status}): ${detail.slice(0, 300)}`) as Error & { transient: boolean };
    err.transient = transient;
    throw err;
  }
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  // Gemini's structured output should give us a bare array, but in case the
  // model still wraps it (e.g. `{"players": [...]}` or markdown fences), try
  // a few unwrappers before giving up.
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    throw new Error(`Gemini ${model} returned non-JSON: ${stripped.slice(0, 300)}`);
  }
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const arrField = Object.values(parsed as Record<string, unknown>).find((v) => Array.isArray(v));
    if (arrField) parsed = arrField;
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Gemini ${model} didn't return an array: ${stripped.slice(0, 300)}`);
  }
  return (parsed as Array<Partial<GeneratedTargetEntry>>).map((g) => ({
    player_id: Number(g.player_id),
    target: g.target!,
    ai_rationale: String(g.ai_rationale ?? ""),
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formationCount(picks: PickedPlayer[]): string {
  const c = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of picks) c[p.position]++;
  return `${c.GK}-${c.DF}-${c.MF}-${c.FW}`;
}

function deterministicTarget(p: Omit<RosterPlayer, "target" | "ai_rationale">): GeneratedTargetEntry {
  switch (p.difficulty) {
    case "GK":
      return {
        player_id: p.id,
        target: { metric: "clean_sheet", threshold: 1, human: "Keep a clean sheet" },
        ai_rationale: `${p.name} is ${p.team}'s last line — anything less than a clean sheet and they're out.`,
      };
    case "defender":
      return {
        player_id: p.id,
        target: { metric: "clearances", threshold: 3, human: "3+ clearances" },
        ai_rationale: `${p.name} should be busy at the back. Three clean clearances is the floor.`,
      };
    case "workhorse":
      return {
        player_id: p.id,
        target: {
          metric: "tackles_and_pass_acc",
          tackles_threshold: 3,
          passacc_threshold: 85,
          human: "3+ tackles AND 85%+ pass accuracy",
        },
        ai_rationale: `${p.name} carries the engine room — graft AND control, or no payout.`,
      };
    case "star":
      return {
        player_id: p.id,
        target: { metric: "goals_or_assists", threshold: 1, human: "Score or assist" },
        ai_rationale: `${p.name} is the matchwinner — anything less than direct involvement in a goal is a miss.`,
      };
    default:
      return {
        player_id: p.id,
        target: { metric: "key_passes", threshold: 2, human: "2+ key passes" },
        ai_rationale: `${p.name} needs to create — two real chances or they're out.`,
      };
  }
}

// ---- Main ----

async function main() {
  const flags = parseFlags(process.argv);

  await loadDotEnv(path.join(WEB_ROOT, ".env.local"));

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY missing. Add it to web/.env.local.");
  }

  const cache = createFsCache(CACHE_ROOT);
  const apifootball = new ApiFootballClient({
    apiKey,
    cache,
    refetchAll: flags.refetchAll,
    refetchByEndpoint: {
      teams: flags.refetchTeams,
      fixtures: flags.refetchFixtures,
      squads: flags.refetchSquads,
      players: flags.refetchPlayers,
    },
  });

  const t0 = Date.now();

  // 1. Resolve Mexico's team id (don't trust hardcoded IDs).
  console.log("[seed-roster] Resolving Mexico team id…");
  const teams = await apifootball.teams({ name: "Mexico", country: "Mexico" });
  const mexico = teams[0]?.team;
  if (!mexico) throw new Error("Could not resolve Mexico from API-Football. Check key + quota.");
  console.log(`              -> ${mexico.name} (id=${mexico.id})`);

  // 2. Resolve the fixture. Three paths:
  //    a) --fixture-id=<n> → look it up directly (free tier may reject).
  //    b) --home + --away   → manual override, skip /fixtures entirely (preferred when free tier is locked).
  //    c) default           → query /fixtures for Mexico's June-11 game (requires paid plan for 2026 season).
  let fixtureMeta: RosterData["fixture"];
  let homeTeam: { id: number; name: string };
  let awayTeam: { id: number; name: string };

  if (flags.home && flags.away) {
    console.log(`[seed-roster] Using manual fixture override: ${flags.home} vs ${flags.away}`);
    const [homeTeams, awayTeams] = await Promise.all([
      apifootball.teams({ name: flags.home }),
      apifootball.teams({ name: flags.away }),
    ]);
    const home = homeTeams[0]?.team;
    const away = awayTeams[0]?.team;
    if (!home) throw new Error(`Could not resolve home team "${flags.home}" from API-Football.`);
    if (!away) throw new Error(`Could not resolve away team "${flags.away}" from API-Football.`);
    const venue = flags.venue ?? "Estadio Azteca";
    const kickoff = flags.kickoff ?? "2026-06-11T20:00:00Z";
    homeTeam = { id: home.id, name: home.name };
    awayTeam = { id: away.id, name: away.name };
    fixtureMeta = {
      id: syntheticFixtureId(home.name, away.name, kickoff),
      venue,
      kickoff_utc: kickoff,
      home: home.name,
      away: away.name,
    };
    console.log(`              -> ${home.name} (id=${home.id}) vs ${away.name} (id=${away.id}) at ${venue}`);
  } else if (flags.fixtureId) {
    console.log(`[seed-roster] Using fixture override id=${flags.fixtureId}`);
    const list = await apifootball.fixtures({ id: flags.fixtureId });
    const fx = list[0];
    if (!fx) throw new Error(`Fixture id=${flags.fixtureId} not returned by API-Football.`);
    homeTeam = { id: fx.teams.home.id, name: fx.teams.home.name };
    awayTeam = { id: fx.teams.away.id, name: fx.teams.away.name };
    fixtureMeta = {
      id: fx.fixture.id,
      venue: fx.fixture.venue.name,
      kickoff_utc: fx.fixture.date,
      home: fx.teams.home.name,
      away: fx.teams.away.name,
    };
    console.log(`              -> ${fixtureMeta.home} vs ${fixtureMeta.away} at ${fixtureMeta.venue}`);
  } else {
    console.log("[seed-roster] Looking up Mexico's June-11 fixture…");
    let list;
    try {
      list = await apifootball.fixtures({
        league: 1,
        season: 2026,
        team: mexico.id,
        from: "2026-06-11",
        to: "2026-06-11",
      });
    } catch (e) {
      throw new Error(
        `API-Football fixtures lookup failed (likely free-tier season lock).\n` +
          `Pass the fixture explicitly:\n` +
          `  pnpm seed:roster --home="Mexico" --away="<opponent>" --kickoff="2026-06-11T20:00:00Z" --venue="Estadio Azteca"\n` +
          `Underlying error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const fx = list[0];
    if (!fx) {
      throw new Error(
        "No fixture found. Either the WC 2026 draw isn't in API-Football yet, or the date filter missed. " +
          "Try --home=Mexico --away=<opponent> instead.",
      );
    }
    homeTeam = { id: fx.teams.home.id, name: fx.teams.home.name };
    awayTeam = { id: fx.teams.away.id, name: fx.teams.away.name };
    fixtureMeta = {
      id: fx.fixture.id,
      venue: fx.fixture.venue.name,
      kickoff_utc: fx.fixture.date,
      home: fx.teams.home.name,
      away: fx.teams.away.name,
    };
    console.log(`              -> ${fixtureMeta.home} vs ${fixtureMeta.away} at ${fixtureMeta.venue}`);
  }

  // 3. Pull squads.
  const homeIsMexico = homeTeam.id === mexico.id;
  const opponent = homeIsMexico ? awayTeam : homeTeam;
  console.log("[seed-roster] Pulling squads…");
  const [mexSquad, oppSquad] = await Promise.all([
    apifootball.squad({ team: mexico.id }),
    apifootball.squad({ team: opponent.id }),
  ]);
  if (!mexSquad) throw new Error("Mexico squad missing from API-Football response.");
  if (!oppSquad) throw new Error(`${opponent.name} squad missing from API-Football response.`);
  console.log(`              -> Mexico: ${mexSquad.players.length} | ${opponent.name}: ${oppSquad.players.length}`);

  // 4. Pick the 4-3-3 starting XI per side (11 each = 22 total).
  const mexPicks = pickStarters(mexSquad.players);
  const oppPicks = pickStarters(oppSquad.players);
  console.log(
    `              -> XI picks: Mexico ${mexPicks.length} (${formationCount(mexPicks)}), ${opponent.name} ${oppPicks.length} (${formationCount(oppPicks)})`,
  );

  // 5. Build base player objects (without targets yet).
  const base: Array<Omit<RosterPlayer, "target" | "ai_rationale">> = [
    ...mexPicks.map(({ player, position, posRank }): Omit<RosterPlayer, "target" | "ai_rationale"> => ({
      id: player.id,
      name: player.name,
      team: "Mexico",
      club: "",
      position,
      number: player.number ?? 0,
      age: player.age,
      difficulty: difficultyFor(position, posRank),
    })),
    ...oppPicks.map(({ player, position, posRank }): Omit<RosterPlayer, "target" | "ai_rationale"> => ({
      id: player.id,
      name: player.name,
      team: opponent.name,
      club: "",
      position,
      number: player.number ?? 0,
      age: player.age,
      difficulty: difficultyFor(position, posRank),
    })),
  ];

  // 6. Generate targets in one Gemini batch (with model-fallback chain).
  console.log("[seed-roster] Generating targets via Gemini…");
  const { targets: generated, model: usedModel } = await generateTargets(base, fixtureMeta, flags.model);

  // 7. Merge targets back into players. Match strictly by id, but fall back to
  // positional matching if Gemini returned the same count without preserving ids.
  const byId = new Map(generated.map((g) => [Number(g.player_id), g]));
  const sameCount = generated.length === base.length;
  let positionalMisses = 0;
  const players: RosterPlayer[] = base.map((p, i) => {
    let g = byId.get(p.id);
    if (!g && sameCount) {
      g = generated[i];
      positionalMisses++;
    }
    if (!g) {
      console.warn(`[seed-roster] No target generated for #${p.id} ${p.name}; using deterministic fallback.`);
      const fallback = deterministicTarget(p);
      return { ...p, target: fallback.target, ai_rationale: fallback.ai_rationale };
    }
    return { ...p, target: g.target, ai_rationale: g.ai_rationale };
  });
  if (positionalMisses > 0) {
    console.warn(`[seed-roster] Matched ${positionalMisses} player(s) positionally (Gemini didn't echo their player_id).`);
  }

  const roster: RosterData = {
    schema_version: 2,
    tournament: "FIFA World Cup 2026",
    matchday: `MD1 — ${homeTeam.name} vs ${awayTeam.name}`,
    fixture: fixtureMeta,
    ai_game_master: usedModel,
    players,
  };

  // 8. Write roster.json
  if (flags.dryRun) {
    console.log("\n[seed-roster] --dry-run: roster would be:");
    console.log(JSON.stringify(roster, null, 2));
    return;
  }
  await fs.mkdir(path.dirname(ROSTER_OUT), { recursive: true });
  await fs.writeFile(ROSTER_OUT, JSON.stringify(roster, null, 2));
  console.log(`[seed-roster] Wrote ${ROSTER_OUT} (${players.length} players)`);

  // 9. Upload to Walrus
  if (flags.skipUpload) {
    console.log("[seed-roster] --skip-upload: not uploading.");
  } else {
    console.log("[seed-roster] Uploading to Walrus…");
    const blobId = await uploadJsonToWalrus(roster);
    console.log("\n  ┌─ Walrus blob created");
    console.log(`  │  blob id: ${blobId}`);
    console.log("  └─ Update web/.env.local:");
    console.log(`     NEXT_PUBLIC_ROSTER_BLOB_ID=${blobId}`);
    console.log(`  └─ And set rosterBlobId for 'genesis-wc' in web/lib/pools.ts.`);
  }

  console.log(`\n[seed-roster] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

main().catch((e) => {
  console.error("\n[seed-roster] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
