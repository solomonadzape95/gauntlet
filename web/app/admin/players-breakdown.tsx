"use client";

import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { formatSui } from "@/lib/sui";
import type { Player } from "@/lib/types";
import type { PoolState } from "@/lib/hooks/use-pool-state";
import { cn } from "@/lib/cn";

interface Props {
  roster: Player[];
  counts: Record<number, number>;
  pool: PoolState;
}

export function PlayersBreakdown({ roster, counts, pool }: Props) {
  const rows = roster
    .map((player) => {
      const count = counts[player.id] ?? 0;
      const isEliminated =
        pool.phase >= 2 && pool.eliminated_players.includes(player.id);
      return { player, count, isEliminated };
    })
    .sort((a, b) => b.count - a.count);

  const totalPicks = Math.max(1, pool.total_passes);
  const payoutPerSurvivor =
    pool.alive_count > 0 ? pool.pot_mist / BigInt(pool.alive_count) : 0n;

  return (
    <div className="border border-zinc-900">
      <div className="px-6 py-4 border-b border-zinc-900">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          Per-player breakdown
        </h2>
        <p className="text-utility text-zinc-500 mt-1.5">
          Sixteen players, ranked by current pick count.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-900">
              <th className="text-utility text-zinc-500 text-left px-6 py-3 font-normal">
                Rank
              </th>
              <th className="text-utility text-zinc-500 text-left px-3 py-3 font-normal">
                Player
              </th>
              <th className="text-utility text-zinc-500 text-right px-3 py-3 font-normal">
                Picks
              </th>
              <th className="text-utility text-zinc-500 text-right px-3 py-3 font-normal">
                Share
              </th>
              <th className="text-utility text-zinc-500 text-right px-3 py-3 font-normal">
                Status
              </th>
              <th className="text-utility text-zinc-500 text-right px-6 py-3 font-normal">
                Payout
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <PlayerRow
                key={row.player.id}
                rank={idx + 1}
                player={row.player}
                count={row.count}
                isEliminated={row.isEliminated}
                pool={pool}
                totalPicks={totalPicks}
                payoutPerSurvivor={payoutPerSurvivor}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({
  rank,
  player,
  count,
  isEliminated,
  pool,
  totalPicks,
  payoutPerSurvivor,
}: {
  rank: number;
  player: Player;
  count: number;
  isEliminated: boolean;
  pool: PoolState;
  totalPicks: number;
  payoutPerSurvivor: bigint;
}) {
  const isSurvived = pool.phase >= 2 && !isEliminated;
  const pct = (count / totalPicks) * 100;

  return (
    <tr
      className={cn(
        "border-t border-zinc-900/60 hover:bg-zinc-900/30 transition-colors",
        isEliminated && "opacity-50",
      )}
    >
      <td className="px-6 py-3 font-mono tabular text-sm text-zinc-500">
        {String(rank).padStart(2, "0")}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <CountryFlag country={player.country ?? player.team} width={20} />
          <Crest club={player.club} size={18} />
          <span className="font-medium text-zinc-100">{player.name}</span>
          <span className="text-utility text-zinc-500">{player.position}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono tabular text-base text-zinc-100">
        {count}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular text-sm text-zinc-400">
        {pct.toFixed(1)}%
      </td>
      <td className="px-3 py-3 text-right">
        {pool.phase < 2 ? (
          <span className="text-utility text-zinc-500">Awaiting</span>
        ) : isSurvived ? (
          <span className="text-utility text-hazard">Through</span>
        ) : (
          <span className="text-utility text-zinc-500">Out</span>
        )}
      </td>
      <td className="px-6 py-3 text-right font-mono tabular text-sm">
        {isSurvived && count > 0 ? (
          <span className="text-hazard">{formatSui(payoutPerSurvivor)} SUI</span>
        ) : (
          <span className="text-zinc-700">—</span>
        )}
      </td>
    </tr>
  );
}
