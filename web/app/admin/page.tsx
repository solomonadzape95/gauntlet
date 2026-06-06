"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Trophy,
  Layers,
  FileJson,
  Users2,
  Coins,
  ShieldCheck,
  Loader2,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { CornerFrame } from "@/components/ui/corner-frame";
import { formatSui } from "@/lib/sui";

/**
 * Admin dashboard — fan-out links + at-a-glance counts. The heavy
 * pool-lifecycle controls live under /admin/pools.
 */
export default function AdminDashboard() {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  );
  const recentEvents = useQuery(
    api.events.recent,
    convexConfigured ? { limit: 8 } : "skip",
  );
  const cashouts = useQuery(
    api.cashouts.recent,
    convexConfigured ? { limit: 16 } : "skip",
  );
  const stats = useQuery(
    api.events.platformStats,
    convexConfigured ? {} : "skip",
  ) as
    | { feeMist: string; grossPotMist: string; poolsSettled: number }
    | undefined;

  const livePools = ((tournaments ?? []) as Array<{ status: string }>).filter(
    (t) => t.status === "live",
  ).length;
  const totalCashedMist =
    ((cashouts ?? []) as Array<{ amountMist: string }>).reduce(
      (sum: bigint, c) => sum + BigInt(c.amountMist),
      0n,
    );

  return (
    <div className="min-h-screen">
      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-3">Operations</div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">
            Admin dashboard
          </h1>
          <p className="mt-3 text-base md:text-lg text-zinc-400 max-w-2xl">
            Manage tournaments, matchday pools, Walrus rosters, settlements, and
            admin access — all from one console.
          </p>
        </section>
      </CornerFrame>

      {/* Headline counters */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-8 grid grid-cols-2 md:grid-cols-4 -ml-px -mt-px">
          <Counter
            label="Revenue · 10% fees"
            value={stats === undefined ? "…" : formatSui(BigInt(stats.feeMist))}
            unit="SUI"
            accent
          />
          <Counter
            label="Settled pots (gross)"
            value={
              stats === undefined
                ? "…"
                : formatSui(BigInt(stats.grossPotMist))
            }
            unit="SUI"
          />
          <Counter
            label="Paid to survivors"
            value={cashouts === undefined ? "…" : formatSui(totalCashedMist)}
            unit="SUI"
          />
          <Counter
            label="Live pools"
            value={tournaments === undefined ? "…" : String(livePools)}
          />
        </div>
      </section>

      {/* Card grid — pages */}
      <section className="border-b border-zinc-900">
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-5">Quick links</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-900 border border-zinc-900">
            <NavCard
              href="/admin/tournaments"
              title="Tournaments"
              body="Create World Cup-sized containers (name, image, season, tagline). Upload a master player pool to Walrus."
              icon={<Trophy className="size-5" />}
            />
            <NavCard
              href="/admin/pools"
              title="Live"
              body="Watch + run every pool — lock, settle, close, player breakdown, live events. Lifecycle controls per pool."
              icon={<Layers className="size-5" />}
            />
            <NavCard
              href="/admin/rosters"
              title="Rosters"
              body="Upload player pools + matchday rosters to Walrus. Index every blob so create-pool can pick from a dropdown."
              icon={<FileJson className="size-5" />}
            />
            <NavCard
              href="/admin/users"
              title="Users"
              body="Wallet owners + pass counts derived from the event log. Search by address, set a display name."
              icon={<Users2 className="size-5" />}
            />
            <NavCard
              href="/admin/cashouts"
              title="Cashouts"
              body="Cashout receipts from the Convex event cache. Link straight to Suiscan for each row."
              icon={<Coins className="size-5" />}
            />
            <NavCard
              href="/admin/admins"
              title="Admins"
              body="Add or remove admin addresses. Super-admin only — env admin is the bootstrap super."
              icon={<ShieldCheck className="size-5" />}
            />
          </div>
        </div>
      </section>

      {/* Recent events strip */}
      <section>
        <div className="mx-auto max-w-[110rem] px-6 lg:px-10 py-10 md:py-12">
          <div className="text-utility text-zinc-500 mb-5 flex items-center gap-2">
            Recent activity
            {recentEvents === undefined && (
              <Loader2 className="size-3 animate-spin" />
            )}
          </div>
          {recentEvents && recentEvents.length === 0 ? (
            <div className="border border-zinc-900 p-6 text-zinc-500">
              No events yet. Events get polled from Sui every 30s once the
              cron action is running.
            </div>
          ) : (
            <ul className="border border-zinc-900 divide-y divide-zinc-900">
              {((recentEvents ?? []) as Array<{
                txDigest: string;
                eventSeq: string;
                type: string;
                sender: string;
              }>).map((ev) => (
                <li
                  key={`${ev.txDigest}-${ev.eventSeq}`}
                  className="px-5 py-3.5 flex items-center justify-between gap-3"
                >
                  <span className="text-base text-zinc-100 truncate">
                    {ev.type}
                  </span>
                  <span className="text-utility text-zinc-500 truncate font-mono shrink-0">
                    {ev.sender.slice(0, 8)}…{ev.sender.slice(-6)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
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

function NavCard({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group bg-ink-surface p-6 md:p-7 transition-colors hover:bg-zinc-900/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-zinc-100 group-hover:text-hazard transition-colors">
          {icon}
        </div>
        <ArrowRight className="size-4 text-zinc-700 group-hover:text-hazard transition-colors" />
      </div>
      <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
    </Link>
  );
}
