"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchRoster } from "@/lib/walrus";
import { continentFor, CONTINENTS, type Continent } from "@/lib/continents";
import type { Player } from "@/lib/types";

type Bracket = "all" | "u21" | "21-25" | "26-30" | "31+";

const BRACKETS: Array<{ value: Bracket; label: string }> = [
  { value: "all", label: "All ages" },
  { value: "u21", label: "U21" },
  { value: "21-25", label: "21–25" },
  { value: "26-30", label: "26–30" },
  { value: "31+", label: "31+" },
];

interface Props {
  /** Walrus blob id of the parent tournament's master player pool. */
  playerPoolBlobId: string;
  /** Called every time the filter result changes. */
  onChange?: (filtered: Player[]) => void;
}

/**
 * Filter the master player pool down by country / continent / club /
 * position / age bracket. Each facet is a multi-select that defaults to ALL
 * (no constraint). Emits the filtered Player[] up via onChange so the parent
 * (matchday create panel) can ship the subset to Walrus + chain.
 */
export function RosterCriteriaFilter({ playerPoolBlobId, onChange }: Props) {
  const [pool, setPool] = useState<Player[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [countries, setCountries] = useState<Set<string>>(new Set());
  const [continents, setContinents] = useState<Set<Continent>>(new Set());
  const [clubs, setClubs] = useState<Set<string>>(new Set());
  const [positions, setPositions] = useState<Set<string>>(new Set());
  const [bracket, setBracket] = useState<Bracket>("all");

  // Fetch player pool from Walrus on mount / blob change.
  useEffect(() => {
    if (!playerPoolBlobId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchRoster(playerPoolBlobId)
      .then((data) => {
        if (cancelled) return;
        setPool(data.players ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerPoolBlobId]);

  const facets = useMemo(() => {
    if (!pool) return { countries: [], clubs: [], positions: [] };
    const country = new Set<string>();
    const club = new Set<string>();
    const position = new Set<string>();
    for (const p of pool) {
      if (p.team) country.add(p.team);
      if (p.club) club.add(p.club);
      if (p.position) position.add(p.position);
    }
    return {
      countries: Array.from(country).sort(),
      clubs: Array.from(club).sort(),
      positions: Array.from(position).sort(),
    };
  }, [pool]);

  const filtered = useMemo(() => {
    if (!pool) return [];
    return pool.filter((p) => {
      if (countries.size > 0 && !countries.has(p.team)) return false;
      if (continents.size > 0 && !continents.has(continentFor(p.team)))
        return false;
      if (clubs.size > 0 && !clubs.has(p.club)) return false;
      if (positions.size > 0 && !positions.has(p.position)) return false;
      if (bracket !== "all" && !inBracket(p.age, bracket)) return false;
      return true;
    });
  }, [pool, countries, continents, clubs, positions, bracket]);

  useEffect(() => {
    onChange?.(filtered);
  }, [filtered, onChange]);

  if (loading) {
    return (
      <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Fetching player pool from
        Walrus…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="border border-red-900/50 bg-red-950/20 p-4 text-red-300">
        Failed to load player pool: {loadError}
      </div>
    );
  }
  if (!pool) {
    return (
      <div className="border border-zinc-900 p-6 text-zinc-500">
        No player pool attached to this tournament. Upload one from{" "}
        <a href="/admin/rosters" className="text-hazard hover:underline">
          Rosters
        </a>{" "}
        first.
      </div>
    );
  }

  return (
    <div className="border border-zinc-900 p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-utility text-zinc-500">Filter criteria</div>
        <div className="text-utility">
          <span className="text-hazard font-semibold text-base">
            {filtered.length}
          </span>{" "}
          / {pool.length} match
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiChips
          label="Country"
          options={facets.countries}
          selected={countries}
          onToggle={(v) => toggle(countries, v, setCountries)}
        />
        <MultiChips
          label="Continent"
          options={CONTINENTS}
          selected={continents}
          onToggle={(v) =>
            toggle(continents, v as Continent, setContinents as (s: Set<string>) => void)
          }
        />
        <MultiChips
          label="Club"
          options={facets.clubs}
          selected={clubs}
          onToggle={(v) => toggle(clubs, v, setClubs)}
        />
        <MultiChips
          label="Position"
          options={facets.positions}
          selected={positions}
          onToggle={(v) => toggle(positions, v, setPositions)}
        />
        <div className="md:col-span-2">
          <label className="text-utility text-zinc-500 block mb-2">Age</label>
          <div className="flex flex-wrap gap-1.5">
            {BRACKETS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setBracket(b.value)}
                className={
                  "px-3 py-1.5 text-utility border transition-colors " +
                  (bracket === b.value
                    ? "border-hazard text-hazard"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200")
                }
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {filtered.length > 0 && (
        <div className="mt-6 border border-zinc-900 max-h-64 overflow-y-auto">
          <div className="px-4 py-2 border-b border-zinc-900 text-utility text-zinc-500">
            Preview ({filtered.length})
          </div>
          <ul className="divide-y divide-zinc-900">
            {filtered.slice(0, 50).map((p) => (
              <li key={p.id} className="px-4 py-2 grid grid-cols-12 gap-2">
                <div className="col-span-5 text-sm text-zinc-100 truncate">
                  {p.name}
                </div>
                <div className="col-span-3 text-utility text-zinc-500 truncate">
                  {p.team}
                </div>
                <div className="col-span-3 text-utility text-zinc-500 truncate">
                  {p.club}
                </div>
                <div className="col-span-1 text-utility text-zinc-500 text-right">
                  {p.position}
                </div>
              </li>
            ))}
            {filtered.length > 50 && (
              <li className="px-4 py-2 text-utility text-zinc-600">
                + {filtered.length - 50} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function MultiChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-utility text-zinc-500 block mb-2">
        {label}
        {selected.size > 0 && (
          <span className="ml-2 text-zinc-400">({selected.size})</span>
        )}
      </label>
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-zinc-900 p-2 bg-ink">
        {options.length === 0 && (
          <span className="text-utility text-zinc-600">—</span>
        )}
        {options.map((opt) => {
          const on = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={
                "px-2.5 py-1 text-xs border transition-colors " +
                (on
                  ? "border-hazard text-hazard"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200")
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggle<T extends string>(
  current: Set<T>,
  value: T,
  setter: (next: Set<T>) => void,
) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function inBracket(age: number | undefined, bracket: Exclude<Bracket, "all">) {
  if (age === undefined) return false;
  switch (bracket) {
    case "u21":
      return age < 21;
    case "21-25":
      return age >= 21 && age <= 25;
    case "26-30":
      return age >= 26 && age <= 30;
    case "31+":
      return age >= 31;
  }
}
