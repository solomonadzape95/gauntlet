"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { CreateTournamentPanel } from "@/components/admin/create-tournament-panel";
import { convexConfigured } from "@/lib/convex";

export default function AdminTournamentsPage() {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">
            Tournaments · top-level containers
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            All tournaments
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Each tournament holds many matchday pools. Money + on-chain Pool
            objects are created at the matchday level, not here.
          </p>
        </section>
      </CornerFrame>

      {/* List */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10">
          {!convexConfigured && (
            <ConvexHint />
          )}
          {tournaments === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading tournaments…
            </div>
          )}
          {tournaments && tournaments.length === 0 && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No tournaments yet. Spawn one below.
            </div>
          )}
          {tournaments && tournaments.length > 0 && (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {(tournaments as Array<{
                _id: string;
                slug: string;
                name: string;
                season: string;
                status: string;
                image: string;
              }>).map((t) => (
                <li key={t._id}>
                  <Link
                    href={`/admin/tournaments/${t.slug}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="size-12 shrink-0 bg-ink-surface bg-cover bg-center"
                        style={{ backgroundImage: `url(${t.image})` }}
                      />
                      <div className="min-w-0">
                        <div className="font-serif text-xl font-semibold text-zinc-100 truncate">
                          {t.name}
                        </div>
                        <div className="text-utility text-zinc-500 truncate">
                          {t.slug} · {t.season} · {t.status}
                        </div>
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

      {/* Create */}
      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <CreateTournamentPanel />
        </div>
      </section>
    </div>
  );
}

function ConvexHint() {
  return (
    <div className="border border-amber-900/50 bg-amber-950/10 p-5">
      <div className="text-utility text-amber-400 mb-2">
        Convex isn&apos;t configured
      </div>
      <p className="text-base text-zinc-300">
        Set <code className="font-mono">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
        <code className="font-mono">web/.env.local</code> and run{" "}
        <code className="font-mono">pnpm dlx convex dev</code> in a separate
        terminal. See <code className="font-mono">web/convex/README.md</code>{" "}
        for the full setup.
      </p>
    </div>
  );
}
