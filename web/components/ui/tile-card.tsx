"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TileCard({ children, onClick, selected, disabled, className }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { y: -4 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative w-full text-left transition-colors",
        "border border-zinc-900 bg-ink-surface",
        "hover:border-zinc-700",
        selected && "border-hazard ring-1 ring-hazard",
        disabled && "opacity-40 cursor-not-allowed hover:border-zinc-900",
        "focus-visible:outline-none focus-visible:border-hazard focus-visible:ring-1 focus-visible:ring-hazard",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
