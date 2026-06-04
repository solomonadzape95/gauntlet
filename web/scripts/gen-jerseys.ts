/**
 * Nano Banana jersey generator. Calls `gemini-2.5-flash-image-preview` (with
 * model-fallback to `imagen-3.0-generate-002` and `gemini-2.0-flash-exp`)
 * once per country, saves the resulting PNG under
 * `web/public/jerseys/<country-slug>.png`.
 *
 * Usage (from web/):
 *   pnpm dlx tsx scripts/gen-jerseys.ts                 # only countries in current roster
 *   pnpm dlx tsx scripts/gen-jerseys.ts --regen         # overwrite existing PNGs
 *   pnpm dlx tsx scripts/gen-jerseys.ts --all           # every country in team-colors.ts
 *   pnpm dlx tsx scripts/gen-jerseys.ts --countries=Mexico,South\ Africa
 *   pnpm dlx tsx scripts/gen-jerseys.ts --model=imagen-3.0-generate-002
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TEAM_COLORS, FALLBACK, type TeamColors, type JerseyPattern } from "../lib/team-colors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const ROSTER_PATH = path.join(REPO_ROOT, "data", "roster.json");
const OUT_DIR = path.join(WEB_ROOT, "public", "jerseys");

/**
 * Image-gen model chain. All Gemini image models are "Nano Banana" variants
 * — same family, just different release tracks (preview/exp/GA). We try
 * several known-good names in order because Google has shipped a few aliases
 * over the past year; "wrong model name" responses (404 / 400 "not
 * supported") fall through to the next.
 *
 * Imagen is included as a last-resort fallback because it's a separate
 * image-gen product on the same API (different endpoint shape). Remove the
 * `imagen-...` entries if you want Nano Banana only.
 */
const DEFAULT_MODEL_CHAIN = [
  // Nano Banana (Gemini 2.5 Flash Image) — try multiple aliases since Google
  // has shipped these IDs across preview/GA tracks.
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
  // Imagen — Google's other image-gen line. Last resort.
  "imagen-3.0-generate-002",
  "imagen-3.0-generate-001",
];

// ---- Flag parsing ----

