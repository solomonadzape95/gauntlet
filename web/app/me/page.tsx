"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery as useConvexQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { Flag } from "@/components/icons/flag";
import { Crest } from "@/components/icons/crest";
import { useMyPasses, type MyPass } from "@/lib/hooks/use-my-passes";
import { useRoster } from "@/lib/hooks/use-roster";
import { usePoolState, type PoolState } from "@/lib/hooks/use-pool-state";
import {
  POOL_OBJECT_ID,
  shortAddress,
  formatSui,
  suiscanObject,
} from "@/lib/sui";
import { survivalWeight, weightedPayout } from "@/lib/odds";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/cn";

interface ConvexPassRow {
  passId: string;
  poolObjectId: string;
  playerId: number;
  status: "alive" | "out" | "cashed";
  mintedAtMs: number;
}

export default function MePage() {
  // All hooks must run in the same order on every render — keep them above
  // any early returns. Adding a hook below an early return would break the
  // Rules of Hooks the moment that condition flips between renders.
  const account = useCurrentAccount();
  const { data: passes, isLoading: passesLoading } = useMyPasses();
  const { data: roster, isLoading: rosterLoading } = useRoster();
  const { data: pool } = usePoolState();
  const [query, setQuery] = useState("");

  // Cashed passes are BURNED on-chain, so `useMyPasses` (chain read) can't see
  // them. Convex keeps the record — pull it so cashed passes still show as
  // history instead of silently vanishing.
  const convexPasses = useConvexQuery(
    api.passes.listByOwner,
    convexConfigured && account ? { ownerAddress: account.address } : "skip",
  ) as ConvexPassRow[] | undefined;

  const playerMap = useMemo(
    () => new Map<number, Player>((roster?.players ?? []).map((p) => [p.id, p])),
    [roster],
  );

  if (!account) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          title="My Passes"
          body="Connect a wallet to see your Survival Passes."
        />
      </main>
    );
  }

  if (passesLoading || rosterLoading) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          body={
            <span className="inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </span>
          }
        />
      </main>
    );
  }

  const q = query.toLowerCase().trim();

  const matches = (passPlayerId: number) => {
    if (!q) return true;
    const player = playerMap.get(passPlayerId);
    if (!player) return false;
    return (
      player.name.toLowerCase().includes(q) ||
      player.team.toLowerCase().includes(q) ||
      player.club.toLowerCase().includes(q) ||
      player.position.toLowerCase().includes(q)
    );
  };

  const active = (passes ?? []).filter(
    (p) => p.pool_id === POOL_OBJECT_ID && matches(p.player_id),
  );
  const archived = (passes ?? []).filter(
    (p) => p.pool_id !== POOL_OBJECT_ID && matches(p.player_id),
  );
  const cashed: MyPass[] = (convexPasses ?? [])
    .filter((p) => p.status === "cashed")
    .map((p) => ({
      id: p.passId,
      pool_id: p.poolObjectId,
      player_id: p.playerId,
      minted_at_ms: BigInt(p.mintedAtMs ?? 0),
    }))
    .filter((p) => matches(p.player_id));
  const hasCashed = (convexPasses ?? []).some((p) => p.status === "cashed");
  const hasAnyPass = (passes ?? []).length > 0 || hasCashed;
  const hasFilteredResults =
    active.length + archived.length + cashed.length > 0;

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-14">
          <div className="text-utility text-zinc-500 mb-3">
            {shortAddress(account.address, 6, 6)}
          </div>
          <h1 className="text-display-lg leading-none">My Passes.</h1>
          <p className="mt-4 text-zinc-400 max-w-xl">
            Every Survival Pass you&apos;ve minted, organized by pool. Click any
            card to manage it — cashing out, viewing transactions, or checking status.
          </p>
        </section>
      </CornerFrame>

      {hasAnyPass && (
        <section className="border-b border-zinc-900">
          <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-6">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search by player, team, club, or position…"
            />
          </div>
        </section>
      )}

      {!hasAnyPass ? (
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-16">
          <div className="border border-zinc-900 p-12 text-center">
            <h2 className="text-2xl font-semibold mb-3">No passes yet</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              You haven&apos;t minted a Survival Pass on this wallet. Start by
              picking a player.
            </p>
            <Link href="/pools">
              <Button variant="hazard" size="lg" bullet>
                Browse pools
              </Button>
            </Link>
          </div>
        </section>
      ) : !hasFilteredResults ? (
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-16">
          <div className="border border-zinc-900 border-dashed p-12 text-center text-zinc-500">
            No passes match &ldquo;{query}&rdquo;.
          </div>
        </section>
      ) : (
        <>
          {active.length > 0 && (
            <section className="border-b border-zinc-900">
              <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12">
                <SectionHeading
                  label="Active pool"
                  count={active.length}
                  note="Cashout available here when survivors are settled."
                />
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {active.map((p) => (
                    <PassRowCard
                      key={p.id}
                      pass={p}
                      player={playerMap.get(p.player_id)}
                      pool={pool ?? null}
                      isCurrent
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section className={cashed.length > 0 ? "border-b border-zinc-900" : ""}>
              <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12">
                <SectionHeading
                  label="Archive"
                  count={archived.length}
                  note="Passes from previous pools. Read-only."
                />
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {archived.map((p) => (
                    <PassRowCard
                      key={p.id}
                      pass={p}
                      player={playerMap.get(p.player_id)}
                      pool={null}
                      isCurrent={false}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {cashed.length > 0 && (
            <section>
              <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12">
                <SectionHeading
                  label="Cashed out"
                  count={cashed.length}
                  note="Winnings claimed. The pass NFT was burned on-chain; this is the record."
                />
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cashed.map((p) => (
                    <PassRowCard
                      key={p.id}
                      pass={p}
                      player={playerMap.get(p.player_id)}
                      pool={null}
                      isCurrent={false}
                      overrideStatus={{
                        label: "Cashed out",
                        tone: "text-emerald-400",
                        accent: true,
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function SectionHeading({
  label,
  count,
  note,
}: {
  label: string;
  count: number;
  note: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-zinc-900 pb-4">
      <div>
        <div className="text-utility text-zinc-500 mb-1">{label}</div>
        <div className="text-2xl md:text-3xl font-semibold tracking-tight">
          {count} pass{count === 1 ? "" : "es"}
        </div>
      </div>
      <div className="text-utility text-zinc-500 hidden md:block max-w-xs text-right">
        {note}
      </div>
    </div>
  );
}

function PassRowCard({
  pass,
  player,
  pool,
  isCurrent,
  overrideStatus,
}: {
  pass: MyPass;
  player: Player | undefined;
  pool: PoolState | null;
  isCurrent: boolean;
  overrideStatus?: { label: string; tone: string; accent: boolean };
}) {
  const { label, tone, accent } =
    overrideStatus ?? statusFor(pass, pool, isCurrent, player);

  return (
    <Link
      href={`/pass/${pass.id}`}
      className={cn(
        "group relative border bg-ink-surface transition-colors flex flex-col",
        accent ? "border-hazard/40" : "border-zinc-900",
        "hover:border-zinc-700",
      )}
    >
      {/* Top accent stripe */}
      <div
        className={cn(
          "h-0.5",
          accent ? "bg-hazard" : "bg-zinc-800",
        )}
      />

      <div className="p-5 flex-1 flex flex-col">
        <div className="text-utility text-zinc-500 mb-2">
          Pass #{String(pass.player_id).padStart(2, "0")}
        </div>

        <div className="text-xl md:text-2xl font-semibold tracking-tight leading-tight">
          {player?.name ?? `Player #${pass.player_id}`}
        </div>

        {player && (
          <div className="mt-3 flex items-center gap-2">
            <Flag country={player.team} width={24} />
            <Crest club={player.club} size={20} />
            <span className="text-utility text-zinc-500">
              {player.position}
            </span>
          </div>
        )}

        <div className="mt-auto pt-6 border-t border-zinc-900 flex items-center justify-between">
          <div className={cn("text-utility", tone)}>{label}</div>
          <ArrowUpRight className="size-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function statusFor(
  pass: MyPass,
  pool: PoolState | null,
  isCurrent: boolean,
  player: Player | undefined,
): { label: string; tone: string; accent: boolean } {
  if (!isCurrent) {
    return { label: "Archived pool", tone: "text-zinc-500", accent: false };
  }
  if (!pool) {
    return { label: "Loading status", tone: "text-zinc-500", accent: false };
  }
  if (pool.phase === 0) {
    return { label: "Kickoff pending", tone: "text-zinc-300", accent: false };
  }
  if (pool.phase === 1) {
    return { label: "Locked · settling soon", tone: "text-amber-300", accent: false };
  }
  if (pool.phase === 2) {
    if (pool.eliminated_players.includes(pass.player_id)) {
      return { label: "Out", tone: "text-zinc-500", accent: false };
    }
    // Weighted share of the FROZEN post-fee pot — mirrors the on-chain cashout
    // math and never drifts as other winners claim (unlike pot / alive_count).
    const payout = player
      ? weightedPayout(
          pool.net_pot_mist,
          survivalWeight(player.difficulty),
          pool.surviving_weight,
        )
      : 0n;
    return {
      label: `Through · cash out ${formatSui(payout)} SUI`,
      tone: "text-hazard",
      accent: true,
    };
  }
  return { label: "Pool closed", tone: "text-zinc-500", accent: false };
}

function Empty({
  title,
  body,
}: {
  title?: string;
  body: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      {title && <h1 className="text-display-md mb-4">{title}</h1>}
      <div className="text-zinc-400">{body}</div>
    </div>
  );
}
