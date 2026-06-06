"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  ArrowUpRight,
  Flame,
  Loader2,
  Search as SearchIcon,
  Snowflake,
  TrendingUp,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { PACKAGE_ID, formatSui, suiscanTx } from "@/lib/sui";
import {
  assertTxSuccess,
  describeTxError,
  isUserRejection,
} from "@/lib/tx-errors";
import type { PoolMeta } from "@/lib/pools";
import {
  MATCH_SIM_CHANNEL,
  SIM_DURATION_MS,
  simSnapshot,
  type MatchSimEvent,
} from "@/lib/match-sim";
import {
  usePoolState,
  poolStateKey,
  PHASE_LABEL,
  PHASE_DOT,
  type PoolState,
} from "@/lib/hooks/use-pool-state";
import { useMintCounts, mintCountsKey } from "@/lib/hooks/use-mint-counts";
import { useMyPasses, MY_PASSES_KEY, type MyPass } from "@/lib/hooks/use-my-passes";
import { useRoster } from "@/lib/hooks/use-roster";
import { fetchMatchday } from "@/lib/walrus";

import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { BigNumber } from "@/components/ui/big-number";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import {
  survivalLikelihood,
  survivalWeight,
  weightedPayout,
  estimateSurvivorCount,
  payoutIfSurvives,
  payoutActual,
  payoutBestCase,
  grossPotFromNet,
  settledSurvivorPasses,
  PLATFORM_FEE_BPS,
} from "@/lib/odds";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/cn";

import { CompareModal } from "./compare-modal";
import { MatchBroadcast } from "@/components/live/match-broadcast";

interface RankedPlayer {
  player: Player;
  count: number;
}

interface MatchdayResult {
  hitTarget: boolean;
  stats: Record<string, number>;
}

const PHASE_TAGLINE: Record<number, string> = {
  0: "Pool open.",
  1: "Locked. Matchday incoming.",
  2: "Settled. Survivors cash out.",
  3: "Pool closed.",
};

