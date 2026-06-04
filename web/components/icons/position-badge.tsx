"use client";

import { cn } from "@/lib/cn";

interface PosStyle {
  bg: string;
  text: string;
  /** Human label shown as a tooltip. */
  label: string;
}

/**
 * Per-position color map. Each role gets its own distinct hue so the badge
 * carries information at a glance — center-backs read different from
 * wing-backs, attacking mids different from defensive mids, wingers different
 * from strikers, etc. Related positions share a family (defenders trend
 * blue, mids trend green/violet, attackers trend orange/red) so the cards
 * still feel coherent, but no two positions share the same fill.
 *
 * Unknown codes get the neutral `DEFAULT` styling.
 */
const POSITION_STYLES: Record<string, PosStyle> = {
  // Keepers
  GK:  { bg: "#FBBF24", text: "#161616", label: "Goalkeeper" },

  // Defenders
  CB:  { bg: "#1E3A8A", text: "#FFFFFF", label: "Centre-back" },
  LCB: { bg: "#1E3A8A", text: "#FFFFFF", label: "Left centre-back" },
  RCB: { bg: "#1E3A8A", text: "#FFFFFF", label: "Right centre-back" },
  SW:  { bg: "#312E81", text: "#FFFFFF", label: "Sweeper" },
  LB:  { bg: "#2563EB", text: "#FFFFFF", label: "Left-back" },
  RB:  { bg: "#2563EB", text: "#FFFFFF", label: "Right-back" },
  LWB: { bg: "#06B6D4", text: "#0B1F22", label: "Left wing-back" },
  RWB: { bg: "#06B6D4", text: "#0B1F22", label: "Right wing-back" },
  WB:  { bg: "#06B6D4", text: "#0B1F22", label: "Wing-back" },
  DEF: { bg: "#2563EB", text: "#FFFFFF", label: "Defender" },

  // Midfielders
  DM:  { bg: "#7C3AED", text: "#FFFFFF", label: "Defensive midfielder" },
  CDM: { bg: "#7C3AED", text: "#FFFFFF", label: "Defensive midfielder" },
  CM:  { bg: "#10B981", text: "#0B1F17", label: "Central midfielder" },
  LCM: { bg: "#10B981", text: "#0B1F17", label: "Central midfielder" },
  RCM: { bg: "#10B981", text: "#0B1F17", label: "Central midfielder" },
  LM:  { bg: "#14B8A6", text: "#0B1F1B", label: "Left midfielder" },
  RM:  { bg: "#14B8A6", text: "#0B1F1B", label: "Right midfielder" },
  AM:  { bg: "#84CC16", text: "#1A2E04", label: "Attacking midfielder" },
  CAM: { bg: "#84CC16", text: "#1A2E04", label: "Attacking midfielder" },
  MID: { bg: "#10B981", text: "#0B1F17", label: "Midfielder" },

  // Forwards
  LW:  { bg: "#F97316", text: "#1A0F00", label: "Left winger" },
  RW:  { bg: "#F97316", text: "#1A0F00", label: "Right winger" },
  SS:  { bg: "#EC4899", text: "#FFFFFF", label: "Second striker" },
  CF:  { bg: "#DC2626", text: "#FFFFFF", label: "Centre forward" },
  ST:  { bg: "#E5462A", text: "#FFFFFF", label: "Striker" },
  F:   { bg: "#E5462A", text: "#FFFFFF", label: "Forward" },
  FW:  { bg: "#E5462A", text: "#FFFFFF", label: "Forward" },
};

const DEFAULT_STYLE: PosStyle = {
  bg: "#52525B",
  text: "#FFFFFF",
  label: "Position",
};

export function positionStyle(pos: string): PosStyle {
  return POSITION_STYLES[pos.toUpperCase()] ?? DEFAULT_STYLE;
}

const SIZE_CLASSES = {
  xs: "text-[11px] tracking-[0.16em] px-1.5 py-0.5",
  sm: "text-xs tracking-[0.14em] px-2 py-[3px]",
  md: "text-sm tracking-[0.12em] px-2.5 py-1",
  lg: "text-base tracking-[0.10em] px-3 py-1.5",
} as const;

export function PositionBadge({
  position,
  size = "sm",
  className,
}: {
  position: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const style = positionStyle(position);
  return (
    <span
      title={style.label}
      className={cn(
        "inline-flex items-center font-mono font-bold uppercase shrink-0",
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: "3px",
        boxShadow:
          "inset 0 0 0 1px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      {position}
    </span>
  );
}