interface Flags {
  regen: boolean;
  all: boolean;
  countries?: string[];
  model?: string;
  dryRun: boolean;
  listModels: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { regen: false, all: false, dryRun: false, listModels: false };
  for (const a of argv.slice(2)) {
    if (a === "--regen") flags.regen = true;
    else if (a === "--all") flags.all = true;
    else if (a === "--list-models" || a === "--list") flags.listModels = true;
    else if (a.startsWith("--countries=")) {
      flags.countries = a
        .slice("--countries=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith("--model=")) flags.model = a.slice("--model=".length);
    else if (a === "--dry-run") flags.dryRun = true;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return flags;
}

/**
 * Ask the Gemini API which models are visible to this API key and which
 * support image generation. Useful when the default chain 404s — the
 * authoritative list of names lives here, not in our chain config.
 */
async function listImageModels(apiKey: string): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not list models (${res.status}): ${detail.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      description?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  const models = j.models ?? [];

  // Filter: anything image-y. Heuristics: name contains "image", description
  // mentions image, or it's an Imagen model.
  const imageModels = models.filter((m) => {
    const id = m.name ?? "";
    const desc = (m.description ?? "").toLowerCase();
    return (
      /image|imagen|banana/i.test(id) ||
      /generate.*image|image.*generation|multimodal/i.test(desc)
    );
  });

  console.log(`\n[gen-jerseys] Image-capable models visible to your key (${imageModels.length}):\n`);
  for (const m of imageModels) {
    const id = (m.name ?? "").replace(/^models\//, "");
    const methods = m.supportedGenerationMethods?.join(", ") ?? "?";
    console.log(`  ${id.padEnd(48)} (${methods})`);
    if (m.description) {
      console.log(`    ${m.description.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  }
  if (imageModels.length === 0) {
    console.log("  (none) — image generation may not be enabled on your tier.");
    console.log("  Check https://aistudio.google.com/apikey for available models.");
  }
  console.log("\nRerun with --model=<id> to force a specific one. Example:");
  console.log("  pnpm gen:jerseys --model=gemini-2.5-flash-image\n");
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

function slug(country: string): string {
  return country
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function patternHint(pattern: JerseyPattern | undefined, colors: TeamColors): string {
  const accent = colors.accent ?? colors.secondary;
  switch (pattern) {
    case "stripes-vertical":
      return `Vertical stripes in ${accent} alternating with the primary color across the torso.`;
    case "checks":
      return `Small red-and-white checkerboard pattern across the torso (like Croatia's iconic kit).`;
    case "cross-accent":
      return `A horizontal and vertical ${accent} cross intersecting at the chest (like England's St-George cross).`;
    case "stars-stripes":
      return `Small white stars across an upper chest patch with thin horizontal stripes in ${accent} beneath.`;
    case "solid":
    default:
      return "Solid primary color across the torso, no pattern.";
  }
}

function buildPrompt(country: string, colors: TeamColors): string {
  return [
    `Studio product shot, back view of a soccer (football) jersey for the ${country} national team.`,
    `Photorealistic 3D render with visible fabric texture, subtle folds across the torso and sleeves, soft directional lighting from the upper-left producing gentle highlights and shadows.`,
    `Primary fabric color: ${colors.primary}.`,
    `Collar and sleeve cuffs in ${colors.secondary}.`,
    patternHint(colors.pattern, colors),
    `Centered composition. Solid ${colors.primary} background that matches the jersey color (so the jersey blends edge-to-edge with the frame).`,
    `Completely empty back of the jersey — no number, no name, no logo, no text of ANY kind anywhere on the fabric.`,
    `Front of jersey not visible. Square 1:1 aspect. High resolution.`,
  ].join(" ");
}

// ---- Country list resolution ----

async function loadRosterCountries(): Promise<string[]> {
  try {
    const raw = await fs.readFile(ROSTER_PATH, "utf8");
    const roster = JSON.parse(raw) as {
      players?: Array<{ team?: string }>;
      fixture?: { home?: string; away?: string };
    };
    const set = new Set<string>();
    if (roster.fixture?.home) set.add(roster.fixture.home);
    if (roster.fixture?.away) set.add(roster.fixture.away);
    for (const p of roster.players ?? []) {
      if (p.team) set.add(p.team);
    }
    return [...set];
  } catch {
    return [];
  }
}

function resolveCountries(flags: Flags, fromRoster: string[]): string[] {
  if (flags.countries && flags.countries.length > 0) return flags.countries;
  if (flags.all) return Object.keys(TEAM_COLORS);
  if (fromRoster.length > 0) return fromRoster;
  // Sensible default — the WC 2026 nations most likely to appear in early demos.
  return ["Mexico", "South Africa", "Argentina", "Brazil", "France", "England", "USA", "Germany", "Spain"];
}

// ---- Gemini image gen ----

function isTransient(status: number): boolean {
  return status === 503 || status === 429 || status === 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
}

/** Treated as "try next model" — model name is wrong/unsupported on this API version. */
function isWrongModel(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status === 400 && /not supported|not found|invalid model/i.test(body)) return true;
  return false;
}

/** Inline-data response shape — Gemini's `:generateContent` returns base64 PNG here. */
interface InlineCamel { mimeType?: string; data?: string }
interface InlineSnake { mime_type?: string; data?: string }
interface GeminiResponsePart {
  inlineData?: InlineCamel;
  inline_data?: InlineSnake;
}

async function callGeminiImage(model: string, apiKey: string, prompt: string): Promise<GeneratedImage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Image gen ${model} failed (${res.status}): ${detail.slice(0, 300)}`) as Error & {
      transient: boolean;
      wrongModel: boolean;
      status: number;
    };
    err.transient = isTransient(res.status);
    err.wrongModel = isWrongModel(res.status, detail);
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiResponsePart[] } }>;
  };
  for (const cand of j.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      const camel = part.inlineData;
      const snake = part.inline_data;
      const data = camel?.data ?? snake?.data;
      const mimeType = camel?.mimeType ?? snake?.mime_type ?? "image/png";
      if (data) {
        return { bytes: Buffer.from(data, "base64"), mimeType };
      }
    }
  }
  throw new Error(`Image gen ${model} returned no image part`);
}

interface ImagenPrediction {
  bytesBase64Encoded?: string;
  mimeType?: string;
}

async function callImagen(model: string, apiKey: string, prompt: string): Promise<GeneratedImage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
    },
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Imagen ${model} failed (${res.status}): ${detail.slice(0, 300)}`) as Error & {
      transient: boolean;
      wrongModel: boolean;
      status: number;
    };
    err.transient = isTransient(res.status);
    err.wrongModel = isWrongModel(res.status, detail);
    err.status = res.status;
    throw err;
  }
  const j = (await res.json()) as { predictions?: ImagenPrediction[] };
  const pred = j.predictions?.[0];
  if (!pred?.bytesBase64Encoded) {
    throw new Error(`Imagen ${model} returned no image. Body: ${JSON.stringify(j).slice(0, 200)}`);
  }
  return {
    bytes: Buffer.from(pred.bytesBase64Encoded, "base64"),
    mimeType: pred.mimeType ?? "image/png",
  };
}

async function callImageOnce(model: string, apiKey: string, prompt: string): Promise<GeneratedImage> {
  // Imagen models live behind a different endpoint shape.
  if (/^imagen/i.test(model)) return callImagen(model, apiKey, prompt);
  return callGeminiImage(model, apiKey, prompt);
}

async function generateImage(prompt: string, chain: string[]): Promise<{ image: GeneratedImage; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  let lastErr: Error | null = null;
  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const image = await callImageOnce(model, apiKey, prompt);
        return { image, model };
      } catch (e) {
        const err = e as Error & { transient?: boolean; wrongModel?: boolean; status?: number };
        lastErr = err;
        if (err.wrongModel) {
          console.warn(`     ${model} not available (${err.status}) — trying next model.`);
          break; // skip retry, fall through to next model
        }
        if (err.transient && attempt === 1) {
          console.warn(`     ${model} returned ${err.status} — retrying in 3s…`);
          await sleep(3000);
          continue;
        }
        if (err.transient) {
          console.warn(`     ${model} overloaded — trying next model in chain.`);
          break;
        }
        // Other unknown error — try next model rather than abort the whole batch.
        console.warn(`     ${model} errored (${err.status ?? "?"}) — trying next model. Detail: ${(err.message ?? "").slice(0, 120)}`);
        break;
      }
    }
  }
  throw lastErr ?? new Error("All models in the chain failed");
}

