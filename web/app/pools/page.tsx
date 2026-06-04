"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Lock, Plus, X, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { TopBar } from "@/components/site/top-bar";
import { CornerFrame } from "@/components/ui/corner-frame";
import { StatusDot } from "@/components/ui/status-dot";
import { CreateTournamentPanel } from "@/components/admin/create-tournament-panel";
import { convexConfigured } from "@/lib/convex";
import { cn } from "@/lib/cn";

interface TournamentRow {
  _id: string;
  slug: string;
  name: string;
  season: string;
  tagline: string;
  image: string;
  imageOriginal: string;
  status: "live" | "soon" | "done";
}

interface MatchdayRow {
  _id: string;
  tournamentSlug: string;
  mdSlug: string;
  label: string;
  date: string;
  fixture?: string;
  status: "live" | "soon" | "done";
  poolObjectId?: string;
}

/**
 * Sort: live tournaments first, then soon, then done. Within each band keep
 * Convex's default ordering (creation time).
 */
const STATUS_RANK: Record<TournamentRow["status"], number> = {
  live: 0,
  soon: 1,
  done: 2,
};

export default function PoolsPage() {
  const tournaments = useQuery(
    api.tournaments.list,
    convexConfigured ? {} : "skip",
  ) as TournamentRow[] | undefined;
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = (tournaments ?? [])
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  return (
    <main className="min-h-screen">
      <TopBar />

      <CornerFrame className="border-b border-zinc-900">
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-12 md:py-16">
          <div className="text-utility text-zinc-500 mb-4">Survival Pools</div>
          <h1 className="font-serif text-display-lg max-w-3xl">
            Pick your gauntlet.
          </h1>
          <p className="mt-5 text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
            Every pool is its own shared object on Sui — same survival
            mechanic, different roster. Live tournaments accept picks today; the
            rest open in Season 1.
          </p>
        </section>
      </CornerFrame>

      {tournaments === undefined && convexConfigured && (
        <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">
          <Loader2 className="size-5 animate-spin mx-auto mb-3" />
          Loading tournaments…
        </div>
      )}

      {tournaments && tournaments.length === 0 && (
        <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">
          No tournaments yet. Spawn one from{" "}
          <Link href="/admin/tournaments" className="text-hazard hover:underline">
            /admin/tournaments
          </Link>
          .
        </div>
      )}

      {sorted.length > 0 && (
        <section className="mx-auto max-w-[90rem] px-6 lg:px-12 py-10 md:py-14">
          <div className="text-utility text-zinc-500 mb-6">All gauntlets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 auto-rows-fr">
            {sorted.map((t, i) => (
              <TournamentCard
                key={t._id}
                tournament={t}
                delay={i * 0.04}
              />
            ))}
            <CreateCard
              onClick={() => setCreateOpen(true)}
              delay={sorted.length * 0.04}
            />
          </div>
        </section>
      )}

      <AnimatePresence>
        {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
      </AnimatePresence>
    </main>
  );
}

function TournamentCard({
  tournament,
  delay,
}: {
  tournament: TournamentRow;
  delay: number;
}) {
  const matchdays = useQuery(
    api.matchdays.listForTournament,
    convexConfigured ? { tournamentSlug: tournament.slug } : "skip",
  ) as MatchdayRow[] | undefined;

  const isLive = tournament.status === "live";
  const liveMd = (matchdays ?? []).find(
    (m) => m.status === "live" && m.poolObjectId,
  );
  // If a live matchday pool exists, prefer it as the click target so users
  // land straight on the mint flow. Otherwise the tournament overview.
  const href = liveMd
    ? `/pools/${tournament.slug}-${liveMd.mdSlug.toLowerCase()}`
    : `/pools/${tournament.slug}`;

  const mdCount = matchdays?.length ?? 0;
  const liveCount = (matchdays ?? []).filter(
    (m) => m.status === "live" && m.poolObjectId,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link href={href} className="block h-full group">
        <motion.div
          initial="rest"
          whileHover="hover"
          animate="rest"
          className={cn(
            "relative border bg-ink-surface flex flex-col overflow-hidden transition-colors h-full min-h-[480px]",
            isLive
              ? "border-zinc-900 group-hover:border-hazard"
              : "border-zinc-900/60 opacity-80 group-hover:opacity-100 group-hover:border-zinc-700",
          )}
        >
          <div className="relative aspect-[16/9] bg-ink-surface overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 70%, #000000 100%)",
              }}
            />
            <motion.img
              src={tournament.imageOriginal}
              alt={tournament.name}
              variants={{
                rest: { opacity: 0, scale: 1.04 },
                hover: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <motion.img
              src={tournament.image}
              alt={tournament.name}
              variants={{
                rest: {
                  opacity: 1,
                  scale: 1,
                  skewY: "0deg",
                  filter: "blur(0px)",
                },
                hover: {
                  opacity: 0,
                  scale: 1.04,
                  skewY: "-1.5deg",
                  filter: "blur(3px)",
                },
              }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div className="relative -mt-10 px-7 md:px-9 pb-8 flex-1 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="text-utility text-zinc-500">{tournament.season}</div>
              {isLive ? (
                <div className="inline-flex items-center gap-2 text-utility text-hazard">
                  <StatusDot status="open" />
                  Live
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-utility text-zinc-600">
                  <Lock className="size-3" />
                  Locked
                </div>
              )}
            </div>

            <h2 className="font-serif text-3xl md:text-4xl mt-4 leading-tight">
              {tournament.name}
            </h2>

            <p className="mt-3 text-base text-zinc-300 max-w-md leading-relaxed">
              {tournament.tagline}
            </p>

            <div className="mt-auto pt-7 border-t border-zinc-900 flex items-end justify-between gap-6">
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <div className="text-utility text-zinc-500">
                    {isLive ? "Live MDs" : "Matchdays"}
                  </div>
                  <div className="font-mono tabular text-xl md:text-2xl mt-1.5 text-zinc-100">
                    {isLive ? liveCount : mdCount}
                  </div>
                </div>
                <div>
                  <div className="text-utility text-zinc-500">
                    {isLive ? "Scheduled" : "Opens"}
                  </div>
                  <div className="font-mono tabular text-base md:text-lg mt-1.5 text-zinc-500">
                    {isLive ? mdCount : "Season 1"}
                  </div>
                </div>
              </div>
              <ArrowUpRight
                className={cn(
                  "size-5 shrink-0 transition-all",
                  isLive
                    ? "text-zinc-600 group-hover:text-hazard group-hover:translate-x-1"
                    : "text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-1",
                )}
              />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function CreateCard({
  onClick,
  delay,
}: {
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative border border-dashed border-zinc-800 hover:border-hazard bg-transparent flex flex-col items-stretch text-left overflow-hidden transition-colors h-full min-h-[480px]"
    >
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
              "linear-gradient(135deg, #141414 0%, #0a0a0a 70%, #000000 100%)",
          }}
        />
        <motion.img
          src="/pools/create-pools-original.jpg"
          alt="Create your pool"
          variants={{
            rest: { opacity: 0, scale: 1.04 },
            hover: { opacity: 1, scale: 1 },
          }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <motion.img
          src="/pools/create-pools-edited.jpg"
          alt="Create your pool"
          variants={{
            rest: { opacity: 1, scale: 1, skewY: "0deg", filter: "blur(0px)" },
            hover: {
              opacity: 0,
              scale: 1.04,
              skewY: "-1.5deg",
              filter: "blur(3px)",
            },
          }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            variants={{
              rest: { scale: 1, opacity: 0.85 },
              hover: { scale: 1.1, opacity: 1 },
            }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center justify-center size-14 rounded-full border border-dashed border-zinc-700 group-hover:border-hazard bg-ink/60 backdrop-blur-sm transition-colors"
          >
            <Plus className="size-6 text-zinc-300 group-hover:text-hazard transition-colors" />
          </motion.div>
        </div>
      </motion.div>

      <div className="relative -mt-10 px-7 md:px-9 pb-8 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="text-utility text-zinc-500">
            Open your own gauntlet
          </div>
          <div className="inline-flex items-center gap-1.5 text-utility text-zinc-500 group-hover:text-hazard transition-colors">
            <Plus className="size-3" />
            New
          </div>
        </div>

        <h2 className="font-serif text-3xl md:text-4xl mt-4 leading-tight group-hover:text-hazard transition-colors">
          Create your pool.
        </h2>

        <p className="mt-3 text-base text-zinc-300 max-w-md leading-relaxed">
          Bring your own roster, set the entry fee, and spawn a pool on chain.
          You become the admin.
        </p>

        <div className="mt-auto pt-7 border-t border-zinc-900 flex items-end justify-between gap-6">
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <div className="text-utility text-zinc-500">Entry</div>
              <div className="font-mono tabular text-xl md:text-2xl mt-1.5 text-zinc-300">
                You set
              </div>
            </div>
            <div>
              <div className="text-utility text-zinc-500">Admin</div>
              <div className="font-mono tabular text-xl md:text-2xl mt-1.5 text-zinc-300">
                You
              </div>
            </div>
          </div>
          <ArrowUpRight className="size-5 text-zinc-600 group-hover:text-hazard group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>
    </motion.button>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur flex items-end md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-ink-surface border border-zinc-800 my-8 p-7 md:p-10"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 inline-flex items-center justify-center size-10 rounded-full text-zinc-400 hover:text-hazard transition-colors"
        >
          <X className="size-5" />
        </button>
        <CreateTournamentPanel onCreated={() => onClose()} />
      </motion.div>
    </motion.div>
  );
}
