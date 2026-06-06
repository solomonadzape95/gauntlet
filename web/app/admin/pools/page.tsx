"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2, Plus } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { shortAddress, formatSui, suiscanObject } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";
import { usePoolState } from "@/lib/hooks/use-pool-state";
import { grossPotFromNet } from "@/lib/odds";

interface MdRow {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  fixture?: string;
  date: string;
  status: "live" | "soon" | "done";
  rosterBlobId?: string;
  matchdayResultsBlobId?: string;
  poolObjectId?: string;
  entryFeeMist?: string;
}

interface TournamentRow {
  _id: string;
  slug: string;
  name: string;
}

/**
 * Admin pool browser. Lists every Convex matchday with an attached on-chain
 * Pool object, grouped by tournament. Click any row to manage its lifecycle
 * at /admin/pools/[poolId].
 */
export default function AdminPoolsListPage() {
  const matchdays = useQuery(
    api.matchdays.listForTournament,
    "skip",
  ); // placeholder — we use the multi-tournament loader below
  // Pull all tournaments first, then all matchdays per tournament.
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;

  void matchdays; // discard the placeholder

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Live · on-chain pools
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Live pools
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Every matchday that&apos;s minted its Sui Pool. Click one to watch the
            broadcast and lock, simulate, settle, or close it. Need a fresh pool?{" "}
            <Link
              href="/admin/tournaments"
              className="text-hazard hover:underline"
            >
              Create a matchday
            </Link>
            .
          </p>
        </section>
      </CornerFrame>

      {!convexConfigured && (
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-8">
          <div className="border border-amber-900/50 bg-amber-950/10 p-5 text-amber-200">
            Convex isn&apos;t configured — set{" "}
            <code className="font-mono">NEXT_PUBLIC_CONVEX_URL</code> and run{" "}
            <code className="font-mono">pnpm dlx convex dev</code>.
          </div>
        </div>
      )}

      {tournaments === undefined && convexConfigured && (
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-8 text-zinc-500 inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12 space-y-10">
          {(tournaments ?? []).map((t) => (
            <TournamentPoolGroup key={t._id} tournament={t} />
          ))}
          {tournaments && tournaments.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No tournaments yet. Spawn one from{" "}
              <Link
                href="/admin/tournaments"
                className="text-hazard hover:underline"
              >
                Tournaments
              </Link>
              .
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TournamentPoolGroup({
  tournament,
}: {
  tournament: TournamentRow;
}) {
  const mds = useQuery(
    api.matchdays.listForTournament,
    convexConfigured ? { tournamentSlug: tournament.slug } : "skip",
  ) as MdRow[] | undefined;

  const withPool = (mds ?? []).filter((m) => !!m.poolObjectId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-utility text-zinc-500">{tournament.slug}</div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
            {tournament.name}
          </h2>
        </div>
        <Link href={`/admin/tournaments/${tournament.slug}`}>
          <Button variant="outline" size="sm" bullet>
            Manage tournament
          </Button>
        </Link>
      </div>

      {mds === undefined && (
        <div className="border border-zinc-900 p-4 text-zinc-500 inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading matchdays…
        </div>
      )}

      {mds && withPool.length === 0 && (
        <div className="border border-zinc-900 p-5 text-zinc-500">
          No on-chain pools yet for this tournament.{" "}
          <Link
            href={`/admin/tournaments/${tournament.slug}/matchdays/new`}
            className="text-hazard hover:underline"
          >
            Spawn one
          </Link>
          .
        </div>
      )}

      {withPool.length > 0 && (
        <ul className="border border-zinc-900 divide-y divide-zinc-900">
          {withPool.map((m) => (
            <PoolRow key={m._id} md={m} />
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Link href={`/admin/tournaments/${tournament.slug}/matchdays/new`}>
          <Button variant="outline" size="sm" bullet>
            <Plus className="size-3.5" /> New matchday + pool
          </Button>
        </Link>
      </div>
    </div>
  );
}

function PoolRow({ md }: { md: MdRow }) {
  const poolId = md.poolObjectId ?? "0x0";
  const { data: pool } = usePoolState(poolId);

  const phaseLabel = pool
    ? ["OPEN", "LOCKED", "SETTLED", "CLOSED"][pool.phase] ?? "?"
    : "—";
  const phaseDot = pool
    ? (
        ["open", "locked", "settled", "closed"] as const
      )[pool.phase] ?? "open"
    : "open";

  // Stretched-link pattern: the row-level <Link> is an absolute overlay rather
  // than a wrapper, so the inner Suiscan <a> isn't nested inside it (nested
  // anchors are invalid HTML and break hydration). The Suiscan link is raised
  // above the overlay with `relative z-10` so it stays independently clickable.
  return (
    <li className="relative grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-zinc-900/40 transition-colors">
      <Link
        href={`/admin/pools/${poolId}`}
        aria-label={`Manage ${md.label}${md.fixture ? ` · ${md.fixture}` : ""}`}
        className="absolute inset-0"
      />
      <div className="col-span-3 md:col-span-2 font-mono text-sm text-zinc-100">
        {md.label}
      </div>
      <div className="col-span-9 md:col-span-4 min-w-0">
        <div className="text-base text-zinc-100 truncate">
          {md.fixture ?? "—"}
        </div>
        <div className="text-utility text-zinc-500 mt-0.5">{md.date}</div>
      </div>
      <div className="col-span-6 md:col-span-2 text-utility inline-flex items-center gap-2">
        <StatusDot status={phaseDot} />
        {phaseLabel}
      </div>
      <div className="col-span-6 md:col-span-2 text-utility text-zinc-500 inline-flex items-center gap-3">
        {pool ? (
          <>
            <span>{pool.total_passes} mints</span>
            <span className="font-mono">
              {formatSui(
                pool.phase >= 2
                  ? grossPotFromNet(pool.net_pot_mist)
                  : pool.pot_mist,
              )}{" "}
              SUI
            </span>
          </>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </div>
      <div className="col-span-10 md:col-span-1 relative z-10">
        <a
          href={suiscanObject(poolId)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-zinc-400 hover:text-hazard inline-flex items-center gap-1"
        >
          {shortAddress(poolId, 6, 4)}
          <ArrowUpRight className="size-3" />
        </a>
      </div>
      <div className="col-span-2 md:col-span-1 text-right">
        <ArrowUpRight className="size-4 text-zinc-600 inline" />
      </div>
    </li>
  );
}
