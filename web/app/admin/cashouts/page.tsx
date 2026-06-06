"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2, Search } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { formatSui, shortAddress, suiscanTx } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

interface CashoutRow {
  _id: string;
  passId: string;
  ownerAddress: string;
  poolObjectId: string;
  amountMist: string;
  txDigest: string;
  timestampMs: number;
}

interface MatchdayRow {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  fixture?: string;
  poolObjectId?: string;
}

interface TournamentRow {
  _id: string;
  slug: string;
  name: string;
}

export default function AdminCashoutsPage() {
  const rows = useQuery(
    api.cashouts.recent,
    convexConfigured ? { limit: 500 } : "skip",
  ) as CashoutRow[] | undefined;
  const matchdays = useQuery(
    api.matchdays.listAll,
    convexConfigured ? {} : "skip",
  ) as MatchdayRow[] | undefined;
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;

  const [tournamentSlug, setTournamentSlug] = useState("all");
  const [search, setSearch] = useState("");

  // poolObjectId → { tournamentSlug, label, fixture } so each cashout row can
  // name the tournament + matchday it belongs to and be filtered by it.
  const poolMap = useMemo(() => {
    const m = new Map<
      string,
      { tournamentSlug: string; label: string; fixture?: string }
    >();
    for (const md of matchdays ?? []) {
      if (md.poolObjectId) {
        m.set(md.poolObjectId, {
          tournamentSlug: md.tournamentSlug,
          label: md.label,
          fixture: md.fixture,
        });
      }
    }
    return m;
  }, [matchdays]);

  const tournamentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tournaments ?? []) m.set(t.slug, t.name);
    return m;
  }, [tournaments]);

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    const q = search.toLowerCase().trim();
    return rows.filter((c) => {
      const pool = poolMap.get(c.poolObjectId);
      if (tournamentSlug !== "all" && pool?.tournamentSlug !== tournamentSlug) {
        return false;
      }
      if (!q) return true;
      return (
        c.passId.toLowerCase().includes(q) ||
        c.ownerAddress.toLowerCase().includes(q)
      );
    });
  }, [rows, search, tournamentSlug, poolMap]);

  const total = useMemo(
    () =>
      (filtered ?? []).reduce((sum, c) => sum + BigInt(c.amountMist || "0"), 0n),
    [filtered],
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Cashouts</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Cashout receipts
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Every survivor cashout, derived from the on-chain event cache. Filter
            by tournament, search by pass id or wallet — each row links to its
            Sui transaction.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          {/* Toolbar */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              value={tournamentSlug}
              onChange={(e) => setTournamentSlug(e.target.value)}
              className="bg-ink border border-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-hazard"
            >
              <option value="all">All tournaments</option>
              {(tournaments ?? []).map((t) => (
                <option key={t._id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 border border-zinc-800 bg-ink px-3 py-2 flex-1 min-w-[14rem] max-w-md">
              <Search className="size-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search pass id or wallet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent flex-1 font-mono text-sm outline-none text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {filtered && (
              <div className="ml-auto text-utility text-zinc-500">
                {filtered.length} cashout{filtered.length === 1 ? "" : "s"} ·{" "}
                <span className="font-mono text-hazard">
                  {formatSui(total)} SUI
                </span>{" "}
                total
              </div>
            )}
          </div>

          {rows === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {filtered && filtered.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              {rows && rows.length === 0
                ? "No cashouts yet."
                : "No cashouts match these filters."}
            </div>
          )}
          {filtered && filtered.length > 0 && (
            <div className="border border-zinc-900 divide-y divide-zinc-900">
              <div className="px-5 py-3 grid grid-cols-12 gap-3 text-utility text-zinc-500">
                <div className="col-span-3">Pass</div>
                <div className="col-span-2">Owner</div>
                <div className="col-span-3">Tournament</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-1">When</div>
                <div className="col-span-1 text-right">Tx</div>
              </div>
              {filtered.map((c) => {
                const pool = poolMap.get(c.poolObjectId);
                const tName = pool
                  ? tournamentName.get(pool.tournamentSlug) ??
                    pool.tournamentSlug
                  : "—";
                return (
                  <a
                    key={c._id}
                    href={suiscanTx(c.txDigest)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="col-span-3 font-mono text-xs text-zinc-300 truncate">
                      {c.passId}
                    </div>
                    <div className="col-span-2 font-mono text-xs text-zinc-400 truncate">
                      {shortAddress(c.ownerAddress)}
                    </div>
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm text-zinc-200 truncate">
                        {tName}
                      </div>
                      {pool && (
                        <div className="text-utility text-zinc-500 truncate">
                          {pool.label}
                          {pool.fixture ? ` · ${pool.fixture}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-base text-hazard">
                      {formatSui(BigInt(c.amountMist || "0"))} SUI
                    </div>
                    <div className="col-span-1 text-utility text-zinc-500">
                      {formatTime(c.timestampMs)}
                    </div>
                    <div className="col-span-1 text-right">
                      <ArrowUpRight className="size-4 text-zinc-600 inline" />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatTime(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
