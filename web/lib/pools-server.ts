import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

import type { PoolMeta, PoolStatus } from "@/lib/pools";
import { POOLS } from "@/lib/pools";

interface TournamentRow {
  slug: string;
  name: string;
  season: string;
  tagline: string;
  image: string;
  imageOriginal: string;
  status: "live" | "soon" | "done";
}

interface MatchdayRow {
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  date: string;
  fixture?: string;
  status: "live" | "soon" | "done";
  rosterBlobId?: string;
  matchdayResultsBlobId?: string;
  poolObjectId?: string;
  entryFeeMist?: string;
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Server-side pool lookup — supports both tournament slugs (e.g. "epl-weekly")
 * and synthetic matchday slugs (e.g. "world-cup-2026-md1"). Queries Convex
 * first; falls back to the hardcoded registry if Convex is unconfigured or the
 * record is missing.
 */
export async function getPoolFromConvex(slug: string): Promise<PoolMeta | null> {
  if (!CONVEX_URL) return POOLS[slug] ?? null;

  const [tournamentSlug, mdSlug] = splitPoolSlug(slug);

  try {
    const tournament = (await fetchQuery(api.tournaments.get, {
      slug: tournamentSlug,
    })) as TournamentRow | null;
    if (!tournament) return POOLS[slug] ?? null;

    if (mdSlug) {
      const matchday = (await fetchQuery(api.matchdays.getByMd, {
        tournamentSlug,
        mdSlug,
      })) as MatchdayRow | null;
      if (!matchday) return POOLS[slug] ?? null;
      return matchdayToPool(tournament, matchday);
    }

    return tournamentToPool(tournament);
  } catch (e) {
    console.warn(`[getPoolFromConvex] falling back to static for ${slug}:`, e);
    return POOLS[slug] ?? null;
  }
}

function tournamentToPool(t: TournamentRow): PoolMeta {
  return {
    slug: t.slug,
    name: t.name,
    season: t.season,
    tagline: t.tagline,
    image: t.image,
    imageOriginal: t.imageOriginal,
    status: t.status === "done" ? "soon" : (t.status as PoolStatus),
    tournament: t.slug,
  };
}

function matchdayToPool(t: TournamentRow, m: MatchdayRow): PoolMeta {
  return {
    slug: `${t.slug}-${m.mdSlug.toLowerCase()}`,
    name: `${t.name} · ${m.label}`,
    season: t.season,
    tagline: m.fixture ?? t.tagline,
    image: t.image,
    imageOriginal: t.imageOriginal,
    status: m.status === "done" ? "soon" : (m.status as PoolStatus),
    tournament: t.slug,
    poolId: m.poolObjectId,
    rosterBlobId: m.rosterBlobId,
    matchdayBlobId: m.matchdayResultsBlobId,
    entryFeeMist: m.entryFeeMist,
  };
}

function splitPoolSlug(slug: string): [string, string | null] {
  if (POOLS[slug]) return [slug, null];
  const re = /-(md\d+|r16|qf|sf|f)$/i;
  const m = slug.match(re);
  if (!m) return [slug, null];
  return [slug.slice(0, slug.length - m[0].length), m[1].toUpperCase()];
}