export function LiveClient({ pool: poolMeta }: { pool: PoolMeta }) {
  const poolId = poolMeta.poolId ?? "0x0";
  const { data: pool, isLoading: poolLoading } = usePoolState(poolId);
  const counts = useMintCounts(poolId);
  const { data: passes } = useMyPasses();

  // Subscribe to the Convex matchday row for THIS pool so we pick up the new
  // matchdayResultsBlobId the moment the admin presses "Publish + Settle"
  // — without this, the prop is server-rendered + frozen at first render.
  const matchdayRow = useConvexQuery(
    api.matchdays.getByPool,
    convexConfigured && poolId !== "0x0"
      ? { poolObjectId: poolId }
      : "skip",
  ) as { rosterBlobId?: string; matchdayResultsBlobId?: string } | null | undefined;

  // Autonomous-loop state for this pool — drives the public auto-lock countdown.
  const automation = useConvexQuery(
    api.automation.forPool,
    convexConfigured && poolId !== "0x0" ? { poolObjectId: poolId } : "skip",
  ) as
    | { enabled: boolean; status: string; lockDelayMs: number; lastMintAtMs?: number }
    | null
    | undefined;

  const rosterBlobId =
    matchdayRow?.rosterBlobId ?? poolMeta.rosterBlobId ?? "";
  const matchdayBlobId =
    matchdayRow?.matchdayResultsBlobId ?? poolMeta.matchdayBlobId ?? "";

  const { data: roster, isLoading: rosterLoading } = useRoster(rosterBlobId);

  const { data: matchday } = useQuery({
    queryKey: ["matchday", poolMeta.slug, matchdayBlobId],
    queryFn: () => fetchMatchday(matchdayBlobId),
    enabled: !!matchdayBlobId,
    staleTime: 5 * 60 * 1000,
  });

  const [query, setQuery] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

  // Match simulation — driven by the admin's "Run match" button via either
  // BroadcastChannel (same browser) OR a Convex live-query (any device).
  const [simStartedAt, setSimStartedAt] = useState<number | null>(null);
  const [simElapsed, setSimElapsed] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ch = new BroadcastChannel(MATCH_SIM_CHANNEL);
    ch.onmessage = (e) => {
      const evt = e.data as MatchSimEvent;
      if (evt.type === "start") {
        setSimStartedAt(evt.startedAt);
        setSimElapsed(0);
      } else if (evt.type === "stop") {
        setSimStartedAt(null);
        setSimElapsed(0);
      }
    };
    return () => ch.close();
  }, []);

  // Cross-device sim driver — Convex live-query. Picks up the latest run
  // even if the admin is on a different browser / device.
  const simRowsForDriver = useConvexQuery(
    api.matchSim.latest,
    convexConfigured && poolId !== "0x0"
      ? { poolObjectId: poolId, limit: 200 }
      : "skip",
  ) as
    | Array<{ type: string; payload: { startedAt: number } }>
    | undefined;

  useEffect(() => {
    if (!simRowsForDriver || simRowsForDriver.length === 0) return;
    let latestStart = 0;
    let aborted = false;
    for (const r of simRowsForDriver) {
      const t = Number(r.payload?.startedAt ?? 0);
      if (t > latestStart) {
        latestStart = t;
        aborted = false;
      }
      if (t === latestStart && r.type === "Sim:stop") aborted = true;
    }
    if (latestStart === 0) return;
    if (aborted) {
      setSimStartedAt(null);
      setSimElapsed(0);
      return;
    }
    setSimStartedAt((cur) => (cur === latestStart ? cur : latestStart));
  }, [simRowsForDriver]);

  useEffect(() => {
    if (!simStartedAt) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - simStartedAt;
      setSimElapsed(elapsed);
      if (elapsed >= SIM_DURATION_MS) {
        clearInterval(id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [simStartedAt]);

  const simActive = simStartedAt !== null && simElapsed < SIM_DURATION_MS;

  if (poolLoading || rosterLoading) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          body={
            <span className="inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading pool…
            </span>
          }
        />
      </main>
    );
  }

  if (!roster) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          title="Roster unavailable"
          body="Couldn't fetch the roster from Walrus. Try refreshing."
        />
      </main>
    );
  }

  if (!pool || poolId === "0x0") {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          title="No active pool"
          body={`The ${poolMeta.name} pool isn't on chain yet.`}
        />
      </main>
    );
  }

  // Post-settle, group survivors ahead of the eliminated so the outcome reads
  // top-to-bottom; within each group keep the pick-popularity ordering.
  const settledForSort = pool.phase >= 2;
  const eliminatedSet = new Set(pool.eliminated_players);
  const ranked: RankedPlayer[] = roster.players
    .map((player) => ({ player, count: counts[player.id] ?? 0 }))
    .sort((a, b) => {
      if (settledForSort) {
        const aOut = eliminatedSet.has(a.player.id) ? 1 : 0;
        const bOut = eliminatedSet.has(b.player.id) ? 1 : 0;
        if (aOut !== bOut) return aOut - bOut;
      }
      return b.count - a.count;
    });

  const myPasses = (passes ?? []).filter(
    (p) => p.pool_id === poolId,
  );
  const myPlayerIds = new Set(myPasses.map((p) => p.player_id));

  // Bar scale is the global max pick count — not ranked[0], which post-settle
  // is the top *survivor*, not necessarily the most-picked player.
  const maxCount = Math.max(1, ...ranked.map((r) => r.count));
  const totalPicks = Math.max(1, pool.total_passes);

  // Matchday results keyed by player_id. When the sim is active, overlay a
  // synthetic per-player snapshot so the leaderboard ticks like a broadcast.
  const matchdayResults: Record<number, MatchdayResult> = {};
  if (simActive && simStartedAt !== null) {
    for (const p of roster.players) {
      const snap = simSnapshot(p, simElapsed, simStartedAt);
      const metricKey = p.target.metric.replace(/_threshold$/, "");
      matchdayResults[p.id] = {
        hitTarget: snap.progress >= 1,
        stats: { [metricKey]: Number(snap.value.toFixed(1)), target: snap.target },
      };
    }
  } else {
    matchday?.results?.forEach((r) => {
      matchdayResults[r.player_id] = {
        hitTarget: r.hit_target,
        stats: r.stats,
      };
    });
  }

  const simSurvivorCount = simActive
    ? roster.players.filter((p) => {
        const snap = simSnapshot(p, simElapsed, simStartedAt ?? 0);
        return snap.progress >= 1;
      }).length
    : 0;

  // Filter for list view
  const q = query.toLowerCase().trim();
  const filteredRanked = q
    ? ranked.filter(
        (r) =>
          r.player.name.toLowerCase().includes(q) ||
          r.player.club.toLowerCase().includes(q) ||
          r.player.team.toLowerCase().includes(q) ||
          r.player.position.toLowerCase().includes(q),
      )
    : ranked;

  const estSurvivors = estimateSurvivorCount(roster.players, counts);
  const isSettled = pool.phase >= 2;
  // Post-settle aggregates must come from FROZEN snapshots, not the live chain
  // fields the contract drains on every cashout (alive_count / pot). Survivor
  // count derives from mint counts + eliminations (both fixed at lock); the
  // prize pool reconstructs the gross-at-settle from the post-fee snapshot.
  const survivorPasses = settledSurvivorPasses(
    pool.total_passes,
    counts,
    pool.eliminated_players,
  );
  const displayPotMist = isSettled
    ? grossPotFromNet(pool.net_pot_mist)
    : pool.pot_mist;
  // Post-settle: header shows the AVERAGE net-pot share (the real per-pass
  // payout is weighted per pick — computed per row below). Pre-settle: keep the
  // estimate for "vibes" but every per-row number derives from `counts`.
  const payoutPerSurvivor = isSettled
    ? payoutActual(pool.net_pot_mist, survivorPasses)
    : payoutIfSurvives(pool.pot_mist, estSurvivors);

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Sim banner — only when admin is running the simulation */}
      {simActive && simStartedAt !== null && (
        <SimBanner
          elapsed={simElapsed}
          fixtureLabel={poolMeta.name}
          survivorCount={simSurvivorCount}
          totalCount={roster.players.length}
        />
      )}

      {/* Auto-lock countdown — only while open and the loop is driving this pool. */}
      {pool.phase === 0 && !simActive && automation?.enabled && (
        <AutoLockBanner
          lockAtMs={
            automation.lastMintAtMs
              ? automation.lastMintAtMs + automation.lockDelayMs
              : null
          }
          lockDelaySec={Math.round(automation.lockDelayMs / 1000)}
        />
      )}

      {/* Settled banner — shouts the match outcome the moment phase flips. */}
      {isSettled && !simActive && (
        <SettledBanner
          survivorPasses={survivorPasses}
          totalPasses={pool.total_passes}
          netPotMist={pool.net_pot_mist}
        />
      )}

      {/* Hero */}
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-14">
          <div className="text-utility text-zinc-500 mb-3 inline-flex items-center gap-2">
            <StatusDot status={PHASE_DOT[pool.phase]} />
            Live · {PHASE_LABEL[pool.phase]}
          </div>
          <h1 className="text-display-lg max-w-3xl">
            {PHASE_TAGLINE[pool.phase] ?? "Pool"}
          </h1>
          <p className="mt-4 text-zinc-400 max-w-xl">
            Every pick is on-chain. Counts refresh every 10 seconds — watch the pot grow as new passes mint and the heat shifts between players.
          </p>
        </section>
      </CornerFrame>

      {/* Live broadcast — scoreboard + event ticker driven by admin
          "Play full match" button via BroadcastChannel. */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-8">
          <MatchBroadcast
            homeName="Phoenix XI"
            awayName="Eclipse XI"
            roster={roster.players}
            poolId={poolId}
          />
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 pt-10 md:pt-12 pb-6 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
          <BigNumber
            label="Prize Pool"
            value={formatSui(displayPotMist)}
            unit="SUI"
            accent
          />
          <BigNumber
            label={isSettled ? "Survivors" : "Total Picks"}
            value={
              isSettled ? `${survivorPasses}` : String(pool.total_passes)
            }
            unit={isSettled ? `/ ${pool.total_passes}` : undefined}
          />
          <BigNumber
            label={isSettled ? "Avg / survivor" : "Payout / survivor"}
            value={formatSui(payoutPerSurvivor)}
            unit="SUI"
          />
          <BigNumber
            label="Entry"
            value={formatSui(pool.entry_fee_mist)}
            unit="SUI"
          />
        </div>
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 pb-8 -mt-2">
          <p className="text-xs text-zinc-500 leading-relaxed max-w-3xl">
            Survivors split the prize pool in proportion to how unlikely each
            pick was to survive — rarer survivals earn a bigger slice. A{" "}
            {PLATFORM_FEE_BPS / 100}% platform fee is deducted from the pool
            {isSettled ? " (already applied below)" : " at settlement"}.
          </p>
        </div>
      </section>

      {/* Single-click withdrawal — cashes out every surviving pass at once. */}
      {isSettled && (
        <WithdrawPanel
          poolId={poolId}
          passes={myPasses}
          roster={roster.players}
          pool={pool}
        />
      )}

      {/* Toolbar */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-4 flex flex-wrap items-center gap-3">
          <SearchBar value={query} onChange={setQuery} />
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen(true)}
            >
              Compare players
            </Button>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12">
          <ListView
            ranked={filteredRanked}
            maxCount={maxCount}
            totalPicks={totalPicks}
            pool={pool}
            myPlayerIds={myPlayerIds}
            passes={myPasses}
            roster={roster.players}
            matchdayResults={matchdayResults}
          />
        </div>
      </section>

      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        players={roster.players}
        pool={pool}
        counts={counts}
      />
    </main>
  );
}

