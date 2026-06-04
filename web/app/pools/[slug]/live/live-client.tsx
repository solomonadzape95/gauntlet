"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Flame,
  Loader2,
  Search as SearchIcon,
  Snowflake,
  TrendingUp,
} from "lucide-react";

import { formatSui } from "@/lib/sui";
import type { PoolMeta } from "@/lib/pools";
import {
  MATCH_SIM_CHANNEL,
  SIM_DURATION_MS,
  simSnapshot,
  type MatchSimEvent,
} from "@/lib/match-sim";
import {
  usePoolState,
  PHASE_LABEL,
  PHASE_DOT,
  type PoolState,
} from "@/lib/hooks/use-pool-state";
import { useMintCounts } from "@/lib/hooks/use-mint-counts";
import { useMyPasses, type MyPass } from "@/lib/hooks/use-my-passes";
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
  estimateSurvivorCount,
  payoutIfSurvives,
} from "@/lib/odds";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/cn";

import { GraphView } from "./graph-view";
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
  const matchdayBlobId = poolMeta.matchdayBlobId ?? "";
  const { data: pool, isLoading: poolLoading } = usePoolState(poolId);
  const counts = useMintCounts(poolId);
  const { data: passes } = useMyPasses();
  const { data: roster, isLoading: rosterLoading } = useRoster(
    poolMeta.rosterBlobId ?? "",
  );

  const { data: matchday } = useQuery({
    queryKey: ["matchday", poolMeta.slug, matchdayBlobId],
    queryFn: () => fetchMatchday(matchdayBlobId),
    enabled: !!matchdayBlobId,
    staleTime: 5 * 60 * 1000,
  });

  const [view, setView] = useState<"list" | "graph">("list");
  const [query, setQuery] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

  // Match simulation — driven by the admin's "Run match" button via BroadcastChannel.
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

  const ranked: RankedPlayer[] = roster.players
    .map((player) => ({ player, count: counts[player.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const myPasses = (passes ?? []).filter(
    (p) => p.pool_id === poolId,
  );
  const myPlayerIds = new Set(myPasses.map((p) => p.player_id));

  const maxCount = Math.max(1, ranked[0]?.count ?? 0);
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
  const payoutPerSurvivor = payoutIfSurvives(pool.pot_mist, estSurvivors);

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
          />
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
          <BigNumber
            label="Prize Pool"
            value={formatSui(pool.pot_mist)}
            unit="SUI"
            accent
          />
          <BigNumber
            label={pool.phase >= 2 ? "Survivors" : "Total Picks"}
            value={
              pool.phase >= 2
                ? `${pool.alive_count}`
                : String(pool.total_passes)
            }
            unit={pool.phase >= 2 ? `/ ${pool.total_passes}` : undefined}
          />
          <BigNumber
            label="Payout / survivor"
            value={formatSui(payoutPerSurvivor)}
            unit="SUI"
          />
          <BigNumber
            label="Entry"
            value={formatSui(pool.entry_fee_mist)}
            unit="SUI"
          />
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-4 flex flex-wrap items-center gap-3">
          <ViewToggle value={view} onChange={setView} />
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
          {view === "list" ? (
            <ListView
              ranked={filteredRanked}
              maxCount={maxCount}
              totalPicks={totalPicks}
              pool={pool}
              myPlayerIds={myPlayerIds}
              passes={myPasses}
              roster={roster.players}
              payoutPerSurvivor={payoutPerSurvivor}
              matchdayResults={matchdayResults}
            />
          ) : (
            <GraphView
              players={roster.players}
              counts={counts}
              pool={pool}
              myPlayerIds={myPlayerIds}
              query={query}
              matchdayResults={matchdayResults}
            />
          )}
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

function ViewToggle({
  value,
  onChange,
}: {
  value: "list" | "graph";
  onChange: (v: "list" | "graph") => void;
}) {
  return (
    <div className="inline-flex border border-zinc-800 rounded-full p-0.5 bg-ink-surface">
      <ToggleBtn active={value === "list"} onClick={() => onChange("list")}>
        List
      </ToggleBtn>
      <ToggleBtn active={value === "graph"} onClick={() => onChange("graph")}>
        Graph
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 text-utility rounded-full transition-colors",
        active
          ? "bg-hazard text-ink"
          : "text-zinc-400 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
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
  payoutPerSurvivor,
  matchdayResults,
}: {
  ranked: RankedPlayer[];
  maxCount: number;
  totalPicks: number;
  pool: PoolState;
  myPlayerIds: Set<number>;
  passes: MyPass[];
  roster: Player[];
  payoutPerSurvivor: bigint;
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
              payoutPerSurvivor={payoutPerSurvivor}
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
        <YourPicksPanel
          passes={passes}
          roster={roster}
          pool={pool}
          payoutPerSurvivor={payoutPerSurvivor}
        />
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
  payoutPerSurvivor,
  matchdayResult,
}: {
  rank: number;
  player: Player;
  count: number;
  maxCount: number;
  totalPicks: number;
  pool: PoolState;
  isYours: boolean;
  payoutPerSurvivor: bigint;
  matchdayResult?: MatchdayResult;
}) {
  const isSettled = pool.phase >= 2;
  const isEliminated =
    isSettled && pool.eliminated_players.includes(player.id);
  const isSurvived = isSettled && !isEliminated;
  const likelihood = survivalLikelihood(player.difficulty);

  const pct = totalPicks > 0 ? (count / totalPicks) * 100 : 0;
  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

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
        <div className="text-utility text-zinc-600">if survives</div>
        <div className="font-mono tabular text-sm text-hazard">
          {formatSui(payoutPerSurvivor)} SUI
        </div>
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
  payoutPerSurvivor,
}: {
  passes: MyPass[];
  roster: Player[];
  pool: PoolState;
  payoutPerSurvivor: bigint;
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
                  {formatSui(payoutPerSurvivor)} SUI
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
 * Top-of-page banner shown while a match simulation is running. Pulse on the
 * left, fixture label in the middle, survivor counter on the right, and a
 * progress sliver at the very top showing elapsed / total.
 */
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
