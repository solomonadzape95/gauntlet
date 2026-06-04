"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Loader2, Plus, Trash2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { Button } from "@/components/ui/button";
import { suiscanObject, shortAddress } from "@/lib/sui";
import { convexConfigured } from "@/lib/convex";

export default function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const tournament = useQuery(
    api.tournaments.get,
    convexConfigured ? { slug } : "skip",
  );
  const matchdays = useQuery(
    api.matchdays.listForTournament,
    convexConfigured ? { tournamentSlug: slug } : "skip",
  );

  if (tournament === undefined && convexConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center text-zinc-500">
        <Loader2 className="size-5 animate-spin mx-auto mb-3" />
        Loading…
      </div>
    );
  }

  if (tournament === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-semibold mb-2">
          Tournament not found
        </h1>
        <p className="text-zinc-400 mb-6">
          No tournament with slug <code className="font-mono">{slug}</code>.
        </p>
        <Link
          href="/admin/tournaments"
          className="text-zinc-400 hover:text-hazard"
        >
          ← Back to tournaments
        </Link>
      </div>
    );
  }

  const t = tournament;
  const sortedMds = matchdays
    ? [...matchdays].sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <Link
            href="/admin/tournaments"
            className="text-utility text-zinc-500 hover:text-hazard inline-flex items-center gap-1.5 mb-4"
          >
            ← All tournaments
          </Link>
          <div className="grid grid-cols-12 gap-8 items-end">
            <div className="col-span-12 md:col-span-7">
              <div className="text-utility text-zinc-500 mb-3">
                {t?.season} · {t?.status}
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">
                {t?.name}
              </h1>
              <p className="mt-3 text-base text-zinc-300 leading-relaxed max-w-2xl">
                {t?.tagline}
              </p>
              <div className="mt-4 text-utility text-zinc-500 space-y-1">
                <div>
                  Slug:{" "}
                  <code className="font-mono text-zinc-300">{t?.slug}</code>
                </div>
                {t?.playerPoolBlobId && (
                  <div>
                    Player pool blob:{" "}
                    <code className="font-mono text-zinc-300 break-all">
                      {t.playerPoolBlobId.slice(0, 20)}…
                    </code>
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-12 md:col-span-5">
              <div
                aria-hidden
                className="aspect-[16/9] bg-cover bg-center border border-zinc-900"
                style={{ backgroundImage: `url(${t?.image})` }}
              />
            </div>
          </div>
        </section>
      </CornerFrame>

      {/* Matchdays */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="flex items-center justify-between mb-5">
            <div className="text-utility text-zinc-500">Matchday pools</div>
            <Link href={`/admin/tournaments/${slug}/matchdays/new`}>
              <Button variant="hazard" bullet>
                <Plus className="size-3.5" /> Add matchday
              </Button>
            </Link>
          </div>

          {matchdays === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {matchdays && sortedMds.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No matchdays yet. Spawn one to mint the on-chain Pool.
            </div>
          )}
          {sortedMds.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {sortedMds.map((m) => (
                <MatchdayRow key={m._id} md={m} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

interface MdLite {
  _id: string;
  label: string;
  mdSlug: string;
  date: string;
  fixture?: string;
  status: "live" | "soon" | "done";
  poolObjectId?: string;
  rosterBlobId?: string;
}

function MatchdayRow({ md }: { md: MdLite }) {
  const remove = useMutation(api.matchdays.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    const hasPool = !!md.poolObjectId;
    const baseMsg = `Delete matchday "${md.label}" (${md.mdSlug})?`;
    const force =
      hasPool &&
      confirm(
        `${baseMsg}\n\nThis matchday is pinned to an on-chain Pool (${md.poolObjectId?.slice(0, 10)}…). The on-chain pool itself won't be touched, but the row will be removed from Convex.\n\nForce delete?`,
      );
    if (!force && hasPool) return;
    if (!hasPool && !confirm(baseMsg)) return;

    try {
      setBusy(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await remove({ id: md._id as any, ...(hasPool ? { force: true } : {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-5 py-4 grid grid-cols-12 gap-3 items-center">
      <div className="col-span-3 md:col-span-2 font-mono text-sm text-zinc-100">
        {md.label}
      </div>
      <div className="col-span-9 md:col-span-3 min-w-0">
        <div className="text-base text-zinc-100 truncate">
          {md.fixture ?? "—"}
        </div>
        <div className="text-utility text-zinc-500 mt-0.5">{md.date}</div>
      </div>
      <div className="col-span-4 md:col-span-2">
        <span
          className={
            md.status === "live"
              ? "text-utility text-emerald-400"
              : md.status === "done"
                ? "text-utility text-zinc-500"
                : "text-utility text-zinc-600"
          }
        >
          {md.status}
        </span>
      </div>
      <div className="col-span-8 md:col-span-3 text-right">
        {md.poolObjectId ? (
          <a
            href={suiscanObject(md.poolObjectId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-zinc-300 hover:text-hazard inline-flex items-center gap-1"
          >
            {shortAddress(md.poolObjectId, 6, 4)}
            <ArrowUpRight className="size-3" />
          </a>
        ) : (
          <span className="text-utility text-zinc-600">no pool yet</span>
        )}
      </div>
      <div className="col-span-12 md:col-span-1 text-right text-utility text-zinc-600">
        {md.rosterBlobId ? "✓ roster" : "—"}
      </div>
      <div className="col-span-12 md:col-span-1 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          aria-label="Delete matchday"
          className="text-zinc-500 hover:text-red-400 inline-flex items-center justify-end gap-1 text-utility transition-colors disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>
      {error && (
        <div className="col-span-12 text-utility text-red-400 mt-1">
          {error}
        </div>
      )}
    </li>
  );
}