/**
 * Post-settle withdrawal banner. Sums the viewer's surviving passes into one
 * weighted total and cashes them ALL out in a single transaction (one
 * `cashout` move-call per pass batched in one PTB), so a winner withdraws once
 * rather than pass-by-pass. Renders nothing if the viewer has no live winnings.
 */
function WithdrawPanel({
  poolId,
  passes,
  roster,
  pool,
}: {
  poolId: string;
  passes: MyPass[];
  roster: Player[];
  pool: PoolState;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const qc = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<
    "idle" | "signing" | "success" | "error"
  >("idle");
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerMap = useMemo(
    () => new Map(roster.map((p) => [p.id, p])),
    [roster],
  );

  // Passes the viewer still owns whose player survived — the only ones the
  // contract will let them cash out.
  const survivingPasses = passes.filter(
    (p) => !pool.eliminated_players.includes(p.player_id),
  );
  const total = survivingPasses.reduce((sum, p) => {
    const player = playerMap.get(p.player_id);
    if (!player) return sum;
    return (
      sum +
      weightedPayout(
        pool.net_pot_mist,
        survivalWeight(player.difficulty),
        pool.surviving_weight,
      )
    );
  }, 0n);

  if (survivingPasses.length === 0) return null;

  const handleWithdraw = async () => {
    if (!account) return;
    if (PACKAGE_ID === "0x0" || poolId === "0x0") {
      setStatus("error");
      setError("Package or Pool ID not configured.");
      return;
    }
    try {
      setStatus("signing");
      setError(null);

      const tx = new Transaction();
      for (const p of survivingPasses) {
        tx.moveCall({
          target: `${PACKAGE_ID}::pool::cashout`,
          arguments: [tx.object(poolId), tx.object(p.id)],
        });
      }

      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);

      await Promise.all([
        qc.invalidateQueries({ queryKey: poolStateKey(poolId) }),
        qc.invalidateQueries({ queryKey: mintCountsKey(poolId) }),
        qc.invalidateQueries({ queryKey: MY_PASSES_KEY(account.address) }),
      ]);

      setDigest(result.digest);
      setStatus("success");
    } catch (e) {
      if (isUserRejection(e)) {
        setStatus("idle");
        return;
      }
      // Force a fresh pool read so a stale UI doesn't keep offering a
      // withdrawal the chain just rejected.
      qc.refetchQueries({ queryKey: poolStateKey(poolId) });
      setStatus("error");
      setError(describeTxError(e) ?? "Withdrawal failed.");
    }
  };

  const passLabel = `${survivingPasses.length} winning pass${
    survivingPasses.length === 1 ? "" : "es"
  }`;

  return (
    <section className="border-b border-hazard/40 bg-hazard/[0.03]">
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-utility text-hazard mb-1">
            {status === "success" ? "✓ Withdrawn" : "Your winnings"}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular text-3xl md:text-4xl font-semibold text-zinc-100">
              {formatSui(total)}
            </span>
            <span className="text-utility text-zinc-500">SUI</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed max-w-xl">
            {passLabel} · weighted by survival odds. A {PLATFORM_FEE_BPS / 100}%
            platform fee was already deducted from the pool. One click cashes out
            every winning pass at once.
          </p>
          {error && (
            <div className="mt-2 text-sm text-red-400 break-words">{error}</div>
          )}
        </div>

        <div className="shrink-0">
          {status === "success" && digest ? (
            <a href={suiscanTx(digest)} target="_blank" rel="noopener noreferrer">
              <Button variant="hazard" size="lg" bullet>
                View transaction <ArrowUpRight className="size-4" />
              </Button>
            </a>
          ) : !account ? (
            <Button variant="outline" size="lg" disabled>
              Connect wallet to withdraw
            </Button>
          ) : (
            <Button
              variant="hazard"
              size="lg"
              bullet
              onClick={handleWithdraw}
              disabled={status === "signing"}
            >
              {status === "signing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Withdrawing…
                </>
              ) : (
                <>Withdraw {formatSui(total)} SUI</>
              )}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex-1 max-w-md">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
      <input
        type="text"
        placeholder="Search player, team, or club…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2 bg-ink-surface border border-zinc-800 rounded-full text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hazard transition-colors"
      />
    </div>
  );
}

// ───── List view ─────

function ListView({
  ranked,
  maxCount,
  totalPicks,
  pool,
  myPlayerIds,
  passes,
  roster,
  matchdayResults,
}: {
  ranked: RankedPlayer[];
  maxCount: number;
  totalPicks: number;
  pool: PoolState;
  myPlayerIds: Set<number>;
  passes: MyPass[];
  roster: Player[];
  matchdayResults: Record<number, MatchdayResult>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
      {/* Leaderboard */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div className="text-utility text-zinc-500">Pick popularity</div>
          <div className="text-utility text-zinc-600">
            {ranked.length} player{ranked.length === 1 ? "" : "s"} · {totalPicks} total
          </div>
        </div>

        <div className="space-y-2">
          {ranked.map((r, idx) => (
            <LeaderboardRow
              key={r.player.id}
              rank={idx + 1}
              player={r.player}
              count={r.count}
              maxCount={maxCount}
              totalPicks={totalPicks}
              pool={pool}
              isYours={myPlayerIds.has(r.player.id)}
              matchdayResult={matchdayResults[r.player.id]}
            />
          ))}
          {ranked.length === 0 && (
            <div className="border border-zinc-900 border-dashed p-8 text-center text-zinc-500 text-sm">
              No matches.
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <YourPicksPanel passes={passes} roster={roster} pool={pool} />
        <PulsePanel ranked={ranked} totalPicks={totalPicks} />
      </div>
    </div>
  );
}

function LeaderboardRow({
  rank,
  player,
  count,
  maxCount,
  totalPicks,
  pool,
  isYours,
  matchdayResult,
}: {
  rank: number;
  player: Player;
  count: number;
  maxCount: number;
  totalPicks: number;
  pool: PoolState;
  isYours: boolean;
  matchdayResult?: MatchdayResult;
}) {
  const isSettled = pool.phase >= 2;
  const isEliminated =
    isSettled && pool.eliminated_players.includes(player.id);
  const isSurvived = isSettled && !isEliminated;
  const likelihood = survivalLikelihood(player.difficulty);

  const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

  // Per-row payout:
  //  • Post-settle survivors WITH picks: the weighted per-pass share of the
  //    net pot (rarer survival ⇒ bigger slice). "your share" only when it's
  //    the viewer's own pick; everyone else reads "per pass".
  //  • Post-settle survivors with ZERO picks: nothing — nobody backed them, so
  //    there's no share to show (this is the old "your share on un-picked
  //    players" bug).
  //  • Post-settle eliminated: nothing (the "Out" pill says it all).
  //  • Pre-settle with picks: pot / count[player] — honest worst-case where
  //    only this player's holders survive.
  //  • Pre-settle with zero picks: no number (div-by-zero would confuse).
  const showPayout = isSettled ? isSurvived && count > 0 : count > 0;
  const rowPayout = isSettled
    ? weightedPayout(
        pool.net_pot_mist,
        survivalWeight(player.difficulty),
        pool.surviving_weight,
      )
    : payoutBestCase(pool.pot_mist, count);
  const payoutLabel = isSettled ? (isYours ? "your share" : "per pass") : "best case";

  return (
    <div
      className={cn(
        "flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 border transition-colors",
        isYours
          ? "border-hazard/60 bg-hazard/[0.03]"
          : "border-zinc-900",
        isEliminated && "opacity-50",
      )}
    >
      <span className="font-mono tabular text-utility text-zinc-600 w-6 text-right shrink-0">
        {String(rank).padStart(2, "0")}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <CountryFlag
          country={player.country ?? player.team}
          width={22}
        />
        <Crest club={player.club} size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-zinc-100 truncate">
            {player.name}
          </span>
          {isYours && (
            <span className="text-utility text-hazard">Yours</span>
          )}
          {isSurvived && (
            <span className="text-utility text-emerald-300">Survived</span>
          )}
          {isEliminated && (
            <span className="text-utility text-zinc-500">Out</span>
          )}
        </div>
        <div className="text-utility mt-1 inline-flex items-center gap-1.5 text-zinc-500">
          <span>{Math.round(likelihood * 100)}% likely</span>
          {matchdayResult && (
            <>
              <span className="text-zinc-700 mx-1">·</span>
              <span className="font-mono text-zinc-500">
                {Object.entries(matchdayResult.stats)
                  .slice(0, 2)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" ")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Payout estimate */}
      <div className="hidden md:flex flex-col items-end shrink-0 w-28">
        {showPayout ? (
          <>
            <div className="text-utility text-zinc-600">{payoutLabel}</div>
            <div className="font-mono tabular text-sm text-hazard">
              {formatSui(rowPayout)} SUI
            </div>
          </>
        ) : (
          <>
            <div className="text-utility text-zinc-700">
              {isEliminated ? "—" : "no picks"}
            </div>
            <div className="font-mono tabular text-sm text-zinc-700">—</div>
          </>
        )}
      </div>

      {/* Bar */}
      <div className="hidden sm:flex flex-col items-end gap-1.5 w-28 shrink-0">
        <div className="h-1 w-full bg-zinc-900 overflow-hidden">
          <div
            className={cn("h-full transition-all", isYours ? "bg-hazard" : "bg-zinc-600")}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="font-mono tabular text-[10px] text-zinc-500">
          {pct.toFixed(1)}%
        </div>
      </div>

      <div className="font-mono tabular text-sm text-zinc-200 w-8 text-right shrink-0">
        {count}
      </div>
    </div>
  );
}

function YourPicksPanel({
  passes,
  roster,
  pool,
}: {
  passes: MyPass[];
  roster: Player[];
  pool: PoolState;
}) {
  if (passes.length === 0) {
    return (
      <div className="border border-zinc-900 p-6">
        <div className="text-utility text-zinc-500 mb-3">Your picks</div>
        <p className="text-sm text-zinc-500 leading-relaxed">
          You haven&apos;t entered this pool yet.{" "}
          <Link
            href="/pools"
            className="text-hazard hover:underline whitespace-nowrap"
          >
            Browse pools →
          </Link>
        </p>
      </div>
    );
  }

  const playerMap = new Map(roster.map((p) => [p.id, p]));

  return (
    <div className="border border-zinc-900">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="text-utility text-zinc-500">Your picks</div>
        <div className="font-mono text-utility text-zinc-600 tabular">
          {passes.length}
        </div>
      </div>
      <div className="border-t border-zinc-900">
        {passes.map((p, idx) => {
          const player = playerMap.get(p.player_id);
          const isSettled = pool.phase >= 2;
          const isEliminated =
            isSettled && pool.eliminated_players.includes(p.player_id);
          const isSurvived = isSettled && !isEliminated;
          const status = isEliminated
            ? "Eliminated"
            : isSurvived
              ? "Survived · cash out"
              : pool.phase === 0
                ? "Awaiting matchday"
                : pool.phase === 1
                  ? "Locked"
                  : "Pool closed";
          const passPayout =
            isSurvived && player
              ? weightedPayout(
                  pool.net_pot_mist,
                  survivalWeight(player.difficulty),
                  pool.surviving_weight,
                )
              : 0n;
          return (
            <Link
              key={p.id}
              href={`/pass/${p.id}`}
              className={cn(
                "flex items-center justify-between gap-3 px-6 py-3 hover:bg-zinc-900/50 transition-colors border-t border-zinc-900/40",
                idx === 0 && "border-t-0",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-200 truncate">
                  {player?.name ?? `Player #${p.player_id}`}
                </div>
                <div className={cn("text-utility mt-0.5", isSurvived ? "text-hazard" : "text-zinc-500")}>
                  {status}
                </div>
              </div>
              {isSurvived && (
                <div className="font-mono tabular text-xs text-hazard">
                  {formatSui(passPayout)} SUI
                </div>
              )}
              <ArrowUpRight className="size-3.5 text-zinc-600 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PulsePanel({
  ranked,
  totalPicks,
}: {
  ranked: RankedPlayer[];
  totalPicks: number;
}) {
  const sorted = [...ranked].sort((a, b) => b.count - a.count);
  const hot = sorted.find((r) => r.count > 0);
  const cold = [...sorted].reverse()[0];
  const untouched = sorted.filter((r) => r.count === 0).length;

  return (
    <div className="border border-zinc-900 p-6">
      <div className="text-utility text-zinc-500 mb-5">Pulse</div>
      <div className="space-y-5">
        {hot ? (
          <PulseRow
            icon={<Flame className="size-4 text-hazard" />}
            label="Hottest"
            value={hot.player.name}
            note={`${hot.count} pick${hot.count === 1 ? "" : "s"} · ${
              ((hot.count / Math.max(1, totalPicks)) * 100).toFixed(0)
            }%`}
          />
        ) : (
          <PulseRow
            icon={<Flame className="size-4 text-zinc-500" />}
            label="Hottest"
            value="No picks yet"
            note="—"
          />
        )}

        {untouched > 0 ? (
          <PulseRow
            icon={<Snowflake className="size-4 text-sky-400" />}
            label="Untouched"
            value={`${untouched} player${untouched === 1 ? "" : "s"}`}
            note="0 picks · pure contrarian"
          />
        ) : cold ? (
          <PulseRow
            icon={<Snowflake className="size-4 text-sky-400" />}
            label="Most contrarian"
            value={cold.player.name}
            note={`${cold.count} pick${cold.count === 1 ? "" : "s"}`}
          />
        ) : null}

        <PulseRow
          icon={<TrendingUp className="size-4 text-emerald-400" />}
          label="Total volume"
          value={`${totalPicks > 1 ? totalPicks : 0} mint${totalPicks === 1 ? "" : "s"}`}
          note="across the pool"
        />
      </div>
    </div>
  );
}

function PulseRow({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-utility text-zinc-500">{label}</div>
        <div className="mt-1 text-sm font-medium text-zinc-100 truncate">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">{note}</div>
      </div>
    </div>
  );
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

/**
 * Top-of-page banner that flips on as soon as pool.phase >= 2. Tells the
 * viewer the match has been played without needing them to scroll the
 * leaderboard to figure out who survived.
 */
function SettledBanner({
  survivorPasses,
  totalPasses,
  netPotMist,
}: {
  survivorPasses: number;
  totalPasses: number;
  netPotMist: bigint;
}) {
  const perSurvivor = payoutActual(netPotMist, survivorPasses);
  return (
    <div className="sticky top-0 z-30 border-b border-emerald-500/40 bg-ink/85 backdrop-blur">
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-3 flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-2 text-utility text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-400" />
          SETTLED · matchday complete
        </span>
        <span className="text-utility text-zinc-300 tabular font-mono">
          {survivorPasses} / {totalPasses} survivors
        </span>
        <span className="ml-auto text-utility text-zinc-300 tabular font-mono">
          {formatSui(perSurvivor)} SUI / survivor
        </span>
      </div>
    </div>
  );
}

/**
 * Top-of-page banner shown while a match simulation is running. Pulse on the
 * left, fixture label in the middle, survivor counter on the right, and a
 * progress sliver at the very top showing elapsed / total.
 */
/**
 * Public auto-lock countdown. While the pool is open and the autonomous loop is
 * driving it, the pool locks `lockDelay` after the LAST mint — so every new
 * entry resets this clock. Shows the running countdown (or a "first entry"
 * prompt when nobody's minted yet).
 */
function AutoLockBanner({
  lockAtMs,
  lockDelaySec,
}: {
  lockAtMs: number | null;
  lockDelaySec: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSec = lockAtMs ? Math.max(0, Math.ceil((lockAtMs - now) / 1000)) : null;
  const mmss =
    remainingSec === null
      ? null
      : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`;

  return (
    <div className="sticky top-0 z-30 border-b border-hazard/40 bg-ink/85 backdrop-blur">
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-3 flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-2 text-utility text-hazard">
          <span aria-hidden className="size-2 rounded-full bg-hazard animate-pulse" />
          AUTO
        </span>
        {mmss ? (
          <span className="text-utility text-zinc-300 tabular font-mono">
            Locks in {mmss} — each new entry resets the clock
          </span>
        ) : (
          <span className="text-utility text-zinc-400">
            Locks {lockDelaySec}s after the first entry. Get a pick in to start the clock.
          </span>
        )}
        <span className="ml-auto text-utility text-zinc-500 hidden md:inline">
          Match runs automatically · winners withdraw after settle
        </span>
      </div>
    </div>
  );
}

function SimBanner({
  elapsed,
  fixtureLabel,
  survivorCount,
  totalCount,
}: {
  elapsed: number;
  fixtureLabel: string;
  survivorCount: number;
  totalCount: number;
}) {
  const remainingSec = Math.max(0, Math.ceil((SIM_DURATION_MS - elapsed) / 1000));
  const pct = Math.min(100, (elapsed / SIM_DURATION_MS) * 100);
  return (
    <div className="sticky top-0 z-30 border-b border-hazard/40 bg-ink/85 backdrop-blur">
      <div className="h-0.5 bg-hazard/30">
        <div
          className="h-full bg-hazard"
          style={{ width: `${pct}%`, transition: "width 250ms linear" }}
        />
      </div>
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-3 flex items-center gap-4">
        <span className="inline-flex items-center gap-2 text-utility text-hazard">
          <span className="size-2 rounded-full bg-hazard animate-pulse" />
          LIVE · sim
        </span>
        <span className="text-utility text-zinc-400 truncate hidden md:inline">
          {fixtureLabel}
        </span>
        <span className="ml-auto text-utility text-zinc-300 tabular font-mono">
          {survivorCount} / {totalCount} above target · {remainingSec}s left
        </span>
      </div>
    </div>
  );
}
