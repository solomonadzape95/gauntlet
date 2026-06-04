"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import type { Player } from "@/lib/types";
import type { PoolState } from "@/lib/hooks/use-pool-state";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { Jersey } from "@/components/jersey/jersey";
import { playerColors } from "@/lib/team-colors";
import { survivalLikelihood } from "@/lib/odds";
import { cn } from "@/lib/cn";

const TEAM_CENTERS: Record<string, { x: number; y: number }> = {
  Brazil: { x: -700, y: -340 },
  France: { x: 700, y: -340 },
  Argentina: { x: -700, y: 380 },
  Morocco: { x: 700, y: 380 },
};

const CLUSTER_RADIUS = 280;

function playerPosition(
  player: Player,
  allPlayers: Player[],
): { x: number; y: number } {
  const center = TEAM_CENTERS[player.team] ?? { x: 0, y: 0 };
  const teammates = allPlayers
    .filter((p) => p.team === player.team)
    .sort((a, b) => a.id - b.id);
  const idx = teammates.findIndex((p) => p.id === player.id);
  const total = teammates.length || 1;
  const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: center.x + Math.cos(angle) * CLUSTER_RADIUS,
    y: center.y + Math.sin(angle) * CLUSTER_RADIUS,
  };
}

function matchesQuery(player: Player, q: string): boolean {
  if (!q) return false;
  return (
    player.name.toLowerCase().includes(q) ||
    player.club.toLowerCase().includes(q) ||
    player.team.toLowerCase().includes(q) ||
    player.position.toLowerCase().includes(q)
  );
}

const FADE_STYLE = {
  maskImage:
    "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
};

interface MatchdayResult {
  hitTarget: boolean;
  stats: Record<string, number>;
}

interface Props {
  players: Player[];
  counts: Record<number, number>;
  pool: PoolState;
  myPlayerIds: Set<number>;
  query: string;
  matchdayResults: Record<number, MatchdayResult>;
  onSelect?: (player: Player) => void;
}

export function GraphView({
  players,
  counts,
  pool,
  myPlayerIds,
  query,
  matchdayResults,
  onSelect,
}: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const q = query.toLowerCase().trim();

  // Auto-center on the first matching player when the search changes.
  useEffect(() => {
    if (!q) return;
    const match = players.find((p) => matchesQuery(p, q));
    if (!match) return;
    const pos = playerPosition(match, players);
    setOffset({ x: -pos.x, y: -pos.y });
  }, [q, players]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset({
        x: dragRef.current.startOffsetX + dx,
        y: dragRef.current.startOffsetY + dy,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  const recenter = () => setOffset({ x: 0, y: 0 });

  return (
    <div className="relative w-full h-[720px] md:h-[860px] border border-zinc-900 bg-ink rounded-3xl overflow-hidden">
      {/* Grid background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      />

      {/* Pannable surface */}
      <div
        className={cn(
          "absolute inset-0 select-none touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={onPointerDown}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
            transition: isDragging ? "none" : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Center marker */}
          <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hazard/40" />

          {/* Team labels */}
          {Object.entries(TEAM_CENTERS).map(([team, pos]) => (
            <div
              key={team}
              className="absolute pointer-events-none"
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `calc(50% + ${pos.y - CLUSTER_RADIUS - 50}px)`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="text-utility text-zinc-500 text-center font-mono tracking-[0.2em]">
                {team}
              </div>
            </div>
          ))}

          {/* Player cards */}
          {players.map((p) => {
            const pos = playerPosition(p, players);
            const count = counts[p.id] ?? 0;
            const isYours = myPlayerIds.has(p.id);
            const isMatched = q === "" || matchesQuery(p, q);

            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <GraphCard
                  player={p}
                  count={count}
                  pool={pool}
                  isYours={isYours}
                  isMatched={isMatched}
                  matchdayResult={matchdayResults[p.id]}
                  onClick={() => onSelect?.(p)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Hint + recenter overlay */}
      <div className="absolute bottom-5 left-6 text-utility text-zinc-600 pointer-events-none">
        Drag to pan · click a card for details
      </div>
      <button
        onClick={recenter}
        className="absolute bottom-5 right-6 inline-flex items-center gap-2 rounded-full bg-ink-surface border border-zinc-800 hover:border-hazard px-4 py-2 text-utility text-zinc-300 hover:text-hazard transition-colors"
      >
        <Crosshair className="size-3.5" />
        Recenter
      </button>
    </div>
  );
}

interface GraphCardProps {
  player: Player;
  count: number;
  pool: PoolState;
  isYours: boolean;
  isMatched: boolean;
  matchdayResult?: MatchdayResult;
  onClick: () => void;
}

function GraphCard({
  player,
  count,
  pool,
  isYours,
  isMatched,
  matchdayResult,
  onClick,
}: GraphCardProps) {
  const isSettled = pool.phase >= 2;
  const isEliminated = isSettled && pool.eliminated_players.includes(player.id);
  const isSurvived = isSettled && !isEliminated;
  const likelihood = survivalLikelihood(player.difficulty);

  return (
    <button
      data-card
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "w-64 text-left bg-ink-surface border transition-all duration-200",
        "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]",
        isYours
          ? "border-hazard border-t-2"
          : "border-zinc-800 border-t-2 border-t-zinc-700",
        isMatched ? "opacity-100" : "opacity-20",
        "hover:border-zinc-500 hover:-translate-y-1.5",
      )}
    >
      {/* Header: flag + count */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-900">
        <CountryFlag country={player.country ?? player.team} width={22} />
        <span className="font-mono tabular text-utility text-zinc-500">
          {count}
        </span>
      </div>

      {/* Jersey */}
      <div className="relative aspect-[4/3] bg-ink-surface overflow-hidden flex items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)",
          }}
        />
        <div style={FADE_STYLE} className="relative">
          <Jersey
            {...playerColors(player)}
            number={player.number ?? 0}
            size={120}
          />
        </div>
      </div>

      {/* Body — content overlaps into the faded image */}
      <div className="relative -mt-10 px-4 pb-4">
        <div className="font-semibold text-lg leading-tight truncate">
          {player.name}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Crest club={player.club} size={16} />
          <span className="text-utility text-zinc-500">{player.position}</span>
        </div>

        {/* Likelihood / outcome */}
        <div className="mt-3 pt-3 border-t border-zinc-900">
          {isSurvived ? (
            <span className="text-utility text-hazard">✓ Through</span>
          ) : isEliminated ? (
            <span className="text-utility text-zinc-500">Out</span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-0.5 bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-hazard/60"
                  style={{ width: `${likelihood * 100}%` }}
                />
              </div>
              <span className="font-mono tabular text-[10px] text-zinc-500">
                {Math.round(likelihood * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Matchday stats */}
        {matchdayResult && (
          <div className="mt-2 flex flex-wrap gap-x-3 text-utility text-zinc-500 font-mono text-[10px]">
            {Object.entries(matchdayResult.stats)
              .slice(0, 3)
              .map(([k, v]) => (
                <span key={k}>
                  {k}: {v}
                </span>
              ))}
          </div>
        )}
      </div>
    </button>
  );
}
