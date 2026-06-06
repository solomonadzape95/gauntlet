"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2, Bot, Play, Timer } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { TREASURY_ADDRESS } from "@/lib/sui";
import { loopStepInfo, formatCountdown } from "@/lib/loop-step";
import { usePoolState } from "@/lib/hooks/use-pool-state";
import { Button } from "@/components/ui/button";

interface AutomationRow {
  poolObjectId: string;
  status: string;
  enabled: boolean;
  lockDelayMs: number;
  simDelayMs: number;
  settleDelayMs: number;
  lastMintAtMs?: number;
  lockedAtMs?: number;
  simStartedAtMs?: number;
  lastError?: string;
  spawnedChildPool?: string;
}

interface MdRow {
  tournamentSlug: string;
  mdSlug: string;
  rosterBlobId?: string;
  entryFeeMist?: string;
}

/**
 * Admin control for the autonomous game loop on a single pool. Enroll a pool,
 * toggle the loop on/off, edit the post-mint lock delay, and fire one step
 * manually to validate the lock → sim → settle → spawn chain before letting
 * the cron drive it.
 */
export function AutomationPanel({ poolId }: { poolId: string }) {
  const row = useQuery(
    api.automation.forPool,
    convexConfigured ? { poolObjectId: poolId } : "skip",
  ) as AutomationRow | null | undefined;
  const md = useQuery(
    api.matchdays.getByPool,
    convexConfigured ? { poolObjectId: poolId } : "skip",
  ) as MdRow | null | undefined;

  const account = useCurrentAccount();
  const caller = account?.address ?? "";
  const register = useMutation(api.automation.register);
  const setEnabled = useMutation(api.automation.setEnabled);
  const setTimings = useMutation(api.automation.setTimings);
  const step = useAction(api.gameLoop.step);

  const [lockSec, setLockSec] = useState<string>("");
  const [busy, setBusy] = useState<"enroll" | "toggle" | "save" | "step" | null>(null);
  const [stepResult, setStepResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1s ticker for the live step countdown.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { data: poolState } = usePoolState(poolId);
  const loopStep = row ? loopStepInfo(row, poolState?.total_passes) : null;
  const stepCountdown =
    loopStep && loopStep.etaMs !== null
      ? formatCountdown(loopStep.etaMs - now)
      : null;

  const enroll = async () => {
    if (!md) return;
    setError(null);
    setBusy("enroll");
    try {
      await register({
        caller,
        poolObjectId: poolId,
        tournamentSlug: md.tournamentSlug,
        mdSlug: md.mdSlug,
        rosterBlobId: md.rosterBlobId,
        entryFeeMist: md.entryFeeMist ?? "100000000",
        treasury: TREASURY_ADDRESS,
        enabled: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async () => {
    if (!row) return;
    setBusy("toggle");
    setError(null);
    try {
      await setEnabled({ caller, poolObjectId: poolId, enabled: !row.enabled });
    } finally {
      setBusy(null);
    }
  };

  const saveLock = async () => {
    const n = Number(lockSec);
    if (!Number.isFinite(n) || n < 0) return;
    setBusy("save");
    try {
      await setTimings({ caller, poolObjectId: poolId, lockDelaySec: n });
      setLockSec("");
    } finally {
      setBusy(null);
    }
  };

  const runStep = async () => {
    setBusy("step");
    setError(null);
    setStepResult(null);
    try {
      const r = await step({ caller, poolObjectId: poolId });
      setStepResult(String(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!convexConfigured) return null;

  return (
    <div className="border border-zinc-800 bg-ink-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bot className="size-5 text-hazard mt-0.5" />
          <div>
            <div className="text-base font-semibold text-zinc-100">
              Autonomous loop
            </div>
            <p className="mt-1 text-sm text-zinc-400 max-w-xl leading-relaxed">
              Locks{" "}
              <span className="text-zinc-200">
                {row ? Math.round(row.lockDelayMs / 1000) : 90}s
              </span>{" "}
              after the last mint, runs the sim {row ? Math.round(row.simDelayMs / 1000) : 30}s
              later, then publishes + settles {row ? Math.round(row.settleDelayMs / 1000) : 30}s
              after that — and spawns the next matchday. Signs as the pool admin
              server-side; never closes the pool.
            </p>
          </div>
        </div>
        {row && (
          <span
            className={
              "shrink-0 text-utility px-2.5 py-1 border " +
              (row.enabled
                ? "border-hazard/50 text-hazard"
                : "border-zinc-800 text-zinc-500")
            }
          >
            {row.enabled ? "ON" : "OFF"} · {row.status}
          </span>
        )}
      </div>

      {row === undefined || md === undefined ? (
        <div className="mt-5 text-zinc-500 inline-flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !row ? (
        <div className="mt-5">
          <Button variant="outline" onClick={enroll} disabled={busy !== null || !md} bullet>
            {busy === "enroll" ? <Loader2 className="size-4 animate-spin" /> : "Enroll this pool"}
          </Button>
          {!md && (
            <p className="mt-2 text-utility text-amber-400">
              No Convex matchday row for this pool — can&apos;t enroll.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Live step countdown */}
          <div className="flex items-center gap-2 border border-zinc-800 bg-ink px-4 py-3">
            <Timer className="size-4 text-hazard shrink-0" />
            {row.enabled && loopStep ? (
              <span className="text-base text-zinc-100 tabular font-mono">
                {loopStep.label}
                {stepCountdown ? ` in ${stepCountdown}` : ""}
              </span>
            ) : (
              <span className="text-utility text-zinc-500">
                {row.enabled ? "Idle" : "Loop stopped"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Button
              variant={row.enabled ? "outline" : "hazard"}
              onClick={toggle}
              disabled={busy !== null}
              bullet
            >
              {busy === "toggle" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : row.enabled ? (
                "Stop loop"
              ) : (
                "Start loop"
              )}
            </Button>

            <div>
              <label className="text-utility text-zinc-500 block mb-1.5">
                Lock delay (seconds after last mint)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={String(Math.round(row.lockDelayMs / 1000))}
                  value={lockSec}
                  onChange={(e) => setLockSec(e.target.value)}
                  className="w-28 bg-ink border border-zinc-800 px-3 py-2 font-mono text-sm focus:outline-none focus:border-hazard"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveLock}
                  disabled={busy !== null || lockSec === ""}
                >
                  {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={runStep} disabled={busy !== null}>
              {busy === "step" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Stepping…
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> Run one step
                </>
              )}
            </Button>
          </div>

          {stepResult && (
            <div className="text-utility text-emerald-400 break-words">
              → {stepResult}
            </div>
          )}
          {row.spawnedChildPool && (
            <div className="text-utility text-zinc-500 break-all">
              Spawned next pool: {row.spawnedChildPool}
            </div>
          )}
          {row.lastError && (
            <div className="text-utility text-red-400 break-words">
              Last error: {row.lastError}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-400 break-words">{error}</div>
      )}
    </div>
  );
}
