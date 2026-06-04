/**
 * AI roster filter — turns a natural-language description ("African U-27
 * midfielders", "Serbian players only") into a structured filter, applies
 * it to a cached master player list, and returns a draft roster.
 *
 * Day-5 scope: stub returning 501 with a clear "coming in Sui Overflow"
 * payload. The CreatePoolPanel's "bring your own Walrus blob ID" path is the
 * working alternative for the hackathon.
 *
 * When this gets built out:
 *   1. POST { query: string }
 *   2. Gemini call with a structured schema → { continents?, countries?,
 *      max_age?, min_age?, positions?, leagues?, keywords?, min_count? }
 *   3. Apply filter to Convex `players_master` table (seeded from API-Football
 *      using lib/api-football/client.ts).
 *   4. Pass the matching subset to the same target-generator we use in
 *      scripts/seed-roster.ts.
 *   5. Return { players: Player[], filter: AppliedFilter } for the UI to
 *      confirm before publishing to Walrus.
 */

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      message:
        "AI roster filter ships in Sui Overflow. For now, use CreatePoolPanel's 'Walrus blob ID' field to bring your own roster.",
      planned_schema: {
        continents: "string[] (optional)",
        countries: "string[] (ISO codes, optional)",
        min_age: "number (optional)",
        max_age: "number (optional)",
        positions: "string[] (GK | DF | MF | FW, optional)",
        leagues: "string[] (optional)",
        keywords: "string[] (optional)",
        min_count: "number (optional, desired roster size)",
      },
    }),
    {
      status: 501,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function GET() {
  return new Response(
    JSON.stringify({
      route: "/api/roster-filter",
      method: "POST",
      status: "stub",
      ships: "Sui Overflow",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
