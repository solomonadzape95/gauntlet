"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Player } from "@/lib/types";
import { PlayerCard } from "@/components/cards/player-card";
import { useMintCounts } from "@/lib/hooks/use-mint-counts";

const ROTATION_MS = 4400;

export function HeroCarousel({ players }: { players: Player[] }) {
  const [i, setI] = useState(0);
  const counts = useMintCounts();

  useEffect(() => {
    if (!players.length) return;
    const id = setInterval(
      () => setI((x) => (x + 1) % players.length),
      ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [players.length]);

  if (!players.length) {
    return (
      <div className="relative w-full h-[520px] md:h-[680px] bg-ink-surface border border-zinc-900 rounded-3xl flex items-center justify-center">
        <span className="text-utility text-zinc-600">Roster loading…</span>
      </div>
    );
  }

  const p = players[i];

  return (
    <div className="relative w-full h-[520px] md:h-[680px] bg-ink-surface border border-zinc-900 rounded-3xl overflow-hidden">
      {/* Editorial grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Top metadata row */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="text-utility text-zinc-500">Now featuring</span>
          <span className="size-1 rounded-full bg-hazard animate-pulse-dot" />
        </div>
        <div className="font-mono text-utility text-zinc-500 tabular">
          {String(i + 1).padStart(2, "0")} / {String(players.length).padStart(2, "0")}
        </div>
      </div>

      {/* Centered player card */}
      <div className="absolute inset-0 flex items-center justify-center px-6 md:px-12 pt-14 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[14rem] md:max-w-xs"
          >
            <PlayerCard player={p} variant="hero" mintedCount={counts[p.id] ?? 0} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-900 overflow-hidden">
        <motion.div
          key={`bar-${i}`}
          className="h-full bg-hazard"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: ROTATION_MS / 1000, ease: "linear" }}
        />
      </div>
    </div>
  );
}
