"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Lock } from "lucide-react";

import { TopBar } from "@/components/site/top-bar";
import { MatchdayStrip } from "@/components/site/matchday-strip";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { PoolDetailClient } from "./pool-detail-client";
import { ClosedPoolHero } from "./closed-pool-hero";
import { usePool, useTournament } from "@/lib/hooks/use-tournaments";

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pool = usePool(slug);
  const tournament = useTournament(pool?.tournament);

  if (pool === null) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-3xl font-semibold mb-2">
            Pool not found
          </h1>
          <p className="text-zinc-400 mb-6">
            No pool with slug <code className="font-mono">{slug}</code>.
          </p>
          <Link href="/pools" className="text-zinc-400 hover:text-hazard">
            ← Back to pools
          </Link>
        </div>
      </main>
    );
  }

  if (pool === undefined) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center text-zinc-500">
          <Loader2 className="size-5 animate-spin mx-auto mb-3" />
          Loading…
        </div>
      </main>
    );
  }

  // Tournament containers (no on-chain Pool object) and coming-soon entries
  // render the overview shell — image + tagline + matchday schedule strip.
  // Any matchday with its own Pool object renders the live detail view, even
  // once it's settled ("done"): a played matchday still has results to show,
  // and routing it back to the overview would loop on the "Enter matchday" CTA.
  const isContainer = !pool.poolId;
  const isLiveContainer = isContainer && pool.status === "live";

  if (isContainer) {
    return (
      <TournamentOverview
        pool={pool}
        tournament={tournament}
        live={isLiveContainer}
      />
    );
  }

  return <PoolDetailClient pool={pool} />;
}

function TournamentOverview({
  pool,
  tournament,
  live,
}: {
  pool: {
    slug: string;
    name: string;
    season: string;
    tagline: string;
    image: string;
    imageOriginal: string;
    tournament?: string;
  };
  tournament: ReturnType<typeof useTournament>;
  live: boolean;
}) {
  // First live + minted matchday in this tournament — used as the "Enter live"
  // CTA so users don't have to fish through the strip.
  const firstLive =
    tournament?.schedule.find(
      (s) => s.pool && (s.status === "live" || s.status === "done"),
    ) ?? null;

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-14">
          <div className="grid grid-cols-12 gap-8 items-end">
            <div className="col-span-12 md:col-span-7 lg:col-span-8 relative">
              <ClosedPoolHero
                image={pool.image}
                imageOriginal={pool.imageOriginal}
                alt={pool.name}
              />
              <div className="pointer-events-none absolute inset-0 flex items-end p-5 md:p-7 bg-gradient-to-t from-black/60 via-black/0 to-black/0">
                <span className="inline-flex items-center gap-2 border border-zinc-700 bg-black/60 px-3 py-1.5 text-utility text-zinc-200 backdrop-blur-sm">
                  {live ? (
                    <>
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
                      />
                      Live tournament
                    </>
                  ) : (
                    <>
                      <Lock className="size-3 text-hazard" />
                      Coming soon
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 lg:col-span-4">
              <div className="text-utility text-zinc-500 mb-3 inline-flex items-center gap-2">
                {live ? (
                  <>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
                    />
                    Live · {pool.season}
                  </>
                ) : (
                  <>
                    <Lock className="size-3" />
                    {pool.season}
                  </>
                )}
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                {pool.name}
              </h1>
              <p className="mt-4 text-base md:text-lg text-zinc-300 leading-relaxed">
                {pool.tagline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {firstLive?.pool ? (
                  <Link href={`/pools/${firstLive.pool}`}>
                    <Button variant="hazard" size="lg" bullet>
                      Enter {firstLive.matchday}{" "}
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </Link>
                ) : live ? (
                  <span className="text-utility text-zinc-500">
                    First matchday opens soon — admin spawns the on-chain pool.
                  </span>
                ) : (
                  <span className="text-utility text-zinc-500">
                    Locked · part of Season 1.
                  </span>
                )}
                <Link
                  href="/pools"
                  className="text-utility text-zinc-400 hover:text-hazard transition-colors"
                >
                  ← All gauntlets
                </Link>
              </div>
            </div>
          </div>
        </section>
      </CornerFrame>

      {tournament && (
        <MatchdayStrip tournament={tournament} currentPoolSlug={pool.slug} />
      )}
    </main>
  );
}
