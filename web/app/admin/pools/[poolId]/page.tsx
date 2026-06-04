"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { useQuery as useConvexQuery } from "convex/react";
import { Transaction } from "@mysten/sui/transactions";
import Link from "next/link";
import { ArrowUpRight, Loader2, Play, Square } from "lucide-react";

import { api } from "@/convex/_generated/api";
import {
  PACKAGE_ID,
  shortAddress,
  formatSui,
  suiscanTx,
} from "@/lib/sui";
import {
  usePoolState,
  PHASE_LABEL,
  PHASE_DOT,
  poolStateKey,
  type PoolState,
} from "@/lib/hooks/use-pool-state";
import { useMintCounts, mintCountsKey } from "@/lib/hooks/use-mint-counts";
import { useRoster } from "@/lib/hooks/use-roster";
import { fetchMatchday } from "@/lib/walrus";
import { convexConfigured } from "@/lib/convex";

import { cn } from "@/lib/cn";

import { useMutation as useConvexMutation } from "convex/react";
import {
  fetchMatchEventsDoc,
  scheduleMatchEvents,
  type MatchEvent,
  type MatchEventsDoc,
  type MatchSimEvent,
  MATCH_SIM_CHANNEL,
  SIM_DURATION_MS,
} from "@/lib/match-sim";

import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import {
  assertTxSuccess,
  describeTxError,
  isUserRejection,
} from "@/lib/tx-errors";

import { EventsFeed } from "../../events-feed";
import { PlayersBreakdown } from "../../players-breakdown";

interface MdLite {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  fixture?: string;
  rosterBlobId?: string;
  matchdayResultsBlobId?: string;
  poolObjectId?: string;
  entryFeeMist?: string;
}

/**
 * On-chain pool lifecycle workspace, scoped to the pool object in the URL.
 * Lock, simulate, settle, close — all targeting `params.poolId`, with the
 * matchday roster + results blobs sourced from the Convex matchday row
 * keyed by that pool id.
 */
