"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search } from "lucide-react";
import type { Player } from "@/lib/types";
import type { PoolState } from "@/lib/hooks/use-pool-state";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { PlayerJersey } from "@/components/jersey/player-jersey";
import { targetIcons } from "@/lib/target-icons";
import { formatSui } from "@/lib/sui";
import {
  survivalLikelihood,
  estimateSurvivorCount,
  payoutIfSurvives,
  netPotMist,
} from "@/lib/odds";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  players: Player[];
  pool: PoolState;
  counts: Record<number, number>;
}

export function CompareModal({
  open,
  onClose,
  players,
  pool,
  counts,
}: Props) {
  const [playerA, setPlayerA] = useState<Player | null>(null);
  const [playerB, setPlayerB] = useState<Player | null>(null);

  const estSurvivors = estimateSurvivorCount(players, counts);
  // Estimate against the post-fee pot so the comparison reflects what
  // survivors actually share.
  const payoutPerSurvivor = payoutIfSurvives(
    netPotMist(pool.pot_mist),
    estSurvivors,
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-ink-surface border border-zinc-800 my-8"
          >
            <div className="p-6 md:p-8 flex items-start justify-between border-b border-zinc-900">
              <div>
                <div className="text-utility text-zinc-500 mb-2">Compare</div>
                <h2 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
                  Two picks. Same matchday.
                </h2>
                <p className="mt-2 text-base text-zinc-400 max-w-xl">
                  Side-by-side likelihood and payout, scored against the current pool state.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <PlayerSlot
                label="Player A"
                players={players}
                value={playerA}
                onChange={setPlayerA}
              />
              <PlayerSlot
                label="Player B"
                players={players}
                value={playerB}
                onChange={setPlayerB}
              />
            </div>

            {(playerA || playerB) && (
              <div className="px-6 md:px-8 pb-6 md:pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <ComparisonCard
                  player={playerA}
                  count={playerA ? counts[playerA.id] ?? 0 : 0}
                  payoutPerSurvivor={payoutPerSurvivor}
                  pool={pool}
                />
                <ComparisonCard
                  player={playerB}
                  count={playerB ? counts[playerB.id] ?? 0 : 0}
                  payoutPerSurvivor={payoutPerSurvivor}
                  pool={pool}
                />
              </div>
            )}

            {playerA && playerB && (
              <div className="px-6 md:px-8 pb-8 pt-2 border-t border-zinc-900">
                <Verdict playerA={playerA} playerB={playerB} />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Search-based player slot. No dropdown — the result list renders inline below
 * the search input, so the modal's overflow never clips it. Once a player is
 * selected, the slot collapses to a confirmation row with a "Change" action.
 */
function PlayerSlot({
  label,
  players,
  value,
  onChange,
}: {
  label: string;
  players: Player[];
  value: Player | null;
  onChange: (p: Player) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);

  if (value && !editing) {
    return (
      <div>
        <div className="text-utility text-zinc-500 mb-2">{label}</div>
        <div className="border border-zinc-800 bg-ink px-4 py-3 flex items-center gap-3">
          <CountryFlag country={value.country ?? value.team} width={22} />
          <Crest club={value.club} size={20} />
          <div className="flex-1 min-w-0">
            <div className="text-zinc-100 truncate text-base">{value.name}</div>
            <div className="text-utility text-zinc-500 mt-0.5">
              #{value.id} · {value.team} · {value.position}
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(true);
              setQuery("");
            }}
            className="text-utility text-zinc-500 hover:text-hazard transition-colors"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const q = query.toLowerCase().trim();
  const filtered = q
    ? players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q) ||
          p.club.toLowerCase().includes(q),
      )
    : players;

  return (
    <div>
      <div className="text-utility text-zinc-500 mb-2">{label}</div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
        <input
          type="text"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={editing}
          className="w-full pl-10 pr-3 py-3 bg-ink border border-zinc-800 focus:border-hazard outline-none text-base text-zinc-100 placeholder:text-zinc-600 transition-colors"
        />
      </div>
      <div className="mt-2 border border-zinc-800 bg-ink max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-4 text-sm text-zinc-500">
            No matches.
          </div>
        ) : (
          filtered.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p);
                setEditing(false);
                setQuery("");
              }}
              className={cn(
                "w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-900 flex items-center gap-2.5 border-t border-zinc-900/40",
                i === 0 && "border-t-0",
                value?.id === p.id && "bg-zinc-900",
              )}
            >
              <CountryFlag country={p.country ?? p.team} width={18} />
              <Crest club={p.club} size={16} />
              <span className="flex-1 truncate text-zinc-100">
                {p.name}{" "}
                <span className="text-zinc-600 font-mono text-xs">#{p.id}</span>
              </span>
              <span className="text-utility text-zinc-500">{p.position}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ComparisonCard({
  player,
  count,
  payoutPerSurvivor,
  pool,
}: {
  player: Player | null;
  count: number;
  payoutPerSurvivor: bigint;
  pool: PoolState;
}) {
  if (!player) {
    return (
      <div className="border border-zinc-900 border-dashed p-5 min-h-[260px] flex items-center justify-center">
        <span className="text-utility text-zinc-600">Select to compare</span>
      </div>
    );
  }

  const likelihood = survivalLikelihood(player.difficulty);
  const StatIcons = targetIcons(player.target.metric);

  const isSettled = pool.phase >= 2;
  const isEliminated = isSettled && pool.eliminated_players.includes(player.id);
  const isSurvived = isSettled && !isEliminated;

  return (
    <div className="border border-zinc-900 p-5">
      <PlayerJersey
        player={player}
        className="aspect-[4/3] mb-4 border border-zinc-800"
      />

      <div className="flex items-center gap-2 mb-3">
        <CountryFlag country={player.country ?? player.team} width={22} />
        <Crest club={player.club} size={20} />
        <span className="text-utility text-zinc-500">{player.position}</span>
      </div>

      <h3 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
        {player.name}
      </h3>
      <div className="mt-1 text-utility text-zinc-600 font-mono">
        #{player.id} · {player.team}
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-900 space-y-3">
        <Row label="Target">
          <span className="inline-flex items-center gap-1.5 text-hazard">
            <span className="inline-flex items-center gap-1">
              {StatIcons.map((Icon, i) => (
                <Icon key={i} size={14} />
              ))}
            </span>
            {player.target.human}
          </span>
        </Row>

        <Row label="Survival likelihood">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 bg-zinc-900 overflow-hidden">
              <div
                className="h-full bg-hazard"
                style={{ width: `${likelihood * 100}%` }}
              />
            </div>
            <span className="font-mono tabular text-sm">
              {Math.round(likelihood * 100)}%
            </span>
          </div>
        </Row>

        <Row label="Current picks">{count}</Row>

        <Row label="Payout if survives">
          <span className="font-mono tabular text-hazard">
            {formatSui(payoutPerSurvivor)} SUI
          </span>
        </Row>

        {isSettled && (
          <Row label="Outcome">
            <span className={isEliminated ? "text-zinc-500" : "text-hazard font-medium"}>
              {isEliminated ? "Out" : "Through"}
            </span>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-utility text-zinc-500 pt-0.5 shrink-0">{label}</span>
      <span className="text-base text-zinc-200 text-right">{children}</span>
    </div>
  );
}

function Verdict({
  playerA,
  playerB,
}: {
  playerA: Player;
  playerB: Player;
}) {
  const aRate = survivalLikelihood(playerA.difficulty);
  const bRate = survivalLikelihood(playerB.difficulty);
  const diff = Math.abs(aRate - bRate);
  const safer = aRate > bRate ? playerA : aRate < bRate ? playerB : null;

  if (!safer || diff < 0.05) {
    return (
      <div className="text-base text-zinc-300">
        Even matchup — same tier, similar target difficulty. Pick the player you read better.
      </div>
    );
  }

  return (
    <div className="text-base text-zinc-300">
      <span className="text-hazard font-medium">{safer.name}</span> has a{" "}
      <span className="text-zinc-100 font-mono">
        {Math.round(diff * 100)}%
      </span>{" "}
      higher survival likelihood. The{" "}
      <span className="text-zinc-100">contrarian play</span> is the other one — if they hit, fewer people share the pot.
    </div>
  );
}
