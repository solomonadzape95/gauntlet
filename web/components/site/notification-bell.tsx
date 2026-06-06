"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Coins,
  Lock,
  Flag,
  Skull,
  Trophy,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { convexConfigured } from "@/lib/convex";
import { formatSui, shortAddress, suiscanTx } from "@/lib/sui";
import { useRoster } from "@/lib/hooks/use-roster";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "gauntlet-notif-last-seen";

interface NotificationRow {
  _id: string;
  txDigest: string;
  eventSeq: string;
  type: string;
  sender: string;
  poolObjectId?: string;
  payload: Record<string, unknown>;
  timestampMs: number;
}

/**
 * Reactive in-app notification bell. Reads the Convex `events` table —
 * which is populated by either:
 *   (a) the Sui-events cron that polls RPC every 30s
 *   (b) the /tatum-webhook HTTP endpoint when Tatum push lands
 *
 * Either way, the bell pulses with a hazard badge the moment new events
 * append. Click → dropdown with the latest 20. "Mark as seen" persists
 * a watermark timestamp in localStorage so the badge clears.
 */
export function NotificationBell() {
  const account = useCurrentAccount();
  const address = account?.address ?? "";
  // Scope notifications to the connected wallet — its own passes and the pools
  // it holds a pass in. Without an address there's nothing personal to show.
  const events = useConvexQuery(
    api.events.forOwner,
    convexConfigured && address ? { address, limit: 20 } : "skip",
  ) as NotificationRow[] | undefined;

  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = useMemo(() => {
    if (!events) return 0;
    return events.filter((e) => e.timestampMs > lastSeen).length;
  }, [events, lastSeen]);

  const markAllSeen = () => {
    const now = Date.now();
    setLastSeen(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(now));
    }
  };

  const handleToggle = () => {
    if (!open && unread > 0) {
      // Mark seen on open so the badge clears once the user looks.
      markAllSeen();
    }
    setOpen((x) => !x);
  };

  if (!convexConfigured) return null;

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        type="button"
        onClick={handleToggle}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative inline-flex items-center justify-center size-10 rounded-full bg-zinc-100 text-ink hover:bg-white transition-colors"
      >
        <Bell className="size-4" strokeWidth={2.2} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-hazard text-ink text-[10px] font-mono font-bold leading-none"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-3 w-[360px] z-50 border border-zinc-800 bg-ink-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
              <div className="text-utility text-zinc-500">Activity</div>
              <button
                type="button"
                onClick={markAllSeen}
                className="text-utility text-zinc-500 hover:text-hazard"
              >
                Mark all seen
              </button>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              {!address && (
                <div className="px-4 py-6 text-zinc-500 text-base">
                  Connect your wallet to see activity on your passes.
                </div>
              )}
              {address && events === undefined && (
                <div className="px-4 py-6 text-zinc-500 text-base">
                  Loading…
                </div>
              )}
              {address && events && events.length === 0 && (
                <div className="px-4 py-6 text-zinc-500 text-base">
                  Nothing yet. Mint a pass and you&apos;ll see updates on your
                  picks here.
                </div>
              )}
              {address && events && events.length > 0 && (
                <ul className="divide-y divide-zinc-900">
                  {events.map((ev) => (
                    <NotificationRow key={ev._id} ev={ev} />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Resolve a player's name from the pool's roster (pool → matchday row →
 * Walrus roster blob). Returns null when there's no player on the event or the
 * roster hasn't loaded — callers fall back to the numeric id.
 */
function usePlayerName(
  poolObjectId: string | undefined,
  playerId: number | null,
): string | null {
  const needsName = playerId != null && !!poolObjectId;
  const matchday = useConvexQuery(
    api.matchdays.getByPool,
    convexConfigured && needsName ? { poolObjectId: poolObjectId! } : "skip",
  ) as { rosterBlobId?: string } | null | undefined;
  const { data: roster } = useRoster(
    needsName ? matchday?.rosterBlobId ?? "" : "",
  );
  if (playerId == null) return null;
  return roster?.players.find((p) => p.id === playerId)?.name ?? null;
}

function playerIdOf(ev: NotificationRow): number | null {
  const raw = (ev.payload as { player_id?: unknown } | undefined)?.player_id;
  return raw == null ? null : Number(raw);
}

function NotificationRow({ ev }: { ev: NotificationRow }) {
  const playerId = playerIdOf(ev);
  const playerName = usePlayerName(ev.poolObjectId, playerId);
  const meta = describe(ev, playerName);
  return (
    <li>
      <a
        href={suiscanTx(ev.txDigest)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-900/40 transition-colors"
      >
        <div className={cn("mt-0.5 shrink-0", meta.tone)}>{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-base text-zinc-100 leading-snug truncate">
            {meta.title}
          </div>
          <div className="mt-0.5 text-utility text-zinc-500 truncate">
            {meta.detail} · {formatTime(ev.timestampMs)} ·{" "}
            {shortAddress(ev.sender)}
          </div>
        </div>
      </a>
    </li>
  );
}

function describe(
  ev: NotificationRow,
  playerName: string | null,
): {
  title: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
} {
  const data = ev.payload ?? {};
  const playerId = Number((data as { player_id?: unknown }).player_id ?? 0);
  const player = playerName ?? `player #${playerId}`;
  switch (ev.type) {
    case "PassMinted":
      return {
        title: `Pass minted · ${player}`,
        detail: "New Survival Pass",
        icon: <Coins className="size-4" />,
        tone: "text-emerald-300",
      };
    case "PassCashedOut": {
      const payout = BigInt(
        String((data as { payout_mist?: unknown }).payout_mist ?? "0"),
      );
      return {
        title: `Cashout · ${formatSui(payout)} SUI`,
        detail: "Survivor claimed",
        icon: <CheckCircle2 className="size-4" />,
        tone: "text-hazard",
      };
    }
    case "PassEliminated":
      return {
        title: `Out · ${player}`,
        detail: "Pass burned",
        icon: <Skull className="size-4" />,
        tone: "text-zinc-500",
      };
    case "PoolLocked":
      return {
        title: "Pool locked",
        detail: "Mints closed",
        icon: <Lock className="size-4" />,
        tone: "text-amber-300",
      };
    case "PoolSettled":
      return {
        title: "Matchday settled",
        detail: "Cashout window open",
        icon: <Flag className="size-4" />,
        tone: "text-sky-300",
      };
    case "PoolClosed":
      return {
        title: "Pool closed",
        detail: "Final whistle",
        icon: <Trophy className="size-4" />,
        tone: "text-zinc-500",
      };
    case "PoolCreated":
      return {
        title: "Pool created",
        detail: "Survival pool spawned",
        icon: <Sparkles className="size-4" />,
        tone: "text-hazard",
      };
    default:
      return {
        title: `Event · ${ev.type}`,
        detail: "Unknown event type",
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
