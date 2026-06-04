"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { convexConfigured } from "@/lib/convex";

export default function AdminSettlementsPage() {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Settlements · matchday workspace
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            Settle a matchday
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Pick a tournament to see its matchday pools, then choose a pool to
            click-eliminate players, push results to Walrus, and call{" "}
            <code className="font-mono">settle_pool</code> on chain.
          </p>
        </section>
      </CornerFrame>

      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10">
          {tournaments === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {tournaments && tournaments.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No tournaments yet. Create one from{" "}
              <Link
                href="/admin/tournaments"
                className="text-hazard hover:underline"
              >
                Tournaments
              </Link>
              .
            </div>
          )}
          {tournaments && tournaments.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {(tournaments as Array<{
                _id: string;
                slug: string;
                name: string;
                season: string;
              }>).map((t) => (
                <li key={t._id}>
                  <Link
                    href={`/admin/tournaments/${t.slug}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-serif text-xl font-semibold text-zinc-100 truncate">
                        {t.name}
                      </div>
                      <div className="text-utility text-zinc-500 mt-1">
                        {t.season}
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 text-zinc-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="border border-zinc-900 p-6 md:p-8">
            <div className="text-utility text-zinc-500 mb-2">
              Quick path · current pool
            </div>
            <p className="text-base text-zinc-300 max-w-xl leading-relaxed">
              Until per-pool settlement screens land, the on-chain settle button
              for the currently-configured Pool lives on{" "}
              <Link href="/admin/pools" className="text-hazard hover:underline">
                /admin/pools
              </Link>
              . It pulls eliminations from the matchday blob in env and pushes
              <code className="font-mono"> settle_pool</code> in one tx.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
