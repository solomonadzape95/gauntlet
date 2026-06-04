import type { ComponentType, SVGProps } from "react";
import {
  GoalIcon,
  AssistIcon,
  TackleIcon,
  PassIcon,
  SaveIcon,
  CleanSheetIcon,
  ShotOnTargetIcon,
} from "@/components/icons/stat-icons";
import {
  StarIcon,
  RegularIcon,
  WorkhorseIcon,
  DefenderIcon,
  KeeperIcon,
} from "@/components/icons/tier-icons";
import type { Difficulty } from "./types";

export type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number }
>;

export const TIER_ICON: Record<Difficulty, IconComponent> = {
  star: StarIcon,
  regular: RegularIcon,
  workhorse: WorkhorseIcon,
  defender: DefenderIcon,
  GK: KeeperIcon,
};

// New punchier names per the redesign.
export const TIER_LABEL: Record<Difficulty, string> = {
  star: "Elite",
  regular: "Standard",
  workhorse: "Engine",
  defender: "Wall",
  GK: "Gloves",
};

export const TIER_TONE: Record<Difficulty, string> = {
  star: "text-hazard",
  regular: "text-zinc-300",
  workhorse: "text-emerald-300",
  defender: "text-sky-300",
  GK: "text-fuchsia-300",
};

// Hex values, used for the vertical accent stripe on the new PlayerCard.
export const TIER_STRIPE: Record<Difficulty, string> = {
  star: "#F5FF00",
  regular: "#D4D4D8",
  workhorse: "#6EE7B7",
  defender: "#7DD3FC",
  GK: "#F0ABFC",
};

// Kept for backward compat in case any surface still imports them.
// New components should NOT use these — the side stripe is the source of truth.
export const TIER_BG_TINT: Record<Difficulty, string> = {
  star: "bg-hazard/[0.06]",
  regular: "bg-zinc-300/[0.04]",
  workhorse: "bg-emerald-400/[0.06]",
  defender: "bg-sky-400/[0.06]",
  GK: "bg-fuchsia-400/[0.06]",
};

export const TIER_BORDER_COLOR: Record<Difficulty, string> = {
  star: "border-t-hazard",
  regular: "border-t-zinc-400",
  workhorse: "border-t-emerald-400",
  defender: "border-t-sky-400",
  GK: "border-t-fuchsia-400",
};

export function targetIcons(metric: string): IconComponent[] {
  switch (metric) {
    case "goals":
      return [GoalIcon];
    case "goals_or_assists":
      return [GoalIcon, AssistIcon];
    case "shots_on_target":
      return [ShotOnTargetIcon];
    case "tackles_and_passacc":
      return [TackleIcon, PassIcon];
    case "cleansheet_or_goal":
      return [CleanSheetIcon, GoalIcon];
    case "saves_or_cleansheet":
      return [SaveIcon, CleanSheetIcon];
    default:
      return [GoalIcon];
  }
}
