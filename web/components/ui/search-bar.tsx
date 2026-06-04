"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Shared search input. Used by /pick, /me, and any future filterable list.
 * Wraps a rounded-pill input with a leading magnifier icon.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: Props) {
  return (
    <div className={cn("relative max-w-md", className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-11 pr-4 py-3 bg-ink-surface border border-zinc-800 rounded-full text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hazard transition-colors"
      />
    </div>
  );
}
