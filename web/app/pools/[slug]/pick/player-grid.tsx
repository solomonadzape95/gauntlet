"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { SearchBar } from "@/components/ui/search-bar";
import type { Player } from "@/lib/types";
import { PlayerCard } from "@/components/cards/player-card";
import { MintButton } from "./mint-button";
import { targetIcons } from "@/lib/target-icons";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { PositionBadge } from "@/components/icons/position-badge";
import { Logo } from "@/components/icons/logo";
import { useMintCounts } from "@/lib/hooks/use-mint-counts";
import { useMyPasses } from "@/lib/hooks/use-my-passes";
import { usePoolState } from "@/lib/hooks/use-pool-state";
import { formatSui } from "@/lib/sui";
import { survivalLikelihood } from "@/lib/odds";
import { BrokerPanel } from "@/components/ai-broker/broker-panel";
import { BrokerTrigger } from "@/components/ai-broker/broker-trigger";
import { playerColors } from "@/lib/team-colors";
import {
  JerseySurface,
  JERSEY_NUMBER_SHADOW,
} from "@/components/jersey/jersey-surface";

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const particles = new Set([
    "van", "von", "de", "del", "della", "di", "da", "dos", "do",
    "le", "la", "el", "al", "bin", "ibn", "ter", "den", "der",
  ]);
  let i = parts.length - 2;
  while (i >= 0 && particles.has(parts[i].toLowerCase())) i--;
  return parts.slice(i + 1).join(" ");
}

function pickNumberColor(
  primary: string,
  secondary: string,
  accent?: string,
): string {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(v, 16);
    return ((n >> 16) & 0xff) * 0.299 + ((n >> 8) & 0xff) * 0.587 + (n & 0xff) * 0.114;
  };
  const primaryLum = lum(primary) / 255;
  const cands = [secondary, accent].filter(Boolean) as string[];
  let best = cands[0] ?? "#FFFFFF";
  let bestDelta = cands[0] ? Math.abs(primaryLum - lum(cands[0]) / 255) : 0;
  for (const c of cands) {
    const d = Math.abs(primaryLum - lum(c) / 255);
    if (d > bestDelta) {
      bestDelta = d;
      best = c;
    }
  }
  if (bestDelta < 0.3) return primaryLum > 0.5 ? "#101010" : "#FFFFFF";
  return best;
}

export function PlayerGrid({
  players,
  poolId,
}: {
  players: Player[];
  /** Which on-chain pool this grid mints against (from the URL). */
  poolId: string;
}) {
  const [selected, setSelected] = useState<Player | null>(null);
  const [query, setQuery] = useState("");
  const [brokerOpen, setBrokerOpen] = useState(false);
  const counts = useMintCounts(poolId);
  const { data: passes } = useMyPasses();
  const { data: pool } = usePoolState(poolId);
  const myPlayerIds = new Set(
    (passes ?? [])
      .filter((p) => p.pool_id === poolId)
      .map((p) => p.player_id),
  );
  const myPlayerIdArray = Array.from(myPlayerIds);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.club.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q),
      )
    : players;

  return (
    <>
      <div className="mb-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search player, team, club, or position…"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filtered.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            variant="tile"
            mintedCount={counts[p.id] ?? 0}
            selected={myPlayerIds.has(p.id)}
            onClick={() => setSelected(p)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full border border-zinc-900 border-dashed p-12 text-center text-zinc-500 text-base">
            No players match &ldquo;{query}&rdquo;.
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <PlayerDetail
            player={selected}
            poolId={poolId}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <BrokerTrigger onClick={() => setBrokerOpen(true)} />
      <BrokerPanel
        open={brokerOpen}
        onClose={() => setBrokerOpen(false)}
        roster={players}
        pool={pool}
        counts={counts}
        myPlayerIds={myPlayerIdArray}
      />
    </>
  );
}

