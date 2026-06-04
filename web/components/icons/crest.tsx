"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  club: string;
  size?: number;
  className?: string;
}

// API-Football team IDs. Their media CDN serves logos at
// https://media.api-sports.io/football/teams/<id>.png — no key required.
// To add or correct an entry, look the team up at https://www.api-football.com/.
const CLUB_ID: Record<string, number> = {
  // English
  "Manchester City": 50,
  "Man City": 50,
  "Manchester United": 33,
  "Man United": 33,
  Liverpool: 40,
  Arsenal: 42,
  Chelsea: 49,
  Tottenham: 47,
  "Tottenham Hotspur": 47,

  // Spanish
  "Real Madrid": 541,
  Barcelona: 529,
  "FC Barcelona": 529,
  "Atlético Madrid": 530,
  "Atletico Madrid": 530,
  "Athletic Bilbao": 531,
  "Athletic Club": 531,

  // German
  "Bayern Munich": 157,
  "Bayern München": 157,
  "Borussia Dortmund": 165,
  "Bayer Leverkusen": 168,
  "RB Leipzig": 173,

  // Italian
  "Inter Milan": 505,
  Inter: 505,
  Internazionale: 505,
  "AC Milan": 489,
  Milan: 489,
  Juventus: 496,
  Napoli: 492,
  Roma: 497,
  "AS Roma": 497,

  // French
  PSG: 85,
  "Paris Saint-Germain": 85,
  Marseille: 81,
  "Olympique Marseille": 81,
  Lyon: 80,
  "Olympique Lyonnais": 80,
  Monaco: 91,

  // Rest of world (Last Eleven coverage)
  "Inter Miami": 1616,
  "Al-Nassr": 2939,
  "Al-Hilal": 2932,
  Galatasaray: 645,
  Fenerbahçe: 611,
};

function clubLogoUrl(club: string): string | null {
  const id = CLUB_ID[club];
  if (!id) return null;
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

function initials(club: string): string {
  return club
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function Crest({ club, size = 20, className }: Props) {
  const [errored, setErrored] = useState(false);
  const url = clubLogoUrl(club);

  if (!url || errored) {
    return (
      <CrestFallback text={initials(club)} size={size} className={className} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${club} crest`}
      width={size}
      height={size}
      className={cn("inline-block object-contain shrink-0", className)}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}

function CrestFallback({
  text,
  size,
  className,
}: {
  text: string;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center bg-zinc-900 border border-zinc-800 shrink-0",
        className,
      )}
      style={{ width: size, height: size, borderRadius: 2 }}
    >
      <span
        className="font-mono font-medium text-zinc-400 leading-none"
        style={{ fontSize: Math.max(8, size * 0.42) }}
      >
        {text}
      </span>
    </div>
  );
}