export default function AdminPoolDetailPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = use(params);

  // Look up the Convex matchday so we know which roster + results blob this
  // pool is bound to. Falls back to undefined when this poolId isn't recorded
  // in Convex (e.g. legacy env-default pool) — UI handles both.
  const matchdayRow = useConvexQuery(
    api.matchdays.getByPool,
    convexConfigured ? { poolObjectId: poolId } : "skip",
  ) as MdLite | null | undefined;

  const rosterBlobId = matchdayRow?.rosterBlobId ?? "";
  const matchdayBlobId = matchdayRow?.matchdayResultsBlobId ?? "";

  const { data: pool, isLoading } = usePoolState(poolId);
  const counts = useMintCounts(poolId);
  const { data: roster } = useRoster(rosterBlobId);
  const noPoolConfigured = poolId === "0x0";

  if (isLoading && !noPoolConfigured) {
    return (
      <Empty
        body={
          <span className="inline-flex items-center gap-2 text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Loading pool state…
          </span>
        }
      />
    );
  }

  if (noPoolConfigured || !pool) {
    return (
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Pools · Pool not found
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl mb-3">
            No on-chain pool at this id.
          </h1>
          <p className="text-base md:text-lg text-zinc-300 max-w-xl">
            <code className="font-mono text-hazard">{poolId}</code> isn&apos;t
            visible from the configured Sui RPC. Pick another pool from{" "}
            <Link href="/admin/pools" className="text-hazard hover:underline">
              Pools
            </Link>{" "}
            or spawn a new one via{" "}
            <Link
              href="/admin/tournaments"
              className="text-hazard hover:underline"
            >
              Tournaments
            </Link>
            .
          </p>
        </section>
      </CornerFrame>
    );
  }

  const phaseDot = PHASE_DOT[pool.phase];
  const phaseLabel = PHASE_LABEL[pool.phase];

  return (
    <div>
      {/* Header */}
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <Link
            href="/admin/pools"
            className="text-utility text-zinc-500 hover:text-hazard inline-flex items-center gap-1.5 mb-3"
          >
            ← All pools
          </Link>
          <div className="text-utility text-zinc-500 mb-3 inline-flex items-center gap-2">
            <StatusDot status={phaseDot} />
            Pool phase: {phaseLabel}
            {matchdayRow && (
              <>
                <span aria-hidden className="text-zinc-700">
                  ·
                </span>
                <span>
                  {matchdayRow.tournamentSlug} · {matchdayRow.label}
                </span>
              </>
            )}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            {matchdayRow?.fixture ?? "Pool lifecycle"}
          </h1>
        </section>
      </CornerFrame>

      {/* Stats dashboard — 3 × 2 tile grid */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-5xl px-6 lg:px-10 py-10 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-5">
            <StatTile
              label="Pot"
              value={formatSui(pool.pot_mist)}
              unit="SUI"
              accent
            />
            <StatTile label="Mints" value={String(pool.total_passes)} />
            <StatTile label="Alive" value={String(pool.alive_count)} />
            <StatTile
              label="Out"
              value={String(Math.max(0, pool.total_passes - pool.alive_count))}
            />
            <StatTile
              label="Entry"
              value={formatSui(pool.entry_fee_mist)}
              unit="SUI"
            />
            <StatTile
              label="Pool ID"
              value={shortAddress(poolId, 6, 4)}
              mono
              fullWidth
            />
          </div>
        </div>
      </section>

      {/* Lifecycle controls */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-6">Lifecycle</div>
          <ActionPanel
            pool={pool}
            counts={counts}
            poolId={poolId}
            matchdayBlobId={matchdayBlobId}
            matchdayRow={matchdayRow ?? null}
          />
        </div>
      </section>

      {/* Live event feed + players breakdown */}
      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {roster && (
              <PlayersBreakdown
                roster={roster.players}
                counts={counts}
                pool={pool}
              />
            )}
          </div>
          <div>
            <EventsFeed />
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionPanel({
  pool,
  counts,
  poolId,
  matchdayBlobId,
  matchdayRow,
}: {
  pool: PoolState;
  counts: Record<number, number>;
  poolId: string;
  matchdayBlobId: string;
  matchdayRow: MdLite | null;
}) {
  const client = useSuiClient();
  const qc = useQueryClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const setMatchdayResults = useConvexMutation(api.matchdays.setResults);
  const [busy, setBusy] = useState<
    "lock" | "settle" | "close" | "publish" | null
  >(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventsPath, setEventsPath] = useState(
    "/data/last-eleven-md1-events.json",
  );
  const [publishedBlobId, setPublishedBlobId] = useState<string | null>(null);

  const { data: matchday } = useQuery({
    queryKey: ["matchday-results", poolId, matchdayBlobId],
    queryFn: () => fetchMatchday(matchdayBlobId),
    enabled: !!matchdayBlobId,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: poolStateKey(poolId) });
    await qc.invalidateQueries({ queryKey: mintCountsKey(poolId) });
  };

  const handleLock = async () => {
    try {
      setBusy("lock");
      setError(null);
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::lock_pool`,
        arguments: [tx.object(poolId)],
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);
      await invalidate();
      setLastDigest(result.digest);
    } catch (e) {
      if (isUserRejection(e)) return;
      setError(describeTxError(e) ?? "Lock failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleSettle = async () => {
    if (!matchday) return;
    try {
      setBusy("settle");
      setError(null);

      const eliminatedSet = new Set(matchday.eliminated_player_ids);
      let eliminatedPassCount = 0;
      for (const [pid, count] of Object.entries(counts)) {
        if (eliminatedSet.has(Number(pid))) eliminatedPassCount += count;
      }
      const survivorsCount = Math.max(
        0,
        pool.total_passes - eliminatedPassCount,
      );

      const tx = new Transaction();
      const matchdayBytes = Array.from(
        new TextEncoder().encode(matchdayBlobId),
      );

      tx.moveCall({
        target: `${PACKAGE_ID}::pool::settle_pool`,
        arguments: [
          tx.object(poolId),
          tx.pure.vector("u8", matchdayBytes),
          tx.pure.vector("u32", matchday.eliminated_player_ids),
          tx.pure.u64(BigInt(survivorsCount)),
        ],
      });

      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);
      await invalidate();
      setLastDigest(result.digest);
    } catch (e) {
      if (isUserRejection(e)) return;
      setError(describeTxError(e) ?? "Settle failed.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * One-shot "Publish results to Walrus + settle on-chain" — loads the
   * matchday-events doc from /public/data, pushes it to Walrus, attaches
   * the blob id to the Convex matchday row, then calls settle_pool with
   * the eliminated_player_ids it contains. Phase goes LOCKED → SETTLED in
   * a single click.
   */
  const handlePublishAndSettle = async () => {
    try {
      setBusy("publish");
      setError(null);
      setPublishedBlobId(null);

      // 1. Load events doc
      const res = await fetch(eventsPath);
      if (!res.ok) {
        throw new Error(
          `Failed to load events from ${eventsPath}: ${res.status}`,
        );
      }
      const doc = (await res.json()) as MatchEventsDoc & {
        eliminated_player_ids?: number[];
        survivor_player_ids?: number[];
      };
      const eliminated = doc.eliminated_player_ids ?? [];

      // 2. Walrus upload
      const upRes = await fetch("/api/walrus/upload?epochs=5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.blobId) {
        throw new Error(upData.error ?? `Walrus upload failed (${upRes.status})`);
      }
      const blobId = upData.blobId as string;
      setPublishedBlobId(blobId);

      // 3. Convex: pin the blob on the matchday row
      if (matchdayRow) {
        try {
          await setMatchdayResults({
            tournamentSlug: matchdayRow.tournamentSlug,
            mdSlug: matchdayRow.mdSlug,
            matchdayResultsBlobId: blobId,
          });
        } catch (e) {
          console.warn("Convex setResults failed (continuing to settle):", e);
        }
      }

      // 4. Survivor count from minted passes
      const eliminatedSet = new Set(eliminated);
      let eliminatedPassCount = 0;
      for (const [pid, count] of Object.entries(counts)) {
        if (eliminatedSet.has(Number(pid))) eliminatedPassCount += count;
      }
      const survivorsCount = Math.max(
        0,
        pool.total_passes - eliminatedPassCount,
      );

      // 5. settle_pool tx
      const tx = new Transaction();
      const matchdayBytes = Array.from(new TextEncoder().encode(blobId));
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::settle_pool`,
        arguments: [
          tx.object(poolId),
          tx.pure.vector("u8", matchdayBytes),
          tx.pure.vector("u32", eliminated),
          tx.pure.u64(BigInt(survivorsCount)),
        ],
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);
      await invalidate();
      setLastDigest(result.digest);
    } catch (e) {
      if (isUserRejection(e)) return;
      setError(describeTxError(e) ?? (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    try {
      setBusy("close");
      setError(null);
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::pool::close_pool`,
        arguments: [tx.object(poolId)],
      });
      const result = await signAndExecute({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });
      await assertTxSuccess(client, result.digest);
      await invalidate();
      setLastDigest(result.digest);
    } catch (e) {
      if (isUserRejection(e)) return;
      setError(describeTxError(e) ?? "Close failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {pool.phase === 0 && (
        <ActionRow
          title="Lock Pool"
          description="Stop accepting new mints. Pool moves OPEN → LOCKED and becomes ready for settlement."
        >
          <Button
            variant="hazard"
            onClick={handleLock}
            disabled={busy !== null}
            bullet
          >
            {busy === "lock" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Locking…
              </>
            ) : (
              "Lock Pool"
            )}
          </Button>
        </ActionRow>
      )}

      <SimulateMatchRow poolId={poolId} />

      {pool.phase === 1 && (
        <ActionRow
          title="Publish results + Settle"
          description={
            <>
              <span className="text-base">
                One-click: pushes the match-events JSON to Walrus, pins the
                resulting blob id on this matchday in Convex, then calls{" "}
                <code className="font-mono">settle_pool</code> on chain with the
                eliminated player ids. Pool flips LOCKED → SETTLED.
              </span>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-utility text-zinc-500 block mb-1.5">
                    Events JSON
                  </label>
                  <input
                    type="text"
                    value={eventsPath}
                    onChange={(e) => setEventsPath(e.target.value)}
                    className="w-[28rem] max-w-full bg-ink border border-zinc-800 px-3 py-2 font-mono text-xs focus:outline-none focus:border-hazard"
                  />
                </div>
              </div>
              {publishedBlobId && (
                <div className="mt-3 text-utility text-emerald-400 break-all">
                  ✓ Published · blob{" "}
                  <code className="font-mono">{publishedBlobId}</code>
                </div>
              )}
            </>
          }
        >
          <Button
            variant="hazard"
            onClick={handlePublishAndSettle}
            disabled={busy !== null}
            bullet
          >
            {busy === "publish" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Publishing…
              </>
            ) : (
              "Publish + Settle"
            )}
          </Button>
        </ActionRow>
      )}

      {pool.phase === 1 && matchday && (
        <ActionRow
          title="Push Matchday + Settle"
          description={
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-300">
                {/* Legacy matchday JSONs ship a `fixtures` array; newer
                    match-events docs use a single `fixture` object with a
                    separate `final_score`. Render whichever is present. */}
                {Array.isArray(
                  (matchday as { fixtures?: unknown }).fixtures,
                ) ? (
                  (
                    (matchday as { fixtures: Array<{ home: string; away: string; score: string }> }).fixtures
                  ).map((f, i) => (
                    <span key={i} className="font-mono text-sm">
                      {f.home} {f.score} {f.away}
                    </span>
                  ))
                ) : (matchday as unknown as {
                    fixture?: { home?: string; away?: string };
                    final_score?: { home?: number; away?: number };
                  }).fixture ? (
                  (() => {
                    const m = matchday as unknown as {
                      fixture: { home?: string; away?: string };
                      final_score?: { home?: number; away?: number };
                    };
                    const score = m.final_score
                      ? `${m.final_score.home ?? 0} — ${m.final_score.away ?? 0}`
                      : "—";
                    return (
                      <span className="font-mono text-sm">
                        {m.fixture.home ?? ""} {score} {m.fixture.away ?? ""}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-utility text-zinc-500">
                    (no fixture metadata)
                  </span>
                )}
              </div>
              <div className="mt-3 text-utility text-zinc-500">
                {(matchday.eliminated_player_ids ?? []).length} players
                eliminated · survivors can cash out anytime after settle
              </div>
              <div className="mt-3 flex items-center gap-2 text-utility text-zinc-600">
                <span>Matchday blob:</span>
                <code className="font-mono text-zinc-500 break-all">
                  {matchdayBlobId
                    ? `${matchdayBlobId.slice(0, 12)}…${matchdayBlobId.slice(-6)}`
                    : "(unset)"}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    qc.invalidateQueries({
                      queryKey: ["matchday-results", poolId, matchdayBlobId],
                    })
                  }
                  className="ml-1 underline text-zinc-500 hover:text-hazard"
                >
                  Refresh
                </button>
              </div>
            </>
          }
        >
          <Button
            variant="hazard"
            onClick={handleSettle}
            disabled={busy !== null || !matchday}
            bullet
          >
            {busy === "settle" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Settling…
              </>
            ) : (
              "Push matchday"
            )}
          </Button>
        </ActionRow>
      )}

      {pool.phase === 2 && (
        <ActionRow
          title="Close Pool"
          description={
            <>
              <span className="text-base">
                Survivors can cash out indefinitely. Close when you&apos;re
                ready to retire the pool.
              </span>
              <div className="mt-2 text-utility text-zinc-500">
                Eliminated player IDs: [{pool.eliminated_players.join(", ")}]
              </div>
            </>
          }
        >
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={busy !== null}
            bullet
          >
            {busy === "close" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Closing…
              </>
            ) : (
              "Close Pool"
            )}
          </Button>
        </ActionRow>
      )}

      {pool.phase === 3 && (
        <div className="border border-zinc-900 p-6">
          <h3 className="font-serif text-xl font-semibold">Pool closed</h3>
          <p className="mt-2 text-base text-zinc-400">
            No further admin actions. Spawn a new one from Tournaments.
          </p>
        </div>
      )}

      {lastDigest && (
        <div className="border border-zinc-800 p-4">
          <div className="text-utility text-zinc-500 mb-2">
            Last transaction
          </div>
          <a
            href={suiscanTx(lastDigest)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-hazard hover:underline inline-flex items-center gap-1"
          >
            {lastDigest.slice(0, 28)}… <ArrowUpRight className="size-3" />
          </a>
        </div>
      )}

      {error && (
        <div className="border border-red-900/50 bg-red-950/20 p-4">
          <div className="text-utility text-red-400 mb-2">Error</div>
          <p className="text-base text-red-300 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  accent,
  mono,
  fullWidth,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-zinc-900 p-6 md:p-8 -ml-px -mt-px",
        fullWidth && "col-span-2 md:col-span-5",
      )}
    >
      <div className="text-utility text-zinc-500 mb-3">{label}</div>
      <div
        className={cn(
          "leading-none",
          mono
            ? "font-mono tabular text-2xl md:text-3xl text-zinc-100"
            : "font-serif text-4xl md:text-5xl font-semibold tracking-tight",
          accent && "text-hazard",
        )}
      >
        {value}
        {unit && (
          <span className="ml-2 text-utility text-zinc-500 align-baseline">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Default events file path. Drop more scripted matches at
 * `/public/data/<slug>.json` and switch the input to swap matches.
 */
const DEFAULT_EVENTS_PATH = "/data/last-eleven-md1-events.json";

function SimulateMatchRow({ poolId }: { poolId: string }) {
  // Legacy "synthetic stat ramp" sim — kept so the existing graph view ticks.
  const [synthRunning, setSynthRunning] = useState(false);
  const [synthRemaining, setSynthRemaining] = useState(0);

  // Scripted-match playback state.
  const [eventsPath, setEventsPath] = useState(DEFAULT_EVENTS_PATH);
  const [speed, setSpeed] = useState(1);
  const [doc, setDoc] = useState<MatchEventsDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{
    handle: { abort: () => void };
    startedAt: number;
  } | null>(null);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Tick the elapsed counter while a scripted match is playing.
  useEffect(() => {
    if (!playback) return;
    const id = setInterval(() => {
      setElapsedSec(
        Math.min(
          doc?.duration_sec ?? 120,
          Math.floor((Date.now() - playback.startedAt) / 1000),
        ),
      );
    }, 250);
    return () => clearInterval(id);
  }, [playback, doc]);

  // Synthetic-sim timer.
  useEffect(() => {
    if (!synthRunning) return;
    const id = setInterval(() => {
      setSynthRemaining((r) => {
        const next = Math.max(0, r - 1000);
        if (next === 0) setSynthRunning(false);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [synthRunning]);

  const startSynth = () => {
    if (typeof window === "undefined") return;
    const ch = new BroadcastChannel(MATCH_SIM_CHANNEL);
    const evt: MatchSimEvent = {
      type: "start",
      poolId: poolId,
      startedAt: Date.now(),
    };
    ch.postMessage(evt);
    ch.close();
    setSynthRunning(true);
    setSynthRemaining(SIM_DURATION_MS);
  };

  const stopSynth = () => {
    if (typeof window === "undefined") return;
    const ch = new BroadcastChannel(MATCH_SIM_CHANNEL);
    ch.postMessage({
      type: "stop",
      poolId: poolId,
      startedAt: 0,
    } satisfies MatchSimEvent);
    ch.close();
    setSynthRunning(false);
    setSynthRemaining(0);
  };

  const playMatch = async () => {
    setError(null);
    setFeed([]);
    setElapsedSec(0);
    let loaded = doc;
    try {
      if (!loaded) {
        setLoading(true);
        loaded = await fetchMatchEventsDoc(eventsPath);
        setDoc(loaded);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    } finally {
      setLoading(false);
    }
    const startedAt = Date.now();
    const handle = scheduleMatchEvents(loaded, poolId, startedAt, {
      speed,
      onEvent: (ev) => setFeed((prev) => [...prev, ev]),
      onComplete: () => setPlayback(null),
    });
    setPlayback({ handle, startedAt });
  };

  const stopMatch = () => {
    if (playback) playback.handle.abort();
    setPlayback(null);
  };

  const reloadDoc = () => {
    setDoc(null);
    setFeed([]);
    setError(null);
  };

  const totalDuration = doc?.duration_sec ?? 120;
  const progressPct = Math.min(100, (elapsedSec / totalDuration) * 100);

  return (
    <>
      {/* — Scripted match playback — the main demo flow ———————————————— */}
      <ActionRow
        title="Play match (scripted events)"
        description={
          <>
            <span className="text-base">
              Loads a match-events JSON and broadcasts each goal / save / card
              to the live page on its own timer. Eclipse XI 8 — 7 Phoenix XI
              ships out of the box. Settle is still a separate, deliberate step.
            </span>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-utility text-zinc-500 block mb-1.5">
                  Events JSON
                </label>
                <input
                  type="text"
                  value={eventsPath}
                  onChange={(e) => {
                    setEventsPath(e.target.value);
                    setDoc(null);
                  }}
                  className="w-[28rem] max-w-full bg-ink border border-zinc-800 px-3 py-2 font-mono text-xs focus:outline-none focus:border-hazard"
                />
              </div>
              <div>
                <label className="text-utility text-zinc-500 block mb-1.5">
                  Speed
                </label>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="bg-ink border border-zinc-800 px-2 py-2 text-sm focus:outline-none focus:border-hazard"
                >
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={2}>2×</option>
                  <option value={3}>3×</option>
                </select>
              </div>
              <button
                type="button"
                onClick={reloadDoc}
                className="text-utility text-zinc-500 hover:text-hazard"
              >
                Reload
              </button>
            </div>

            <div className="mt-3 text-utility text-zinc-500">
              Watch on{" "}
              <code className="font-mono text-zinc-300">
                /pools/last-eleven-md1/live
              </code>{" "}
              in another tab.
            </div>

            {playback && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-utility text-hazard mb-2">
                  <span>
                    ● Live · {elapsedSec}s / {totalDuration}s
                  </span>
                  <span className="text-zinc-500">
                    {feed.length} / {doc?.events.length ?? 0} events fired
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-hazard transition-[width] duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {/* Last 4 events */}
                <ul className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                  {feed.slice(-4).map((e) => (
                    <li
                      key={e.id}
                      className="text-utility text-zinc-300 truncate"
                    >
                      <span className="font-mono text-zinc-500">
                        {String(e.t_min).padStart(2, "0")}&apos;
                      </span>{" "}
                      {e.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="mt-3 text-utility text-red-400">{error}</div>
            )}
          </>
        }
      >
        {playback ? (
          <Button variant="outline" onClick={stopMatch} bullet>
            <Square className="size-3.5" /> Stop match
          </Button>
        ) : (
          <Button
            variant="hazard"
            onClick={playMatch}
            disabled={loading}
            bullet
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Loading…
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Play full match
              </>
            )}
          </Button>
        )}
      </ActionRow>

      {/* — Legacy synthetic ramp — keeps the existing graph view alive — */}
      <ActionRow
        title="Synthetic stat ramp"
        description={
          <>
            <span className="text-base">
              Legacy 60-second stat-progress reveal. Useful if you want to demo
              the graph view without a scripted match.
            </span>
            {synthRunning && (
              <div className="mt-3 text-utility text-hazard">
                ● Live · {Math.ceil(synthRemaining / 1000)}s remaining
              </div>
            )}
          </>
        }
      >
        {synthRunning ? (
          <Button variant="outline" onClick={stopSynth} bullet>
            <Square className="size-3.5" /> Stop ramp
          </Button>
        ) : (
          <Button variant="outline" onClick={startSynth} bullet>
            <Play className="size-3.5" /> Run ramp
          </Button>
        )}
      </ActionRow>
    </>
  );
}

function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-zinc-900 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-8">
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-2xl font-semibold tracking-tight">
          {title}
        </h3>
        <div className="mt-3 text-base text-zinc-300 leading-relaxed">
          {description}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Empty({ body }: { body: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="text-lg text-zinc-300">{body}</div>
    </div>
  );
}
