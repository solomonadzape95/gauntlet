"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ChevronDown, Loader2, Search } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { shortAddress } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";
import { cn } from "@/lib/cn";

interface DirectoryRow {
  address: string;
  displayName?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  total: number;
  alive: number;
  cashed: number;
  out: number;
}

interface MatchdayRow {
  _id: string;
  tournamentSlug: string;
  label: string;
  fixture?: string;
  poolObjectId?: string;
}

type PoolMap = Map<string, { label: string; fixture?: string; tournamentSlug: string }>;

export default function AdminUsersPage() {
  const directory = useQuery(
    api.users.directory,
    convexConfigured ? {} : "skip",
  ) as DirectoryRow[] | undefined;
  const matchdays = useQuery(
    api.matchdays.listAll,
    convexConfigured ? {} : "skip",
  ) as MatchdayRow[] | undefined;

  const [filter, setFilter] = useState("");

  const poolMap: PoolMap = useMemo(() => {
    const m: PoolMap = new Map();
    for (const md of matchdays ?? []) {
      if (md.poolObjectId) {
        m.set(md.poolObjectId, {
          label: md.label,
          fixture: md.fixture,
          tournamentSlug: md.tournamentSlug,
        });
      }
    }
    return m;
  }, [matchdays]);

  const visible = useMemo(() => {
    if (!directory) return undefined;
    const q = filter.toLowerCase().trim();
    if (!q) return directory;
    return directory.filter(
      (u) =>
        u.address.toLowerCase().includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q),
    );
  }, [directory, filter]);

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Users</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Wallets &amp; their passes
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Every wallet that&apos;s minted a pass. Counts are live, derived from
            the passes table — expand a row to see that wallet&apos;s individual
            passes.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="mb-5 flex items-center gap-2 border border-zinc-900 bg-ink px-3 py-2 max-w-md">
            <Search className="size-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by address or name"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent flex-1 font-mono text-sm outline-none text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {directory === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading users…
            </div>
          )}
          {visible && visible.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              {directory && directory.length === 0
                ? "No users yet."
                : "No wallets match that search."}
            </div>
          )}
          {visible && visible.length > 0 && (
            <div className="border border-zinc-900 divide-y divide-zinc-900">
              <div className="px-5 py-3 grid grid-cols-12 gap-3 text-utility text-zinc-500">
                <div className="col-span-5">Wallet</div>
                <div className="col-span-2">Name</div>
                <div className="col-span-3">Passes</div>
                <div className="col-span-2 text-right">Last seen</div>
              </div>
              {visible.map((u) => (
                <UserRow key={u.address} user={u} poolMap={poolMap} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function UserRow({ user, poolMap }: { user: DirectoryRow; poolMap: PoolMap }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 grid grid-cols-12 items-center gap-3 hover:bg-zinc-900/40 transition-colors"
      >
        <div className="col-span-5 min-w-0 flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-4 text-zinc-600 transition-transform shrink-0",
              open && "rotate-180",
            )}
          />
          <span className="font-mono text-sm text-zinc-100 truncate">
            {shortAddress(user.address, 8, 6)}
          </span>
        </div>
        <div className="col-span-2 text-utility text-zinc-300 truncate">
          {user.displayName ?? <span className="text-zinc-600">—</span>}
        </div>
        <div className="col-span-3 text-utility text-zinc-500 flex items-center gap-3 flex-wrap">
          <span className="text-zinc-200">{user.total} total</span>
          <span className="text-hazard">{user.alive} alive</span>
          <span className="text-emerald-400">{user.cashed} cashed</span>
          {user.out > 0 && <span className="text-zinc-500">{user.out} out</span>}
        </div>
        <div className="col-span-2 text-utility text-zinc-600 text-right">
          {formatDate(user.lastSeenAt)}
        </div>
      </button>

      {open && <UserPasses address={user.address} poolMap={poolMap} />}
    </div>
  );
}

interface PassRow {
  _id: string;
  passId: string;
  poolObjectId: string;
  playerId: number;
  status: "alive" | "out" | "cashed";
  mintedAtMs: number;
}

function UserPasses({ address, poolMap }: { address: string; poolMap: PoolMap }) {
  const passes = useQuery(
    api.passes.listByOwner,
    convexConfigured ? { ownerAddress: address } : "skip",
  ) as PassRow[] | undefined;

  if (passes === undefined) {
    return (
      <div className="px-5 pb-4 -mt-1 text-utility text-zinc-500 inline-flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading passes…
      </div>
    );
  }
  if (passes.length === 0) {
    return (
      <div className="px-5 pb-4 -mt-1 text-utility text-zinc-600">
        No pass records for this wallet.
      </div>
    );
  }

  return (
    <div className="bg-ink-surface/40 border-t border-zinc-900/60 px-5 py-4">
      <ul className="divide-y divide-zinc-900/60">
        {passes.map((p) => {
          const pool = poolMap.get(p.poolObjectId);
          return (
            <li
              key={p._id}
              className="py-2.5 grid grid-cols-12 items-center gap-3"
            >
              <div className="col-span-4 md:col-span-3 min-w-0">
                <Link
                  href={`/pass/${p.passId}`}
                  className="font-mono text-xs text-zinc-300 hover:text-hazard truncate inline-block max-w-full"
                >
                  {p.passId.slice(0, 14)}…
                </Link>
              </div>
              <div className="col-span-3 md:col-span-2 text-utility text-zinc-500">
                Player #{p.playerId}
              </div>
              <div className="col-span-5 md:col-span-5 min-w-0 text-utility text-zinc-500 truncate">
                {pool
                  ? `${pool.label}${pool.fixture ? ` · ${pool.fixture}` : ""}`
                  : "—"}
              </div>
              <div className="col-span-12 md:col-span-2 md:text-right">
                <StatusPill status={p.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusPill({ status }: { status: "alive" | "out" | "cashed" }) {
  if (status === "alive")
    return (
      <span className="text-utility text-hazard inline-flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-hazard animate-pulse-dot" />
        Alive
      </span>
    );
  if (status === "cashed")
    return (
      <span className="text-utility text-emerald-400 inline-flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" />
        Cashed
      </span>
    );
  return (
    <span className="text-utility text-zinc-500 inline-flex items-center gap-1.5">
      <span aria-hidden className="size-1.5 rounded-full bg-zinc-500" />
      Out
    </span>
  );
}

function formatDate(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
