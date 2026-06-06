"use client";

import { Logo } from "@/components/icons/logo";
import { playerColors } from "@/lib/team-colors";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/cn";
import { JerseySurface, JERSEY_NUMBER_SHADOW } from "./jersey-surface";

/** Surname only (drops nobiliary particles like "van"/"de") for the jersey print. */
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

/** Pick the team colour with the most contrast against the jersey base. */
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

/**
 * The fabric "jersey" artwork used on the pick page — team-coloured surface
 * with the player's surname over their squad number, and their photo masked in
 * behind it. Shared so the pick modal and the compare modal render the same
 * card. Sizes scale to the container; pass an aspect ratio via `className`.
 */
export function PlayerJersey({
  player,
  className,
  showSponsor = false,
}: {
  player: Player;
  className?: string;
  /** Render the Gauntlet wordmark at the foot of the shirt (pick modal does). */
  showSponsor?: boolean;
}) {
  const colors = playerColors(player);
  const numberColor = pickNumberColor(
    colors.primary,
    colors.secondary,
    colors.accent,
  );

  return (
    <JerseySurface
      colors={colors}
      className={cn("relative flex items-center justify-center", className)}
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
            fontSize: "clamp(0.8rem, 2.4vw, 1.15rem)",
            color: numberColor,
            letterSpacing: "0.10em",
            marginBottom: "0.3rem",
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
            fontSize: "clamp(3.25rem, 9vw, 5.5rem)",
            lineHeight: 0.85,
            color: numberColor,
            letterSpacing: "0.02em",
            ...JERSEY_NUMBER_SHADOW,
          }}
        >
          {player.number ?? 0}
        </span>
      </div>

      {showSponsor && (
        <Logo
          height={44}
          className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 text-white opacity-80"
        />
      )}
    </JerseySurface>
  );
}
