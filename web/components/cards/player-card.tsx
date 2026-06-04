"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Player } from "@/lib/types";
import { CountryFlag } from "@/components/icons/country-flag";
import { Crest } from "@/components/icons/crest";
import { PositionBadge } from "@/components/icons/position-badge";
import { Logo } from "@/components/icons/logo";
import { playerColors } from "@/lib/team-colors";
import {
  JerseySurface,
  JERSEY_NUMBER_SHADOW,
} from "@/components/jersey/jersey-surface";
import { targetIcons } from "@/lib/target-icons";
import { survivalLikelihood } from "@/lib/odds";
import { cn } from "@/lib/cn";

type Variant = "tile" | "hero" | "detail";

interface Props {
  player: Player;
  variant?: Variant;
  onClick?: () => void;
  selected?: boolean;
  mintedCount?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Extract the player's last name, keeping common name particles
 * ("van Dijk", "De Bruyne", "Da Silva"). Falls back to the full name when
 * there's no whitespace to split on.
 */
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

/** Pick the most legible number color against the team's primary fill. */
function pickNumberColor(primary: string, secondary: string, accent?: string): string {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(v, 16);
    const r = (n >> 16) & 0xff,
      g = (n >> 8) & 0xff,
      b = n & 0xff;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const primaryLum = lum(primary);
  const candidates = [secondary, accent].filter(Boolean) as string[];
  let best = candidates[0] ?? "#FFFFFF";
  let bestDelta = candidates[0] ? Math.abs(primaryLum - lum(candidates[0])) : 0;
  for (const c of candidates) {
    const delta = Math.abs(primaryLum - lum(c));
    if (delta > bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }
  if (bestDelta < 0.3) {
    return primaryLum > 0.5 ? "#101010" : "#FFFFFF";
  }
  return best;
}

export function PlayerCard({
  player,
  variant = "tile",
  onClick,
  selected,
  mintedCount = 0,
  disabled,
  className,
}: Props) {
  const StatIcons = targetIcons(player.target.metric);
  const likelihood = Math.round(survivalLikelihood(player.difficulty) * 100);

  const isHero = variant === "hero";
  const showTarget = variant !== "tile";
  const interactive = !!onClick && !disabled;

  const colors = playerColors(player);
  const numberColor = pickNumberColor(
    colors.primary,
    colors.secondary,
    colors.accent,
  );
  const [portraitFailed, setPortraitFailed] = useState(false);
  const showPortrait = !!player.image && !portraitFailed;

  return (
    <motion.div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      whileHover={interactive ? { y: -6, scale: 1.01 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cn(
        "group relative w-full flex flex-col text-left aspect-[3/5]",
        "overflow-hidden transition-shadow",
        "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]",
        "hover:shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)]",
        selected && "ring-2 ring-hazard ring-offset-2 ring-offset-ink",
        interactive && "cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hazard",
        className,
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-utility text-ink z-30 px-2.5 py-1 rounded-full bg-hazard font-semibold">
          Owned
        </span>
      )}

      {/* Hero area — fabric surface with surname directly above the number,
          stacked tight like the print layout on a real jersey back. */}
      <JerseySurface
        colors={colors}
        className="relative flex-1 flex items-center justify-center"
      >
        {showPortrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.image!}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-top"
            style={{
              maskImage:
                "linear-gradient(to bottom, black 0%, black 55%, transparent 92%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, black 55%, transparent 92%)",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              setPortraitFailed(true);
            }}
          />
        )}

        <div className="relative z-10 flex flex-col items-center leading-none select-none gap-5">
          {/* Surname sits directly on top of the number — same tight gap a
              real heat-pressed shirt has between NAME and NUMBER. */}
          <span
            aria-hidden
            className="uppercase"
            style={{
              fontFamily: "var(--font-xirod)",
              fontSize: isHero ? "2.25rem" : "1.5rem",
              color: numberColor,
              letterSpacing: "0.10em",
              marginBottom: isHero ? "0.25rem" : "0.15rem",
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
              fontSize: isHero ? "10.5rem" : "8rem",
              lineHeight: 0.85,
              color: numberColor,
              letterSpacing: "0.02em",
              ...JERSEY_NUMBER_SHADOW,
            }}
          >
            {player.number ?? 0}
          </span>
        </div>

        {/* Sponsor mark — bottom of the jersey, like a kit manufacturer logo. */}
        <Logo
          height={isHero ? 56 : 42}
          className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 text-white opacity-80"
        />
      </JerseySurface>

      {/* Translucent footer band — full name + chips. */}
      <div
        className="relative z-20 px-5 pt-10 pb-4"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 55%, transparent 100%)",
        }}
      >
        {/* Full player name */}
        <div
          className={cn(
            "font-serif font-semibold tracking-tight leading-[1.05] text-white",
            isHero ? "text-3xl md:text-4xl" : "text-xl md:text-2xl",
          )}
        >
          {player.name}
        </div>

        <div className="mt-2 flex items-center gap-2 text-white/85 flex-wrap">
          <span className="text-utility uppercase tracking-[0.16em] text-white">
            {player.team}
          </span>

          <span aria-hidden className="size-1 rounded-full bg-white/30" />

          {/* Real country flag (player.country) — falls back silently if
              we don't have an ISO mapping for that country yet. */}
          <CountryFlag
            country={player.country ?? player.team}
            width={isHero ? 30 : 26}
          />

          {player.club && <Crest club={player.club} size={isHero ? 28 : 24} />}

          <PositionBadge
            position={player.position}
            size={isHero ? "md" : "sm"}
          />
        </div>

        {showTarget && (
          <div className="mt-3 pt-3 border-t border-white/15">
            <div className="text-utility text-white/60 mb-1.5">Target</div>
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1 text-hazard shrink-0 pt-0.5">
                {StatIcons.map((Icon, i) => (
                  <Icon key={i} size={isHero ? 18 : 14} />
                ))}
              </div>
              <div
                className={cn(
                  "font-medium text-hazard leading-tight",
                  isHero ? "text-base md:text-lg" : "text-sm",
                )}
              >
                {player.target.human}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-utility text-white/55">
          <span>{likelihood}% likely</span>
          <span className="font-mono tabular text-white/45">
            {mintedCount} picks
          </span>
        </div>
      </div>
    </motion.div>
  );
}
