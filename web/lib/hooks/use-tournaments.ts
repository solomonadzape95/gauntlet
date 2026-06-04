"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import type { PoolMeta, PoolStatus } from "@/lib/pools";
import type { MatchdaySlot, MatchdayStatus, Tournament } from "@/lib/tournaments";
import { POOLS, POOL_LIST } from "@/lib/pools";
import { TOURNAMENTS, TOURNAMENT_LIST } from "@/lib/tournaments";

/**
 * Convex-backed hooks that shape Convex rows into the existing PoolMeta /
 * Tournament shapes the rest of the app expects. When Convex is unconfigured
 * or still loading, we fall back to the hardcoded registries so SSR + first
 * paint never look empty.
 */

interface TournamentRow {
  _id: string;
  slug: string;
  name: string;
  season: string;
  tagline: string;
  image: string;
  imageOriginal: string;
  status: PoolStatus | "done";
  playerPoolBlobId?: string;
}

interface MatchdayRow {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  date: string;
  fixture?: string;
  status: MatchdayStatus;
  rosterBlobId?: string;
  matchdayResultsBlobId?: string;
  poolObjectId?: string;
  entryFeeMist?: string;
}

function rowToTournament(row: TournamentRow, matchdays: MatchdayRow[]): Tournament {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    schedule: matchdays
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m): MatchdaySlot => ({
        matchday: m.label || m.mdSlug,
        date: m.date,
        pool: m.poolObjectId ? `${row.slug}-${m.mdSlug.toLowerCase()}` : null,
        status: m.status,
        fixture: m.fixture,
      })),
  };
}

function rowToPoolMeta(
  row: TournamentRow,
  md?: MatchdayRow,
): PoolMeta {
  // If a tournament has a "live" matchday, surface that matchday as its own pool
  // entry so we can navigate to /pools/<tournament>-<md>.
  if (md) {
    return {
      slug: `${row.slug}-${md.mdSlug.toLowerCase()}`,
      name: `${row.name} · ${md.label}`,
      season: row.season,
      tagline: md.fixture ?? row.tagline,
      image: row.image,
      imageOriginal: row.imageOriginal,
      status: md.status === "done" ? "soon" : (md.status as PoolStatus),
      tournament: row.slug,
      poolId: md.poolObjectId,
      rosterBlobId: md.rosterBlobId,
      matchdayBlobId: md.matchdayResultsBlobId,
      entryFeeMist: md.entryFeeMist,
    };
  }
  // Tournament container view — link to itself so consumers can still render
  // the matchday schedule strip + tournament context.
  return {
    slug: row.slug,
    name: row.name,
    season: row.season,
    tagline: row.tagline,
    image: row.image,
    imageOriginal: row.imageOriginal,
    status: row.status === "done" ? "soon" : (row.status as PoolStatus),
    tournament: row.slug,
  };
}

/** All tournaments (Convex), with hardcoded fallback. */
export function useTournaments(): Tournament[] {
  const rows = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;
  // Pull EVERY matchday row in one shot, fan out client-side. We can swap to
  // per-tournament queries if this gets large; for the demo it's a few dozen.
  // Convex doesn't expose a list-all on matchdays — we iterate tournament slugs.
  // For brevity, expose them via per-tournament hook (`useTournamentMatchdays`)
  // and reduce here with empty schedules.
  if (!convexConfigured || rows === undefined) return TOURNAMENT_LIST;
  return rows.map((r) => rowToTournament(r, []));
}

/** One tournament by slug — falls back to hardcoded. */
export function useTournament(slug: string | undefined | null): Tournament | null {
  const row = useQuery(
    api.tournaments.get,
    convexConfigured && slug ? { slug } : "skip",
  ) as TournamentRow | null | undefined;
  const matchdays = useTournamentMatchdayRows(slug ?? undefined);
  if (!slug) return null;
  if (!convexConfigured) return TOURNAMENTS[slug] ?? null;
  if (row === undefined) return TOURNAMENTS[slug] ?? null;
  if (row === null) return null;
  return rowToTournament(row, matchdays ?? []);
}

/** Raw matchday rows (used by detail pages + strip). */
export function useTournamentMatchdayRows(
  slug: string | undefined,
): MatchdayRow[] | undefined {
  return useQuery(
    api.matchdays.listForTournament,
    convexConfigured && slug ? { tournamentSlug: slug } : "skip",
  ) as MatchdayRow[] | undefined;
}

/** All pools surfaced from Convex tournaments + matchdays — Tournament containers
 * become "soon" pool cards; their "live" matchdays become standalone pool cards. */
export function usePools(): PoolMeta[] {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;
  // We need matchdays per tournament for this. Without a single batch endpoint,
  // we fall back to POOL_LIST until we wire per-tournament queries here. The
  // dedicated tournament detail page uses `useTournamentMatchdayRows` directly.
  if (!convexConfigured || !tournaments) return POOL_LIST;
  return tournaments.map((t) => rowToPoolMeta(t));
}

/** One pool by slug — supports both raw tournament slugs and `<tournament>-<md>` synthetic slugs. */
export function usePool(slug: string): PoolMeta | null {
  const [tournamentSlug, mdSlug] = splitPoolSlug(slug);
  const tournament = useQuery(
    api.tournaments.get,
    convexConfigured && tournamentSlug ? { slug: tournamentSlug } : "skip",
  ) as TournamentRow | null | undefined;
  const matchday = useQuery(
    api.matchdays.getByMd,
    convexConfigured && tournamentSlug && mdSlug
      ? { tournamentSlug, mdSlug: mdSlug.toUpperCase() }
      : "skip",
  ) as MatchdayRow | null | undefined;

  if (!convexConfigured) return POOLS[slug] ?? null;
  if (tournament === undefined || (mdSlug && matchday === undefined)) {
    return POOLS[slug] ?? null;
  }
  if (!tournament) return POOLS[slug] ?? null;
  return rowToPoolMeta(tournament, matchday ?? undefined);
}

function splitPoolSlug(slug: string): [string, string | null] {
  // Look up by exact tournament slug first; if not, the synthetic form is
  // `<tournament>-<mdslug-lower>` where mdslug is MD1/R16/QF/SF/F.
  if (POOLS[slug]) return [slug, null];
  // Common matchday tokens at the tail of the slug.
  const re = /-(md\d+|r16|qf|sf|f)$/i;
  const m = slug.match(re);
  if (!m) return [slug, null];
  const tournament = slug.slice(0, slug.length - m[0].length);
  return [tournament, m[1].toUpperCase()];
}