// ---- Main ----

async function main() {
  const flags = parseFlags(process.argv);
  await loadDotEnv(path.join(WEB_ROOT, ".env.local"));

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required. Add it to web/.env.local.");
  }

  if (flags.listModels) {
    await listImageModels(process.env.GEMINI_API_KEY);
    return;
  }

  const fromRoster = await loadRosterCountries();
  const countries = resolveCountries(flags, fromRoster);
  const chain = flags.model
    ? flags.model.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_MODEL_CHAIN;

  console.log(`[gen-jerseys] ${countries.length} countr${countries.length === 1 ? "y" : "ies"}: ${countries.join(", ")}`);
  console.log(`[gen-jerseys] Model chain: ${chain.join(" -> ")}`);
  if (flags.regen) console.log("[gen-jerseys] --regen: existing PNGs will be overwritten");
  if (flags.dryRun) console.log("[gen-jerseys] --dry-run: no files will be written");

  await fs.mkdir(OUT_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;
  let failed: string[] = [];

  for (const country of countries) {
    const file = path.join(OUT_DIR, `${slug(country)}.png`);
    if (!flags.regen) {
      try {
        await fs.access(file);
        console.log(`  ${country.padEnd(18)} SKIP   (exists at ${path.relative(WEB_ROOT, file)})`);
        skipped++;
        continue;
      } catch {
        // file doesn't exist, generate
      }
    }

    const colors = TEAM_COLORS[country] ?? FALLBACK;
    const prompt = buildPrompt(country, colors);
    console.log(`  ${country.padEnd(18)} GEN    …`);
    try {
      const { image, model } = await generateImage(prompt, chain);
      if (!flags.dryRun) {
        await fs.writeFile(file, image.bytes);
      }
      const sizeKb = Math.round(image.bytes.length / 1024);
      console.log(`  ${country.padEnd(18)} OK     ${model}, ${sizeKb} KB${flags.dryRun ? " (dry-run)" : ""}`);
      generated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ${country.padEnd(18)} FAIL   ${msg.slice(0, 200)}`);
      failed.push(country);
    }
  }

  console.log("");
  console.log(`[gen-jerseys] ${generated} generated, ${skipped} skipped, ${failed.length} failed`);
  if (failed.length > 0) {
    console.log(`              Failed: ${failed.join(", ")}`);
    console.log(`              These countries will render with the SVG fallback. Retry with --regen later.`);
  }
}

main().catch((e) => {
  console.error("\n[gen-jerseys] FAILED:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
