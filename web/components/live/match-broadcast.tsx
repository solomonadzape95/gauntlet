"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQuery as useConvexQuery } from "convex/react";
import {
  Award,
  Flag,
  Goal,
  Hand,
  Repeat,
  Square as SquareIcon,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import {
  MATCH_SIM_CHANNEL,
  type MatchEvent,
  type MatchSimEvent,
} from "@/lib/match-sim";
import { cn } from "@/lib/cn";
import type { Player } from "@/lib/types";
import { teamColors } from "@/lib/team-colors";

/** Compact team chip: a colored swatch + tail of the name. e.g. `🟧 PHX` */
function TeamChip({
  name,
  align,
}: {
  name: string;
  align: "left" | "right";
}) {
  const colors = teamColors(name);
  // 3-letter short code: take the first three letters of the first word.
  // "Phoenix XI" → "PHX", "Eclipse XI" → "ECL"
  const short = name
    .replace(/\s*X+I*$/i, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 md:gap-3 min-w-0",
        align === "left" ? "flex-row" : "flex-row-reverse",
      )}
    >
      <span
        aria-hidden
        className="size-3.5 md:size-4 shrink-0 ring-1 ring-black/30"
        style={{ backgroundColor: colors.primary }}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "font-mono text-zinc-200 leading-none truncate",
            "text-sm md:text-base tracking-wider",
            align === "right" && "text-right",
          )}
        >
          {short}
        </div>
        <div
          className={cn(
            "font-mono text-zinc-500 leading-none truncate mt-1",
            "text-[10px] md:text-[11px] tracking-[0.14em] uppercase",
            align === "right" && "text-right",
          )}
        >
          {name}
        </div>
      </div>
    </div>
  );
}

/**
 * Live match broadcast widget — subscribes to the `gauntlet-match-sim`
 * BroadcastChannel and renders:
 *   - a scoreboard fed by `event.score`
 *   - an event ticker that animates each new event in
 *   - the live match-minute / phase based on event type
 *
 * Drops in anywhere; the admin "Play full match" button on
 * `/admin/pools` drives every viewer in lockstep.
 */
