"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUpRight,
  Loader2,
  Coins,
  Lock,
  Flag as FlagIcon,
  Skull,
  Trophy,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  useEvents,
  type EventType,
  type PoolEvent,
} from "@/lib/hooks/use-events";
import { formatSui, shortAddress, suiscanTx } from "@/lib/sui";
import { useRoster } from "@/lib/hooks/use-roster";
import { cn } from "@/lib/cn";

export function EventsFeed() {
  const { data: events, isLoading } = useEvents(40);
  const { data: roster } = useRoster();

  const playerName = (id: number) =>
    roster?.players.find((p) => p.id === id)?.name ?? `Player #${id}`;

  return (
    <div className="border border-zinc-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Live event feed
          </h2>
          <p className="text-utility text-zinc-500 mt-1.5">
            On-chain events for this pool. Refreshes every 15 seconds.
          </p>
        </div>
        {isLoading && <Loader2 className="size-4 animate-spin text-zinc-600" />}
      </div>

      <div className="max-h-[480px] overflow-y-auto">
        {!isLoading && (!events || events.length === 0) ? (
          <div className="px-6 py-10 text-center text-zinc-500">
            No events yet. Mint a pass, lock the pool, or settle.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {(events ?? []).map((ev) => (
              <motion.div
                key={`${ev.txDigest}-${ev.eventSeq}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <EventRow ev={ev} playerName={playerName} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function EventRow({
  ev,
  playerName,
}: {
  ev: PoolEvent;
  playerName: (id: number) => string;
}) {
  const meta = describeEvent(ev, playerName);

  return (
    <a
      href={suiscanTx(ev.txDigest)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 px-6 py-4 border-t border-zinc-900 hover:bg-zinc-900/40 transition-colors group first:border-t-0"
    >
      <div className={cn("mt-1 shrink-0", meta.tone)}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-base text-zinc-100 leading-snug">
          {meta.title}
        </div>
        <div className="mt-1 text-utility text-zinc-500">
          {meta.detail} · {formatTime(ev.timestampMs)} · {shortAddress(ev.sender)}
        </div>
      </div>
      <ArrowUpRight className="size-4 text-zinc-700 group-hover:text-hazard shrink-0 mt-1" />
    </a>
  );
}

function describeEvent(
  ev: PoolEvent,
  playerName: (id: number) => string,
): { title: React.ReactNode; detail: string; icon: React.ReactNode; tone: string } {
  switch (ev.type) {
    case "PassMinted": {
      const pid = Number(ev.data.player_id ?? 0);
      return {
        title: (
          <>
            <strong>{playerName(pid)}</strong> picked
          </>
        ),
        detail: `New Survival Pass`,
        icon: <Coins className="size-4" />,
        tone: "text-emerald-300",
      };
    }
    case "PassCashedOut": {
      const payout = BigInt(String(ev.data.payout_mist ?? "0"));
      return {
        title: (
          <>
            Cashout · <strong className="text-hazard">{formatSui(payout)} SUI</strong>
          </>
        ),
        detail: `Survivor claimed share`,
        icon: <CheckCircle2 className="size-4" />,
        tone: "text-hazard",
      };
    }
    case "PassEliminated": {
      const pid = Number(ev.data.player_id ?? 0);
      return {
        title: (
          <>
            <strong>{playerName(pid)}</strong> missed target
          </>
        ),
        detail: `Pass burned`,
        icon: <Skull className="size-4" />,
        tone: "text-zinc-500",
      };
    }
    case "PoolLocked":
      return {
        title: <>Pool locked</>,
        detail: `No new mints accepted`,
        icon: <Lock className="size-4" />,
        tone: "text-amber-300",
      };
    case "PoolSettled": {
      const alive = Number(ev.data.alive_count ?? 0);
      return {
        title: <>Matchday settled</>,
        detail: `${alive} survivors · cashout window open`,
        icon: <FlagIcon className="size-4" />,
        tone: "text-sky-300",
      };
    }
    case "PoolClosed":
      return {
        title: <>Pool closed</>,
        detail: `Final whistle`,
        icon: <Trophy className="size-4" />,
        tone: "text-zinc-500",
      };
    case "PoolCreated":
      return {
        title: <>Pool created</>,
        detail: `New survival pool spawned`,
        icon: <Sparkles className="size-4" />,
        tone: "text-hazard",
      };
    default:
      return {
        title: <>Event · {ev.type}</>,
        detail: `Unknown event type`,
        icon: <Sparkles className="size-4" />,
        tone: "text-zinc-500",
      };
  }
}

function formatTime(ms: number): string {
  if (!ms) return "just now";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
