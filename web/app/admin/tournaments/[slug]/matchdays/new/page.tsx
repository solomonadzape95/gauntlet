"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { CornerFrame } from "@/components/ui/corner-frame";
import { CreateMatchdayPoolPanel } from "@/components/admin/create-matchday-pool-panel";
import { convexConfigured } from "@/lib/convex";

export default function NewMatchdayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const tournament = useQuery(
    api.tournaments.get,
    convexConfigured ? { slug } : "skip",
  );

  return (
    <div>
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <Link
            href={`/admin/tournaments/${slug}`}
            className="text-utility text-zinc-500 hover:text-hazard inline-flex items-center gap-1.5 mb-4"
          >
            ← {tournament?.name ?? slug}
          </Link>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight max-w-3xl">
            New matchday pool
          </h1>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl">
            Filter players from the tournament&apos;s master pool, push the
            subset to Walrus, mint a Sui Pool, and save the matchday row — one
            click.
          </p>
        </section>
      </CornerFrame>

      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          {tournament === undefined && convexConfigured && (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading tournament…
            </div>
          )}
          {tournament === null && (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              Tournament not found:{" "}
              <code className="font-mono">{slug}</code>
            </div>
          )}
          {tournament && (
            <CreateMatchdayPoolPanel
              tournament={{
                slug: tournament.slug,
                name: tournament.name,
                playerPoolBlobId: tournament.playerPoolBlobId ?? undefined,
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
