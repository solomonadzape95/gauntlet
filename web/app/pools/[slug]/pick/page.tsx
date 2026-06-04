import { notFound, redirect } from "next/navigation";
import { fetchRoster } from "@/lib/walrus";
import { getPoolFromConvex } from "@/lib/pools-server";
import { formatSui } from "@/lib/sui";
import { PlayerGrid } from "./player-grid";
import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import type { Player } from "@/lib/types";

export const revalidate = 60;

export default async function PoolPickPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pool = await getPoolFromConvex(slug);

  if (!pool) {
    notFound();
  }

  // Soon pools — bounce back to the detail page (which renders the locked view)
  if (pool.status !== "live") {
    redirect(`/pools/${slug}`);
  }

  let players: Player[] = [];
  try {
    if (pool.rosterBlobId) {
      const roster = await fetchRoster(pool.rosterBlobId);
      players = roster.players;
    }
  } catch (e) {
    console.error("Roster fetch failed:", e);
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-16">
          <div className="text-utility text-zinc-500 mb-3">
            {pool.season} · {players.length} players
            {pool.entryFeeMist
              ? ` · ${formatSui(BigInt(pool.entryFeeMist))} SUI entry`
              : ""}
          </div>
          <h1 className="font-serif text-display-lg max-w-3xl">
            Pick your fighter.
          </h1>
          <p className="mt-5 text-lg text-zinc-300 leading-relaxed max-w-2xl">
            Each player&apos;s target is set by the AI Game Master. Tap a card to see the full rationale and mint the Survival Pass.
          </p>
        </section>
      </CornerFrame>

      <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12">
        <PlayerGrid
          players={players}
          poolId={pool.poolId ?? "0x0"}
        />
      </section>
    </main>
  );
}
