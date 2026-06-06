"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMutation, useQuery } from "convex/react";
import { useRoster } from "@/lib/hooks/use-roster";
import { usePoolState } from "@/lib/hooks/use-pool-state";
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  Pencil,
  Wallet as WalletIcon,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import {
  formatSui,
  shortAddress,
  suiscanObject,
  suiscanTx,
} from "@/lib/sui";

interface UserRow {
  _id: string;
  address: string;
  displayName?: string;
  firstSeenAt: number;
  lastSeenAt: number;
  passCount: number;
}

interface PassRow {
  _id: string;
  passId: string;
  ownerAddress: string;
  poolObjectId: string;
  playerId: number;
  status: "alive" | "out" | "cashed";
  mintedAtMs: number;
}

interface CashoutRow {
  _id: string;
  passId: string;
  poolObjectId: string;
  amountMist: string;
  txDigest: string;
  timestampMs: number;
}

interface MatchdayLite {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  poolObjectId?: string;
  fixture?: string;
  date: string;
}

export default function ProfilePage() {
  const account = useCurrentAccount();
  const address = account?.address ?? "";

  const user = useQuery(
    api.users.get,
    convexConfigured && address ? { address } : "skip",
  ) as UserRow | null | undefined;

  const passes = useQuery(
    api.passes.listByOwner,
    convexConfigured && address ? { ownerAddress: address } : "skip",
  ) as PassRow[] | undefined;

  const cashouts = useQuery(
    api.cashouts.listByOwner,
    convexConfigured && address ? { ownerAddress: address } : "skip",
  ) as CashoutRow[] | undefined;

  // A pass burns on cashout, so there's exactly one real cashout per passId.
  // Dedup by passId so the counters/list stay correct even if old duplicate
  // rows linger from before the projection was made idempotent.
  const dedupedCashouts = useMemo(() => {
    if (!cashouts) return undefined;
    const seen = new Set<string>();
    const out: CashoutRow[] = [];
    for (const c of cashouts) {
      if (seen.has(c.passId)) continue;
      seen.add(c.passId);
      out.push(c);
    }
    return out;
  }, [cashouts]);
  const cashedPassIds = useMemo(
    () => new Set((dedupedCashouts ?? []).map((c) => c.passId)),
    [dedupedCashouts],
  );

  if (!account) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Empty
          title="Profile"
          body="Connect a wallet to see your name, passes, and cashouts."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-14">
          <div className="text-utility text-zinc-500 mb-3 inline-flex items-center gap-2">
            <WalletIcon className="size-3" />
            Connected wallet
          </div>
          <ProfileHeader user={user ?? null} address={address} />
        </section>
      </CornerFrame>

      {/* Counters */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-8 grid grid-cols-2 md:grid-cols-4 -ml-px -mt-px">
          <Counter
            label="Passes held"
            value={passes === undefined ? "…" : String(passes.length)}
          />
          <Counter
            label="Alive"
            value={
              passes === undefined
                ? "…"
                : String(
                    passes.filter(
                      (p) =>
                        p.status === "alive" && !cashedPassIds.has(p.passId),
                    ).length,
                  )
            }
            accent
          />
          <Counter
            label="Cashed out"
            value={
              dedupedCashouts === undefined
                ? "…"
                : String(dedupedCashouts.length)
            }
          />
          <Counter
            label="Total winnings"
            value={
              dedupedCashouts === undefined
                ? "…"
                : formatSui(
                    dedupedCashouts.reduce(
                      (sum, c) => sum + BigInt(c.amountMist),
                      0n,
                    ),
                  )
            }
            unit="SUI"
          />
        </div>
      </section>

      {/* Passes */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-5">
            Your survival passes
          </div>
          {passes === undefined && (
            <div className="border border-zinc-900 p-5 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading passes…
            </div>
          )}
          {passes && passes.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No passes yet.{" "}
              <Link
                href="/pools"
                className="text-hazard hover:underline"
              >
                Browse pools
              </Link>{" "}
              and mint one.
            </div>
          )}
          {passes && passes.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {passes.map((p) => (
                <PassRow
                  key={p._id}
                  row={p}
                  cashed={cashedPassIds.has(p.passId)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Cashouts */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-5">Cashouts</div>
          {dedupedCashouts === undefined && (
            <div className="border border-zinc-900 p-5 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {dedupedCashouts && dedupedCashouts.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No cashouts yet. Hit a target, survive a matchday, claim a share.
            </div>
          )}
          {dedupedCashouts && dedupedCashouts.length > 0 && (
            <div className="border border-zinc-900 divide-y divide-zinc-900">
              {dedupedCashouts.map((c) => (
                <a
                  key={c._id}
                  href={suiscanTx(c.txDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-4 grid grid-cols-12 gap-3 items-center hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="col-span-5 font-mono text-xs text-zinc-300 truncate">
                    {c.passId}
                  </div>
                  <div className="col-span-3 text-base text-hazard">
                    {formatSui(BigInt(c.amountMist))} SUI
                  </div>
                  <div className="col-span-3 text-utility text-zinc-500">
                    {formatTime(c.timestampMs)}
                  </div>
                  <div className="col-span-1 text-right">
                    <ArrowUpRight className="size-4 text-zinc-600 inline" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tournaments played */}
      <TournamentsPlayed passes={passes} />
    </main>
  );
}

function ProfileHeader({
  user,
  address,
}: {
  user: UserRow | null;
  address: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useMutation(api.users.seen);
  const setDisplayName = useMutation(api.users.setDisplayName);

  const save = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    try {
      setBusy(true);
      if (!user) await seen({ address });
      await setDisplayName({ address, displayName: trimmed });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {editing ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              maxLength={30}
              className="bg-ink border border-zinc-800 px-3 py-2 text-2xl md:text-3xl font-serif font-semibold tracking-tight focus:outline-none focus:border-hazard"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) save();
                if (e.key === "Escape") {
                  setEditing(false);
                  setName(user?.displayName ?? "");
                }
              }}
            />
            <Button variant="hazard" onClick={save} disabled={busy} bullet>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(user?.displayName ?? "");
              }}
              className="text-utility text-zinc-500 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight inline-flex items-center gap-3 flex-wrap">
            {user?.displayName ? (
              user.displayName
            ) : (
              <span className="text-zinc-400 italic">No name yet</span>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit name"
              className="text-zinc-500 hover:text-hazard transition-colors"
            >
              <Pencil className="size-5" />
            </button>
          </h1>
        )}
        <div className="mt-3 flex items-center gap-2 font-mono text-sm text-zinc-400">
          <span>{shortAddress(address, 8, 6)}</span>
          <button
            onClick={copy}
            aria-label="Copy address"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-hazard transition-colors"
          >
            {copied ? (
              <>
                <Check className="size-3" /> copied
              </>
            ) : (
              <>
                <Copy className="size-3" /> copy
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-base text-red-300">{error}</div>
        )}
      </div>
      <div className="text-utility text-zinc-500 text-right">
        {user?.firstSeenAt && (
          <>
            First seen{" "}
            {new Date(user.firstSeenAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </>
        )}
      </div>
    </div>
  );
}

function PassRow({ row, cashed }: { row: PassRow; cashed: boolean }) {
  const matchday = useQuery(
    api.matchdays.getByPool,
    convexConfigured ? { poolObjectId: row.poolObjectId } : "skip",
  ) as (MatchdayLite & { rosterBlobId?: string }) | null | undefined;
  const { data: roster } = useRoster(matchday?.rosterBlobId ?? "");
  const playerName = roster?.players.find((p) => p.id === row.playerId)?.name;

  // Status is derived from the pass's OWN pool on-chain, not the stored convex
  // field (which can lag a settle) — so an eliminated player never shows as
  // alive. A recorded cashout wins outright (the pass is burned).
  const { data: chainPool } = usePoolState(row.poolObjectId);
  const eliminatedOnChain =
    !!chainPool &&
    chainPool.phase >= 2 &&
    chainPool.eliminated_players.includes(row.playerId);
  const status: "alive" | "out" | "cashed" = cashed
    ? "cashed"
    : eliminatedOnChain
      ? "out"
      : row.status;

  return (
    <li className="px-5 py-4 grid grid-cols-12 items-center gap-3">
      <div className="col-span-4 md:col-span-3 min-w-0">
        <a
          href={`/pass/${row.passId}`}
          className="font-mono text-xs text-zinc-300 hover:text-hazard truncate inline-block max-w-full"
        >
          {row.passId.slice(0, 14)}…
        </a>
      </div>
      <div className="col-span-4 md:col-span-3 min-w-0">
        <div className="text-base text-zinc-200 truncate">
          {playerName ?? `Player #${row.playerId}`}
        </div>
        <div className="text-utility text-zinc-600">#{row.playerId}</div>
      </div>
      <div className="col-span-4 md:col-span-3 min-w-0">
        {matchday ? (
          <Link
            href={`/pools/${matchday.tournamentSlug}-${matchday.mdSlug.toLowerCase()}`}
            className="text-utility text-zinc-300 hover:text-hazard truncate inline-block max-w-full"
          >
            {matchday.label} · {matchday.fixture ?? matchday.tournamentSlug}
          </Link>
        ) : (
          <span className="text-utility text-zinc-600">—</span>
        )}
      </div>
      <div className="col-span-12 md:col-span-2 md:text-right">
        <StatusPill status={status} />
      </div>
      <div className="col-span-12 md:col-span-1 md:text-right">
        <a
          href={suiscanObject(row.passId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-600 hover:text-hazard inline-flex items-center justify-end gap-1 text-utility"
        >
          tx <ArrowUpRight className="size-3" />
        </a>
      </div>
    </li>
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

function TournamentsPlayed({
  passes,
}: {
  passes: PassRow[] | undefined;
}) {
  // We need to read matchdays for each unique poolObjectId. For simplicity in
  // the MVP, render a small batch reader inside a list and dedup tournaments
  // client-side.
  if (!passes || passes.length === 0) return null;

  const uniquePools = Array.from(new Set(passes.map((p) => p.poolObjectId)));

  return (
    <section>
      <div className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-12">
        <div className="text-utility text-zinc-500 mb-5">
          Tournaments you&apos;ve played
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {uniquePools.map((poolId) => (
            <TournamentTile key={poolId} poolObjectId={poolId} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function TournamentTile({ poolObjectId }: { poolObjectId: string }) {
  const matchday = useQuery(
    api.matchdays.getByPool,
    convexConfigured ? { poolObjectId } : "skip",
  ) as MatchdayLite | null | undefined;
  const tournament = useQuery(
    api.tournaments.get,
    convexConfigured && matchday
      ? { slug: matchday.tournamentSlug }
      : "skip",
  ) as { slug: string; name: string; season: string } | null | undefined;

  if (!matchday) return null;
  return (
    <li className="border border-zinc-900 p-5 hover:border-hazard transition-colors">
      <Link
        href={`/pools/${matchday.tournamentSlug}-${matchday.mdSlug.toLowerCase()}`}
        className="block"
      >
        <div className="font-serif text-xl font-semibold text-zinc-100">
          {tournament?.name ?? matchday.tournamentSlug}
        </div>
        <div className="mt-1 text-utility text-zinc-500">
          {matchday.label} · {matchday.fixture ?? matchday.date}
        </div>
      </Link>
    </li>
  );
}

function Counter({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-zinc-900 p-5 md:p-6 -ml-px -mt-px">
      <div className="text-utility text-zinc-500 mb-2">{label}</div>
      <div
        className={
          accent
            ? "font-serif text-3xl md:text-4xl font-semibold tracking-tight text-hazard leading-none"
            : "font-serif text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100 leading-none"
        }
      >
        {value}
        {unit && (
          <span className="ml-2 text-utility text-zinc-500 align-baseline">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-display-md mb-4">{title}</h1>
      <div className="text-lg text-zinc-300">{body}</div>
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