function PlayerDetail({
  player,
  poolId,
  onClose,
}: {
  player: Player;
  poolId: string;
  onClose: () => void;
}) {
  const StatIcons = targetIcons(player.target.metric);
  const likelihood = Math.round(survivalLikelihood(player.difficulty) * 100);
  const { data: poolState } = usePoolState(poolId);
  const entryFeeLabel = poolState
    ? `${formatSui(poolState.entry_fee_mist)} SUI`
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur flex items-end md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-ink-surface border border-zinc-800 my-8 overflow-hidden"
      >
        {/* Close — floats above the image */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 inline-flex items-center justify-center size-10 rounded-full bg-ink/70 backdrop-blur text-zinc-300 hover:text-hazard transition-colors"
        >
          <X className="size-5" />
        </button>

        {/* Fabric-textured banner — taller aspect so the modal reads like a
            real trading card, not a thin info strip. */}
        {(() => {
          const colors = playerColors(player);
          const numberColor = pickNumberColor(
            colors.primary,
            colors.secondary,
            colors.accent,
          );
          return (
            <JerseySurface
              colors={colors}
              className="relative aspect-[5/4] flex items-center justify-center"
            >
              {player.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.image}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  style={{
                    maskImage:
                      "linear-gradient(to bottom, black 0%, black 60%, transparent 95%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, black 0%, black 60%, transparent 95%)",
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center leading-none select-none">
                <span
                  aria-hidden
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-xirod)",
                    fontSize: "clamp(2.25rem, 4vw, 3.25rem)",
                    color: numberColor,
                    letterSpacing: "0.10em",
                    marginBottom: "0.4rem",
                    textShadow:
                      "1px 2px 0 rgba(0,0,0,0.35), 0 -1px 0 rgba(255,255,255,0.35)",
                  }}
                >
                  {lastName(player.name)}
                </span>
                <span
                  aria-hidden
                  style={{
                    fontFamily: "var(--font-xirod)",
                    fontSize: "clamp(8rem, 20vw, 14rem)",
                    lineHeight: 0.85,
                    color: numberColor,
                    letterSpacing: "0.02em",
                    ...JERSEY_NUMBER_SHADOW,
                  }}
                >
                  {player.number ?? 0}
                </span>
              </div>

              {/* Sponsor mark — bottom of the jersey banner. */}
              <Logo
                height={72}
                className="absolute left-1/2 -translate-x-1/2 bottom-5 z-10 text-white opacity-80"
              />
            </JerseySurface>
          );
        })()}

        {/* Body */}
        <div className="relative px-7 md:px-10 pt-8 pb-8 md:pb-10">
          <h2 className="font-serif text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
            {player.name}
          </h2>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-utility uppercase tracking-[0.16em] text-zinc-300">
              {player.team}
            </span>
            <span aria-hidden className="size-1 rounded-full bg-white/30" />
            <CountryFlag
              country={player.country ?? player.team}
              width={36}
            />
            <Crest club={player.club} size={36} />
            <PositionBadge position={player.position} size="md" />
          </div>

          {/* Target callout */}
          <div className="mt-8 pt-6 border-t border-zinc-900">
            <div className="text-utility text-zinc-500 mb-3">Target</div>
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-1 text-hazard shrink-0 pt-1">
                {StatIcons.map((Icon, i) => (
                  <Icon key={i} size={22} />
                ))}
              </div>
              <div className="font-medium text-hazard text-xl md:text-2xl leading-tight">
                {player.target.human}
              </div>
            </div>
            <div className="mt-3 text-utility text-zinc-500">
              {likelihood}% historical survival likelihood
            </div>
          </div>

          {/* AI rationale */}
          <div className="mt-8">
            <div className="text-utility text-zinc-500 mb-3">
              AI Game Master rationale
            </div>
            <p className="text-base md:text-lg text-zinc-300 leading-relaxed">
              {player.ai_rationale}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-4">
            <div className="text-utility text-zinc-500">
              Entry fee ·{" "}
              <span className="font-mono text-zinc-200">{entryFeeLabel}</span>
            </div>
            <MintButton player={player} poolId={poolId} onSuccess={onClose} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
