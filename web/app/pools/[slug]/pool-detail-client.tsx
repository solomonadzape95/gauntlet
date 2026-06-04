"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Loader2 } from "lucide-react";

import { TopBar } from "@/components/site/top-bar";
import { MatchdayStrip } from "@/components/site/matchday-strip";
import { CornerFrame } from "@/components/ui/corner-frame";
import { BigNumber } from "@/components/ui/big-number";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";

import {
  usePoolState,
  PHASE_LABEL,
  PHASE_DOT,
} from "@/lib/hooks/use-pool-state";
import { useEvents, type PoolEvent } from "@/lib/hooks/use-events";
import { formatSui, suiscanTx, suiscanObject, shortAddress } from "@/lib/sui";
import type { PoolMeta } from "@/lib/pools";
import { useTournament } from "@/lib/hooks/use-tournaments";

export function PoolDetailClient({ pool: meta }: { pool: PoolMeta }) {
  const poolId = meta.poolId ?? "0x0";
  const { data: pool } = usePoolState(poolId);
  const { data: events } = useEvents(8, poolId);
  const tournament = useTournament(meta.tournament);

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Hero — pool image + identity */}
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-14">
          <div className="grid grid-cols-12 gap-8 items-end">
            {/* Image — edited at rest, original revealed on hover (warp transition) */}
            <div className="col-span-12 md:col-span-7 lg:col-span-8">
              <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
                className="relative aspect-[16/9] bg-ink-surface overflow-hidden"
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)",
                  }}
                />
                <motion.img
                  src={meta.imageOriginal}
                  alt={meta.name}
                  variants={{
                    rest: { opacity: 0, scale: 1.04 },
                    hover: { opacity: 1, scale: 1 },
                  }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <motion.img
                  src={meta.image}
                  alt={meta.name}
                  variants={{
                    rest: { opacity: 1, scale: 1, skewY: "0deg", filter: "blur(0px)" },
                    hover: { opacity: 0, scale: 1.04, skewY: "-1.5deg", filter: "blur(3px)" },
                  }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </motion.div>
            </div>

            {/* Identity */}
            <div className="col-span-12 md:col-span-5 lg:col-span-4">
              <div className="text-utility text-zinc-500 mb-3 inline-flex items-center gap-2">
                <StatusDot status={pool ? PHASE_DOT[pool.phase] : "open"} />
                {pool ? PHASE_LABEL[pool.phase] : "Loading…"} · {meta.season}
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
                {meta.name}
              </h1>
              <p className="mt-4 text-base md:text-lg text-zinc-300 leading-relaxed">
                {meta.tagline}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/pools/${meta.slug}/pick`}>
                  <Button variant="hazard" size="lg" bullet>
                    Pick a Player
                  </Button>
                </Link>
                <Link href={`/pools/${meta.slug}/live`}>
                  <Button variant="outline" size="lg" bullet>
                    Live Pool
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </CornerFrame>

      {/* Tournament matchday schedule strip */}
      {tournament && (
        <MatchdayStrip tournament={tournament} currentPoolSlug={meta.slug} />
      )}

      {/* Stats — tighter container */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-4xl px-6 lg:px-12 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
          <BigNumber
            label="Pot"
            value={formatSui(pool?.pot_mist ?? 0n)}
            unit="SUI"
            accent
          />
          <BigNumber
            label="Mints"
            value={String(pool?.total_passes ?? 0)}
          />
          <BigNumber
            label="Alive"
            value={String(pool?.alive_count ?? 0)}
          />
          <BigNumber
            label="Entry"
            value={formatSui(pool?.entry_fee_mist ?? 0n)}
            unit="SUI"
          />
        </div>
      </section>

      {/* Recent activity */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-4xl px-6 lg:px-12 py-10 md:py-12">
          <div className="flex items-center justify-between mb-5">
            <div className="text-utility text-zinc-500">Recent activity</div>
            <Link
              href={`/pools/${meta.slug}/live`}
              className="text-utility text-zinc-500 hover:text-hazard transition-colors inline-flex items-center gap-1.5"
            >
              See live <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {events === undefined ? (
            <div className="border border-zinc-900 p-6 inline-flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> Loading events…
            </div>
          ) : events.length === 0 ? (
            <div className="border border-zinc-900 p-6 text-zinc-500 text-base">
              No events yet. Be the first to mint a pass.
            </div>
          ) : (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {events.slice(0, 5).map((ev) => (
                <EventLine key={`${ev.txDigest}-${ev.eventSeq}`} ev={ev} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Trust badge */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-4xl px-6 lg:px-12 py-6">
          <div className="border border-zinc-900 px-5 py-4 flex items-start gap-3">
            <span aria-hidden className="text-hazard text-lg leading-none mt-0.5">◆</span>
            <div className="text-sm text-zinc-300 leading-relaxed">
              <span className="text-zinc-100 font-medium">Pot held on chain.</span>{" "}
              The entry fees live in the Pool shared object and only Pass owners can withdraw — including this pool&apos;s creator.{" "}
              <a
                href="https://github.com/MystenLabs/sui/blob/main/dev-docs/content/concepts/object-ownership/shared.mdx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-hazard transition-colors"
                title="The Move contract has no admin-drain path. Lock, settle, and close are all state-only; cashout requires ownership of a valid Pass for this pool."
              >
                Why this is safe →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer — pool id */}
      <section>
        <div className="mx-auto max-w-4xl px-6 lg:px-12 py-8 flex flex-wrap items-center justify-between gap-3">
          <div className="text-utility text-zinc-500">Pool object</div>
          {meta.poolId ? (
            <a
              href={suiscanObject(meta.poolId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-zinc-300 hover:text-hazard inline-flex items-center gap-1"
            >
              {shortAddress(meta.poolId, 8, 6)}
              <ArrowUpRight className="size-3" />
            </a>
          ) : (
            <span className="text-utility text-zinc-600">not configured</span>
          )}
        </div>
      </section>
    </main>
  );
}

function EventLine({ ev }: { ev: PoolEvent }) {
  const label = describe(ev);
  return (
    <li>
      <motion.a
        href={suiscanTx(ev.txDigest)}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ x: 2 }}
        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-zinc-900/40 transition-colors"
      >
        <span className="text-base text-zinc-100">{label}</span>
        <span className="text-utility text-zinc-500">
          {shortAddress(ev.sender)}
        </span>
      </motion.a>
    </li>
  );
}

function describe(ev: PoolEvent): string {
  switch (ev.type) {
    case "PassMinted":
      return `Pass minted · player #${ev.data.player_id ?? "?"}`;
    case "PassCashedOut":
      return `Cashout · ${formatSui(BigInt(String(ev.data.payout_mist ?? "0")))} SUI`;
    case "PassEliminated":
      return `Out · player #${ev.data.player_id ?? "?"}`;
    case "PoolLocked":
      return "Pool locked";
    case "PoolSettled":
      return "Matchday settled";
    case "PoolClosed":
      return "Pool closed";
    case "PoolCreated":
      return "Pool created";
    default:
      return ev.type;
  }
}
