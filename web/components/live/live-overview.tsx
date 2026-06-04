"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";

interface TournamentRow {
  _id: string;
  slug: string;
  name: string;
  season: string;
  tagline: string;
  image: string;
  status: "live" | "soon" | "done";
}

interface MatchdayRow {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  date: string;
  fixture?: string;
  status: "live" | "soon" | "done";
  poolObjectId?: string;
}

/**
 * Cross-tournament live-pool grid. Used on both the admin /live overview
 * (linking to /pools/[slug]/live so admins can watch the broadcast view) and
 * the public /live page (same destination). Set `audience="admin"` to use
 * admin-flavored copy and link colors.
 */
export function LiveOverview({ audience }: { audience: "admin" | "public" }) {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;

  if (!convexConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">
        Convex isn&apos;t configured yet. Live data unavailable.
      </div>
    );
  }
  if (tournaments === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">
        <Loader2 className="size-5 animate-spin mx-auto mb-3" />
        Loading…
      </div>
    );
  }
  const liveTournaments = tournaments.filter((t) => t.status === "live");

  if (liveTournaments.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">
        No live tournaments right now.
        {audience === "admin" && (
          <>
            {" "}
            Flip one to{" "}
            <code className="font-mono text-zinc-300">live</code> from{" "}
            <Link
              href="/admin/tournaments"
              className="text-hazard hover:underline"
            >
              /admin/tournaments
            </Link>
            .
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10 md:space-y-12">
      {liveTournaments.map((t) => (
        <TournamentBlock key={t._id} tournament={t} audience={audience} />
      ))}
    </div>
  );
}

function TournamentBlock({
  tournament,
  audience,
}: {
  tournament: TournamentRow;
  audience: "admin" | "public";
}) {
  const matchdays = useQuery(
    api.matchdays.listForTournament,
    convexConfigured ? { tournamentSlug: tournament.slug } : "skip",
  ) as MatchdayRow[] | undefined;

  const liveMds = (matchdays ?? []).filter(
    (m) => m.status === "live" && m.poolObjectId,
  );

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-utility text-hazard inline-flex items-center gap-2 mb-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
            />
            Live tournament
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
            {tournament.name}
          </h2>
          <p className="mt-1 text-utility text-zinc-500">{tournament.season}</p>
        </div>
        {audience === "admin" && (
          <Link
            href={`/admin/tournaments/${tournament.slug}`}
            className="text-utility text-zinc-500 hover:text-hazard inline-flex items-center gap-1.5"
          >
            Manage <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>

      {matchdays === undefined && (
        <div className="border border-zinc-900 p-5 inline-flex items-center gap-2 text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Loading matchdays…
        </div>
      )}
      {matchdays && liveMds.length === 0 && (
        <div className="border border-zinc-900 p-5 text-zinc-500">
          No live matchdays for this tournament.
        </div>
      )}
      {liveMds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {liveMds.map((m) => (
            <Link
              key={m._id}
              href={`/pools/${tournament.slug}-${m.mdSlug.toLowerCase()}/live`}
              className="group border border-zinc-900 bg-ink-surface p-5 hover:border-hazard transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm tracking-wider text-zinc-100">
                  {m.label}
                </div>
                <span className="text-utility text-hazard inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
                  />
                  Live
                </span>
              </div>
              <div className="text-base text-zinc-100">
                {m.fixture ?? `${tournament.name} · ${m.label}`}
              </div>
              <div className="text-utility text-zinc-500">{m.date}</div>
              <div className="mt-auto pt-3 border-t border-zinc-900 text-utility text-zinc-500 inline-flex items-center justify-between">
                Watch live
                <ArrowUpRight className="size-3.5 text-zinc-600 group-hover:text-hazard transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