export function MatchBroadcast({
  homeName,
  awayName,
  roster,
  poolId,
}: {
  homeName: string;
  awayName: string;
  /** Optional roster — when supplied, event blurbs render the player's
   *  full name + team affiliation as fallback when the description text
   *  doesn't already include them. */
  roster?: Player[];
  /** Pool object id — required for the cross-device Convex subscription. */
  poolId?: string;
}) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [score, setScore] = useState<{ home: number; away: number }>({
    home: 0,
    away: 0,
  });
  const [phase, setPhase] = useState<
    "pre" | "live" | "halftime" | "fulltime"
  >("pre");
  const [matchMin, setMatchMin] = useState(0);
  const [latestStartedAt, setLatestStartedAt] = useState<number | null>(null);
  const feedRef = useRef<HTMLOListElement>(null);

  const playerById = useMemo(() => {
    if (!roster) return new Map<number, Player>();
    return new Map(roster.map((p) => [p.id, p]));
  }, [roster]);

  // Same-browser transport (BroadcastChannel) — instant reaction in tabs
  // sharing this browser/profile.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ch = new BroadcastChannel(MATCH_SIM_CHANNEL);
    const onMessage = (msg: MessageEvent<MatchSimEvent>) => {
      const data = msg.data;
      if (data.type === "start") {
        setEvents([]);
        setScore({ home: 0, away: 0 });
        setPhase("live");
        setMatchMin(0);
        setLatestStartedAt(data.startedAt);
      } else if (data.type === "stop") {
        setPhase("pre");
      } else if (data.type === "event") {
        const e = data.event;
        setEvents((prev) => mergeEvent(prev, e));
        setMatchMin(e.t_min);
        if (e.score) setScore(e.score);
        if (e.type === "halftime") setPhase("halftime");
        else if (e.type === "fulltime") setPhase("fulltime");
        else if (e.type === "kickoff") setPhase("live");
      }
    };
    ch.addEventListener("message", onMessage);
    return () => {
      ch.removeEventListener("message", onMessage);
      ch.close();
    };
  }, []);

  // Cross-device transport (Convex live-query). Replays the latest run
  // from the events table so any tab/device shows the same state.
  const simRows = useConvexQuery(
    api.matchSim.latest,
    convexConfigured && poolId && poolId !== "0x0"
      ? { poolObjectId: poolId, limit: 500 }
      : "skip",
  ) as
    | Array<{
        type: string;
        payload: { startedAt: number; event?: MatchEvent; durationMs?: number };
      }>
    | undefined;

  useEffect(() => {
    if (!simRows || simRows.length === 0) return;
    // Find the most recent run (max startedAt across the rows).
    let latestStart = 0;
    for (const r of simRows) {
      const t = Number(r.payload?.startedAt ?? 0);
      if (t > latestStart) latestStart = t;
    }
    if (latestStart === 0) return;
    // Was this run aborted? Take the latest stop for it.
    const runRows = simRows.filter(
      (r) => Number(r.payload?.startedAt ?? 0) === latestStart,
    );
    const aborted = runRows.some((r) => r.type === "Sim:stop");
    if (aborted && latestStartedAt !== latestStart) {
      setPhase("pre");
      setEvents([]);
      setScore({ home: 0, away: 0 });
      setMatchMin(0);
      setLatestStartedAt(latestStart);
      return;
    }
    // New run kicked off remotely — reset our local state to its first event.
    if (latestStartedAt !== latestStart) {
      setEvents([]);
      setScore({ home: 0, away: 0 });
      setMatchMin(0);
      setLatestStartedAt(latestStart);
      setPhase("live");
    }
    // Apply every event in chronological order.
    const evts = runRows
      .filter((r) => r.type.startsWith("Sim:") && r.payload?.event)
      .map((r) => r.payload.event as MatchEvent)
      .sort((a, b) => a.t_sec - b.t_sec);
    if (evts.length === 0) return;
    setEvents((prev) => {
      let next = prev;
      for (const e of evts) next = mergeEvent(next, e);
      return next;
    });
    const last = evts[evts.length - 1];
    setMatchMin(last.t_min);
    if (last.score) setScore(last.score);
    if (last.type === "halftime") setPhase("halftime");
    else if (last.type === "fulltime") setPhase("fulltime");
    else if (last.type === "kickoff") setPhase("live");
  }, [simRows, latestStartedAt]);

  // Auto-scroll feed to the latest event.
  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events.length]);

  const phaseLabel = (() => {
    switch (phase) {
      case "pre":
        return "Waiting for kick-off";
      case "halftime":
        return "Half-time";
      case "fulltime":
        return "Full-time";
      default:
        return `LIVE · ${matchMin}'`;
    }
  })();

  return (
    <div className="border border-zinc-900 bg-ink-surface overflow-hidden">
      {/* Scoreboard */}
      <div className="grid grid-cols-12 items-center gap-2 px-5 md:px-8 py-6 border-b border-zinc-900">
        <div className="col-span-4 flex justify-end">
          <TeamChip name={homeName} align="left" />
        </div>
        <div className="col-span-4 text-center">
          <div
            className="font-mono tabular leading-none text-zinc-100"
            style={{
              fontSize: "clamp(2.25rem, 5.5vw, 4rem)",
              letterSpacing: "-0.02em",
            }}
          >
            <span className={score.home > score.away ? "text-hazard" : ""}>
              {score.home}
            </span>
            <span className="text-zinc-700 px-3 md:px-5">—</span>
            <span className={score.away > score.home ? "text-hazard" : ""}>
              {score.away}
            </span>
          </div>
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-2 font-mono text-xs tracking-[0.14em] uppercase",
              phase === "live"
                ? "text-hazard"
                : phase === "halftime"
                  ? "text-amber-400"
                  : phase === "fulltime"
                    ? "text-emerald-400"
                    : "text-zinc-500",
            )}
          >
            {phase === "live" && (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-hazard animate-pulse-dot"
              />
            )}
            {phaseLabel}
          </div>
        </div>
        <div className="col-span-4 flex justify-start">
          <TeamChip name={awayName} align="right" />
        </div>
      </div>

      {/* Event feed */}
      <ol
        ref={feedRef}
        className="max-h-[28rem] overflow-y-auto divide-y divide-zinc-900"
      >
        {events.length === 0 && (
          <li className="px-5 md:px-8 py-6 text-zinc-500 text-base">
            Waiting for the broadcast to start. The admin can kick off from{" "}
            <code className="font-mono">/admin/pools</code>.
          </li>
        )}
        <AnimatePresence initial={false}>
          {events.map((e) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "px-5 md:px-8 py-3.5 flex items-start gap-4",
                e.type === "goal" && "bg-hazard/[0.06]",
              )}
            >
              <div className="w-12 shrink-0 text-utility font-mono text-zinc-500 pt-0.5">
                {String(e.t_min).padStart(2, "0")}&apos;
              </div>
              <div className="shrink-0 pt-0.5">
                <EventIcon type={e.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base text-zinc-100 leading-snug">
                  {e.description}
                </div>
                {e.score && (
                  <div className="mt-1 text-utility font-mono text-zinc-500">
                    {e.score.home} — {e.score.away}
                  </div>
                )}
                {e.player_id !== undefined &&
                  playerById.has(e.player_id) &&
                  !e.description
                    .toLowerCase()
                    .includes(
                      playerById
                        .get(e.player_id)!
                        .name.split(" ")
                        .pop()!
                        .toLowerCase(),
                    ) && (
                    <div className="mt-1 text-utility text-zinc-500">
                      {playerById.get(e.player_id)!.name} ·{" "}
                      {playerById.get(e.player_id)!.team}
                    </div>
                  )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/**
 * Idempotent insert: append `e` to `prev` unless an event with the same id is
 * already there. The same event may arrive from BroadcastChannel and Convex,
 * so we de-dupe by `id` to keep the ticker honest.
 */
function mergeEvent(prev: MatchEvent[], e: MatchEvent): MatchEvent[] {
  if (prev.some((p) => p.id === e.id)) return prev;
  return [...prev, e];
}

function EventIcon({ type }: { type: MatchEvent["type"] }) {
  const common = "size-4";
  switch (type) {
    case "goal":
      return <Goal className={cn(common, "text-hazard")} />;
    case "save":
      return <Hand className={cn(common, "text-sky-400")} />;
    case "yellow_card":
      return <SquareIcon className={cn(common, "text-amber-400")} />;
    case "red_card":
      return <SquareIcon className={cn(common, "text-red-500")} />;
    case "substitution":
      return <Repeat className={cn(common, "text-zinc-400")} />;
    case "halftime":
    case "fulltime":
      return <Flag className={cn(common, "text-zinc-400")} />;
    case "kickoff":
      return <Award className={cn(common, "text-emerald-400")} />;
    default:
      return <Goal className={cn(common, "text-zinc-400")} />;
  }
}
